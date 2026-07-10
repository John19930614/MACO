# Universal Waste & Recycling Tracking

## What this is
This feature tracks two separate things, in two visually distinct tabs:

1. **Universal Waste** (red tab) — batteries, lamps, mercury-containing equipment, aerosol cans, pesticides, e-waste, used oil, and solvents. These are hazardous materials with special federal/state handling rules.
2. **Recycling** (green tab) — everyday nonhazardous materials (cardboard, metal, plastic, etc.) that you recycle instead of landfilling.

They are kept visually separate in the app because mixing them up is a compliance risk.

## Where it lives
- Route: `/waste/universal-waste-recycling` (two tabs: `?tab=universal_waste` and `?tab=nonhaz_recycling`).
- Left nav: **Waste Management → Universal Waste** and **→ Recycling**.
- It sits alongside the existing Waste Management module — the legacy waste-stream, recyclable-label, and Universal Waste Program document flows are unchanged.

## Why a "determination" is required first
Federal (and state) law requires you to document whether a waste is hazardous *before* it goes into any recycling stream. The app **blocks** you from adding a Universal Waste Item or a Recycling Record until an approved determination is on file — enforced both in the UI (the buttons are disabled with a banner explaining why) and on the server (every create checks for a linked, approved `waste_determinations` row; the database also requires a NOT NULL `determination_id` foreign key as a final backstop).

## The 1-year clock ("Must ship out by")
When you log a Universal Waste Item you record the date it started accumulating ("Clock starts"). The app automatically calculates the date it must leave the site — **365 days later** — via a database generated column (`accumulation_deadline`), so it can never be entered wrong. A stoplight badge shows the countdown:

- **Green** — more than 60 days left.
- **Yellow** — 60 days or fewer left.
- **Red** — past the deadline (overdue).

## Certificates
When a load is recycled, reclaimed, or destroyed, upload the vendor's certificate. This certificate **auto-populates** the item's chain-of-custody log and retention period — you don't type these in separately. Saving a certificate for a UW item also advances it to "shipped".

## What happens if a load is rejected?
If a vendor rejects a shipment, mark it as rejected. The item/record flips to **Rejected**, a red "waste coordinator action needed" panel appears with a count badge (the in-app flag), and the record is **blocked from further processing** (you can't add a certificate to it) until you record a resolution: **re-certified**, **disposed**, or **re-routed**. (A dedicated paging/notification channel is intentionally out of scope this release — the unresolved rejected-load row *is* the in-app flag, mirroring the risk-escalations "human-gated, no auto-page" pattern.)

## Diversion rate
This is simply the % of your waste that was recycled instead of sent to landfill: `recycled ÷ (recycled + landfill) × 100`, computed from weight tickets (a database generated column per record; the summary card sums across records). Shown as a percentage and in plain language — e.g. "72% of waste diverted from landfill." Cost-avoided and revenue totals sit alongside it.

## Vendor status badge
Each vendor shows a **Valid / Expiring soon / Expired** badge based on `permit_expiry`, `insurance_expiry`, and `recycler_authorization_expiry`: expired if any date is past, expiring if any is within 30 days, otherwise valid.

## Jurisdiction rules (day-one scope)
A lightweight `uw_jurisdiction_rules` table is seeded with **WI aerosol-cans-as-Universal-Waste (effective 7/1/2025)** and **CA state-specific UW categories**. A jurisdiction-engine helper reads it to set inspection frequency and eligibility. **Out of scope (fast-follow):** the full 50-state inspection-frequency matrix and AI-driven flagging. Day one ships a simple countdown + generic inspection checklist.

## Glossary
- **Universal Waste** = certain hazardous items (batteries, lamps, mercury equipment, aerosols, pesticides…) with relaxed handling rules vs. other hazardous waste.
- **Determination** = the documented decision about whether a material is hazardous.
- **Accumulation-start date** = the day the waste was first collected ("Clock starts").
- **Accumulation deadline / Must ship out by** = 365 days after the start date.
- **Chain of custody** = the record of who handled the waste from collection to final disposal — auto-filled from the item + certificate records.
- **Retention period** = how long you must keep these records (defaults to 3 years, auto-filled).
- **Diversion rate** = share of waste recycled instead of landfilled.

## Notes for engineers
- Tables (`waste_determinations`, `universal_waste_items`, `nonhaz_recycling_records`, `recycling_certificates`, `rejected_loads`) are tenant-scoped with `in_tenant(tenant_id)` read+write RLS; `uw_jurisdiction_rules` is a global read-only reference table. Migration: `supabase/migrations/20260710010000_universal_waste_recycling_tracking.sql`.
- Server actions live in `src/lib/actions/universal-waste-recycling-tracking.ts` (getCtx + MOCK_MODE + Zod). Pure helpers (badge, diversion, deadline, stoplight, WI eligibility) live in `src/lib/waste/uw-helpers.ts`; the DB-backed jurisdiction resolver in `src/lib/waste/jurisdiction-engine.ts`.
- Unit tests: `test/universal-waste-recycling-tracking.test.ts` (vitest only includes `test/**`). Run: `npm run test -- universal-waste`.
