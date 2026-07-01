# Smart Chemical Passport Label

## What is it?

A printable, scannable label you can generate for any chemical container — drum, bottle, tote, or storage container. It shows the most important safety information in one place and links to the full digital record in SafetyIQ via a QR code (and an NFC "tap" indicator).

## Who is it for?

- EHS coordinators generating and printing container labels
- Chemical handlers checking PPE or storage requirements at a glance
- Safety managers verifying current hazard and SDS information
- Emergency responders who need the emergency contact without scanning anything

## How to generate a label

1. Open a chemical record: **Chemical Management → click a chemical**.
2. Click **Generate Smart Chemical Passport Label** (top-right of the record).
3. The label preview loads at `/chemicals/[id]/passport`, populated automatically from the existing chemical record.
4. Review any field flagged as **Needs Review** (see below).
5. Click **Print Label**, **Export PDF**, or **Export PNG**.
   - Use **PDF** for drums and totes.
   - Use **PNG** for bottles and smaller containers.

## What each section means

| Section | What it shows | Source |
|---|---|---|
| Chemical Name | Full name — always shown with the CAS number | `name` |
| CAS Number | Unique chemical identifier — always shown with the name | `cas_number` |
| Product ID | Your internal label code | `label_code` |
| Formula | Chemical identity | `chemical_formula` |
| GHS Pictograms | Hazard symbols with a one-word label | derived from the H-codes |
| Hazard Statements | Plain descriptions (e.g. "Highly flammable liquid and vapour") | `hazard_statements` |
| Required PPE | Protective equipment — every icon has a text label | `recommended_ppe` |
| Storage Guidance | Plain-language safe-storage instructions | `storage_class` + `storage_location` |
| Do Not Mix With | Incompatible substances to store away from | derived from `storage_class` |
| Emergency Contact | Emergency phone in large text | company settings |
| Data Verified | 🟢 High / 🟡 Moderate / 🔴 Needs Review | `hazard_band_confidence` |
| Label Last Verified | When the data was last confirmed | `hazard_band_reviewed_at` |
| QR Code | Scan to open the full digital chemical record | live record URL |
| Tap to Access | NFC indicator (chip provisioning handled separately) | — |

## What "Needs Review" means

The chemical's data has low confidence or hasn't been recently verified. Open the record, complete the concentration hazard analysis / update the fields, then re-generate the label.

## Does generating a label change the record?

**No.** Generating a label is read-only. It pulls from the existing `chemical_inventory` table using the platform's row-level security — it never creates, modifies, or deletes data.

## Admin notes

- **No database migration is required.** Every field is derived from columns that already exist on `chemical_inventory` (plus company emergency-contact settings). An optional future-enhancement migration is documented — and left un-applied — at `supabase/migrations/DRAFT_build-smart-chemical-passport.sql`.
- No employee medical information is ever shown. No internal database field names or IDs appear on the printed label.
- Exports use `html2canvas` + `jspdf` (client-side); print uses the browser's native print. QR codes use the `qrcode` library already in the app.
