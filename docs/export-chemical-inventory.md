# Chemical Inventory Excel Export (with AI Quick Summary)

## What this feature does

The **Export Inventory** button on the Chemical Management page downloads a styled
Excel workbook of the tenant's chemical inventory. It combines the uploaded/stored
chemical data with platform-derived safety and compliance fields, and adds a plain-
language **AI Quick Summary** column generated at export time.

Exporting is **read-only**. No chemical records are created, changed, or deleted.

## Where it lives

| File | Purpose |
|---|---|
| `src/app/(app)/chemicals/ChemicalExportButton.tsx` | Client button — builds the workbook and triggers the browser download |
| `src/lib/actions/exportChemicalSummaries.ts` | Server action — generates the AI Quick Summaries (read-only) + one audit entry |
| `src/lib/xlsExport.ts` | Dependency-free OOXML (.xlsx) engine used to build the workbook |
| `src/app/(app)/chemicals/page.tsx` | Renders the button in the page toolbar |
| `test/chemical-export-summaries.test.ts` | Unit tests (injection guard, AI fallback, audit) |

There is **no** new dependency (uses the app's own `xlsExport` engine — not ExcelJS),
**no** new database table or view, and **no** migration.

## What's in the workbook

Three sheets:

1. **Dashboard** — KPI tiles (total chemicals, high-hazard, scheduled/DEA, missing SDS, locations) and an inventory-status summary.
2. **Chemical Inventory** — one row per chemical: Chemical Name, CAS #, Supplier, Qty, Unit, Location, SDS Status, SDS Expiry, Scheduled, Risk Level, and **AI Quick Summary**.
3. **High Hazard & Scheduled** — the same columns, filtered to high-hazard/toxic and scheduled substances.

Conditional formatting: red for missing SDS / scheduled / high-hazard, amber for
warnings, green for compliant. A footer note states the AI summaries are advisory.

## The AI Quick Summary column

Each row gets a 1–2 sentence plain-language overview of the chemical's safety and
compliance status, written by the platform's AI gateway using **only** the fields
already stored on the record (name, CAS, SDS status/expiry, scheduled flag, storage
location/class, GHS hazard statements). The model is instructed never to invent data.

If the AI provider is unavailable, misconfigured, times out, or its circuit breaker is
open, each row falls back to a summary **constructed from its own field values**. The
export always completes — with or without AI. Summaries are advisory only and do not
replace official Safety Data Sheets.

## Who can use it

Any authenticated user who can view the Chemical Management page can export. Data is
tenant-scoped by RLS via the standard repo layer (`getChemicals`), and the export only
re-presents fields the user can already see — it exposes no new data.

> If you later want to restrict the AI enrichment to manager roles, gate the server
> action with `canManage(role)` (`src/lib/constants.ts`). It is intentionally ungated
> today to match the existing inventory export's behaviour.

## Security notes

- **Formula-injection safe.** Every text cell is passed through `antiInjection()` in
  `xlsExport.ts`: any value opening with `=`, `+`, `-`, `@` (or a leading tab/CR) is
  prefixed with an apostrophe so Excel/Sheets/LibreOffice render it as literal text,
  never as a formula. This protects the whole app's exports, not just this one.
- **Audit trail.** Each export writes a single best-effort row to `audit_log` via
  `addAudit()`: actor (profile id), `action = "chemical.export_summaries"`, the tenant,
  and `detail = { record_count, ai_enriched }`. A failed audit write never blocks the
  export. Works in both mock and live mode.
- **No storage bucket.** The workbook is generated in the browser and downloaded
  directly. Nothing is uploaded to Supabase Storage.

## How to export

1. Go to **Chemicals** in the left navigation.
2. Click **Export Inventory** (top-right of the page toolbar).
3. The button shows **Preparing your file…** while summaries are generated (a few
   seconds for typical inventories; longer for very large ones).
4. The `.xls` workbook downloads automatically to your browser's Downloads folder.

The button is disabled when there are no chemicals to export.

## Troubleshooting

| Problem | What to do |
|---|---|
| Button is disabled | No chemicals in inventory yet — add or import chemicals first. |
| "Couldn't generate the export" | Transient error; click again. The workbook still builds even if summaries fail. |
| AI Quick Summary looks generic | The AI provider was unavailable; the row fell back to a field-based summary. The data is still accurate. |
| File won't open | Open with Excel, Google Sheets, or LibreOffice Calc. |

## Tests

```bash
npx vitest run test/chemical-export-summaries.test.ts
```

Covers: the formula-injection guard, valid `.xlsx` byte output, AI fallback when the
gateway is unavailable, the AI success path, and the single audit-log write.
