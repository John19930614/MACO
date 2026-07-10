# Hazardous Waste Generator Category & Minimization

_Plain-English guide for EHS managers and waste coordinators._

## What this page does

Open **Waste Management → Waste Compliance** in the left nav. It brings your
site's hazardous-waste generator status and your waste-reduction programs into
one place, with three summary cards at the top:

- **Generator category** — your current EPA status (VSQG, SQG, or LQG).
- **Prevented vs. recycled vs. landfilled (YTD)** — how this year's waste splits
  across true prevention, recycling, and landfill.
- **Open compliance actions** — anything the system has flagged for follow-up.

## Generator category — how it's worked out

Each month, SafetyIQ adds up the hazardous waste your site reported and works out
your EPA generator category:

| Category | What it means | Monthly threshold |
| --- | --- | --- |
| **VSQG** | Very Small Quantity Generator | Under 100 kg hazardous _and_ under 1 kg acute |
| **SQG** | Small Quantity Generator | 100 to under 1,000 kg hazardous |
| **LQG** | Large Quantity Generator | 1,000 kg or more hazardous, **or** 1 kg or more acute |

Acute hazardous waste is treated separately: as little as **1 kg in a month**
puts you into LQG regardless of your total. The category is stored on the monthly
record and also copied onto the site itself for quick reference. **When your
category changes, an action is created automatically** so your team can respond —
it does _not_ fire on every save, only on an actual change.

## Waste-minimization programs

A program tracks a goal to reduce a specific waste stream. When you create one
you record:

- a **baseline** (the year and starting amount you're measuring against),
- a **reduction target** (a percentage — the system calculates the target
  quantity for you),
- an **owner** and a **due date**,
- optional **estimated cost and savings** (the system computes ROI), and
- later, an **effectiveness review** once the program has run.

New programs start as a **draft**. An EHS or safety manager must **approve** them
before they count as active — waste coordinators can create and edit programs but
not approve their own. If a program passes its due date without an effectiveness
review, an **overdue** action fires automatically (and stops once you record the
review).

## Waste hierarchy — prevented vs. recycled vs. landfilled

We report waste using the standard hierarchy — eliminate, substitute, reduce,
reuse, recycle, treat, dispose — and group it into three views:

- **Prevented** = eliminate + substitute + reduce (true source reduction)
- **Recycled** = reuse + recycle + treat (diverted, but not prevented)
- **Landfilled** = dispose

**Prevention and recycling are always shown separately.** That's deliberate:
progress on genuinely reducing waste at the source should never be hidden inside
recycling numbers.

## Compliance actions

The action log surfaces follow-ups for:

- **Generator-category change** (e.g. you crossed into SQG or LQG)
- **Baseline exceedance** (a program's waste went above its baseline)
- **Expired material**
- **Repeat spill**
- **Overdue minimization target**

Each action has a severity and an open/acknowledged/resolved status.

> **Note — manifest certification:** the manifest minimization-certification
> workflow from the original scope is **deferred**. This platform does not yet
> have a hazardous-waste manifest record to attach the certification to, so that
> piece is tracked as separate follow-up work rather than built here.
