# Regulation-correct GHS label sizing (EU CLP)

## What changed

The GHS Workplace Label used to print at a fixed **4 in × 4 in** regardless of the
container. Container labels are now sized by **container capacity** per **EU CLP
(Regulation 1272/2008, Annex I §1.2.1)**. US OSHA HazCom mandates no dimension, so
sizing to the CLP minimums also satisfies OSHA.

| Container capacity | Min label (w × h) | Pictogram (min side) |
|---|---|---|
| ≤ 3 L | 52 × 74 mm | 16 mm |
| > 3 – 50 L | 74 × 105 mm | 23 mm |
| > 50 – 500 L | 105 × 148 mm | 32 mm |
| > 500 L | 148 × 210 mm | 46 mm |

Pictogram minimum = **≥ 1/15 of the label area, never below 1 cm² (10 mm)** — computed,
not hardcoded. These are legal minimums; printing larger is compliant, smaller is not.

## How the container size is set

Each chemical now has a **Container Capacity** + **Container Unit** field (Add and Edit
Chemical forms). This is the capacity of a *single container*, not total inventory on
hand. Units: mL, L, gal, g, kg — converted to litres for tiering (mass units approximated
at density ≈ 1; set a volume unit for solids where the packed volume differs).

If no capacity is recorded, the label falls back to the smallest tier (≤3 L) and the
print dialog shows an amber "container size not set" hint.

## Where it lives

| File | Purpose |
|---|---|
| `supabase/migrations/20260701000000_chemical_container_capacity.sql` | Adds `container_capacity` + `container_capacity_unit` (additive, nullable) |
| `src/lib/chemicals/labelSizing.ts` | CLP tier + pictogram math (pure, unit-tested) |
| `src/app/(app)/chemicals/GhsLabelButton.tsx` | Sizes the printed label `@page`, pictograms, and fonts by tier |
| `src/app/(app)/chemicals/[id]/EditChemicalForm.tsx`, `AddChemicalButton.tsx` | Capacity + unit inputs |
| `src/lib/actions/ehs.ts` | Persists the two fields (`containerCapFields`) |
| `test/label-sizing.test.ts` | Tier boundaries + unit conversions |

## Notes

- The two smallest tiers use a **compact print layout** (fewer P-statements, scaled
  fonts) so the essentials stay legible on a small label.
- The printed label footer states the size + tier, e.g. *"Label size 74×105 mm (EU CLP 3–50 L)."*
- The redundant group-row **Label** button (next to **Passport**) was removed; the
  per-container GHS Label remains on the expanded rows, where container-size sizing applies.
