# Risk Matrix View

The Risk page now has two ways to look at your risk assessments:

- **List View** — the existing dashboard (overview, heat map, trends, risk register, and AI actions). This is the default.
- **Matrix View** — a 5×5 grid that plots every risk assessment visually, the way it's usually shown in safety meetings and audits.

Use the **List View / Matrix View** buttons at the top of the Risk page to switch between them. Switching is instant — nothing reloads and no data is re-fetched.

## How to read the grid

- **Rows** answer: *How likely is it to happen?* (from Almost Certain at the top down to Rare at the bottom)
- **Columns** answer: *How serious would it be?* (from Negligible on the left to Catastrophic on the right)
- Each **dot** is one risk. Click a dot to open its full details.
- If a cell has more than one risk, hover over (or tab to) the dots to see a short list, then click the one you want.

## What the colors mean

- **Green** = Low risk
- **Amber** = Medium risk
- **Red** = High risk
- **Dark red** = Extreme risk — stop the activity and take immediate action

## If the grid looks empty

- If the whole grid area shows a message instead of a grid, it means there are no risk assessments yet for your organization — add a risk assessment first.
- If most of the grid is colored but a specific square has no dot, that simply means there are no risks currently rated at that likelihood/consequence combination. That's normal, not an error.

## Notes for admins

- The Matrix View does not change or add any risk data — it's a different way of looking at the same risk assessments already in the List View. It's read-only.
- Risk levels and colors match the same rules used everywhere else in SafetyIQ (`RISK_LEVEL_META` + `riskLevelFromScore`), so a risk that looks "High" in the list will also look "High" (red) in the matrix.
- The matrix pulls from the same tenant-scoped data as the List View, so tenant isolation is inherited — users only ever see their own organization's risks.
