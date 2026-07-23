# NFPA 704 Ratings

## What this does
For each chemical container, we show a 0–4 rating for **Health** (blue),
**Flammability** (red), and **Instability** (yellow), plus any special hazard
symbols (white) — the same "fire diamond" shape emergency crews read on real
buildings.

These ratings combine automatically, worst-case first:

1. **Container** → one chemical's individual rating.
2. **Storage Area (Room)** → the *worst* rating found in any container in that
   area, **for each color separately**. An area with one very flammable item and
   otherwise mild chemicals shows high Flammability but will **not** also show
   high Health/Instability just because of that one item.
3. **Building** → the *worst* rating found across all storage areas, the same way.

The math is **worst-rating-per-category wins** — never an average, and never
diluted or weighted by how much of a chemical is present. That is the standard
NFPA 704 posting philosophy: the placard warns a responder about the worst
credible hazard they could meet inside, not a statistical middle.

## "Rating not yet entered"
If a container has no hazard data on file, we show **"Rating not yet entered"**
(a dash), never a 0. A blank/zero would wrongly tell a firefighter "no hazard."
We never guess. Areas and buildings surface how many containers are still
missing ratings so you can judge how complete the posting is.

> A category can still legitimately read **0** — that happens when a chemical
> *does* have hazard data but nothing in that category (e.g. a flammable liquid
> with no health hazard). "0" (known no-hazard) and "—" (unknown) are different.

## How this maps to the data we actually have
SafetyIQ has no separate `buildings` / `storage_areas` / `containers` tables, so
the hierarchy is built from what exists:

| NFPA concept | Where it lives |
|---|---|
| Building | a **Site** |
| Storage Area / control zone | a chemical's **storage location** within that site |
| Container | a **chemical inventory** record |
| Container rating | **derived from the chemical's GHS H-statements** (we store no separate NFPA columns) |

Because the numbers are derived from GHS classification rather than a
professionally-assigned placard, they are an at-a-glance approximation until an
expert reviews them (see the safety note below).

## Printable posting
Open a building's NFPA page and click **Open printable posting** for a large,
chrome-free page you can print (Ctrl/Cmd+P) or save as PDF and mount at the
building entrance — 18–24 inches off the ground, per standard NFPA 704 practice.

## Access & feature flag
- The page and its server action are limited to **manager/admin** roles and are
  tenant-scoped (you only ever see your own organization's chemicals).
- The whole feature is behind the **`nfpa704_beta`** flag and is **OFF by
  default**. Turn it on by setting `NEXT_PUBLIC_NFPA704_BETA=true`.

## Important safety note (approval gate)
The roll-up rule here — *worst rating per category wins, no averaging or
dilution* — reflects standard NFPA 704 posting philosophy, but **has not yet
been formally signed off by an EHS / fire-safety subject-matter expert for this
deployment.** Two things must be confirmed before the flag is turned on for real
signage:

1. That worst-case-per-category (no dilution by quantity/volume) is the correct
   aggregation rule for this organization's use case.
2. That the printable placard page is the right home for "the building's posted
   rating" (this build assumes a dedicated printable page, per the Human
   Experience review's recommendation — not a number buried in a table).

Do not rely on generated postings for real building signage until an EHS lead
enables `nfpa704_beta` after that review. The aggregation code carries a
`// TODO: SME-VERIFIED?` marker until it is confirmed.
