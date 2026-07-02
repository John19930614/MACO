# Experience Review Guide — Dev Command Center

> **Who this is for:** Admins who want to understand what the Experience agent checks and what to do when scores are too low.

---

## What is the Experience review?

Before any change can be released, the Experience agent checks it from the user's point of view. The goal is to make sure that every change to SafetyIQ is:

- Easy to understand without training
- Consistent with how the rest of the platform looks and feels
- Helpful when things go wrong (good error messages)
- Usable by everyone, including people with disabilities
- Readable on a phone or tablet

If a change scores too low in any area, it is flagged as a required fix and must be addressed before the release can go ahead.

---

## The 5 experience dimensions

### 1. Clarity
**What it means:** Is the change easy to understand at a glance?

**Good signs:** Labels are plain English. Buttons say what they do. Empty states explain what to do next.

**Bad signs:** Jargon or technical terms in labels. Buttons that say "Submit" with no context. Blank screens with no explanation.

**Example of a required fix:** "The button label 'Execute migration' should say 'Apply changes' so non-technical users understand it."

---

### 2. Consistency
**What it means:** Does the change look and behave like the rest of SafetyIQ?

**Good signs:** Uses the same colours, fonts, spacing, and component patterns as the rest of the platform. Follows the same interaction patterns (e.g. the same way to confirm a destructive action).

**Bad signs:** A different shade of blue. A modal where the platform uses a drawer. A different button shape.

**Example of a required fix:** "The error banner uses a red border with a white background — use the platform's standard red background (bg-red-50) instead."

---

### 3. Error handling
**What it means:** When something goes wrong, does the change help the user understand what happened and what to do next?

**Good signs:** Errors show in plain English. The user knows whether to try again, contact support, or change their input. The system doesn't silently fail.

**Bad signs:** A blank screen after an error. A raw error code ("Error 500"). No feedback after submitting a form.

**Example of a required fix:** "If the export fails, show a message: 'The export could not be completed. Try again in a moment.'"

---

### 4. Accessibility
**What it means:** Can all users interact with the change — including keyboard-only users and people using screen readers?

**Good signs:** All interactive elements are reachable by Tab key. Buttons and links have descriptive text (not "click here"). Colour is not the only way to convey meaning (e.g. red and an icon for errors, not just red).

**Bad signs:** A button that only works by clicking with a mouse. An icon with no label or tooltip. A colour-only status indicator.

**Example of a required fix:** "The status dot uses colour only — add a text label (e.g. 'Active') so screen readers can read it."

---

### 5. Mobile
**What it means:** Does the change work on a phone or tablet screen?

**Good signs:** Text is readable without zooming. Buttons are large enough to tap. Tables and panels scroll rather than overflow.

**Bad signs:** Text cut off on small screens. Buttons too small to tap. A table that breaks the page layout on mobile.

**Example of a required fix:** "The approval card buttons are too close together on mobile — add more vertical spacing between them."

---

## Scores and what they mean

Each dimension is scored 1–5:

| Score | Meaning |
|---|---|
| **5** | Excellent — no issues |
| **4** | Good — minor improvements possible |
| **3** | Acceptable — some issues worth fixing |
| **2** | Needs work — significant issues that affect users |
| **1** | Fails — must be fixed before release |

A task needs an overall average above a minimum threshold to pass the experience gate. Any dimension scored 1 is a required fix.

---

## What happens when the experience score is too low?

1. The **Required fixes** panel appears at the top of the task detail page.
2. Each fix item explains what needs to change and why.
3. The task cannot reach the release stage until the fixes are addressed.

**Options:**

- **Address the fix** — Edit the relevant content or code, note the change in the task description, and re-run the experience review step.
- **Override the score** — If you believe the finding is not applicable for this specific change, you can resolve it manually. The override is logged with your name.
- **Ask the AI to redo the step** — Reject the experience review output and add a note about what to change. The agent will try again on the next run.

---

## Examples of experience review in action

### Example 1: A new page passes
The Code Author adds a new Incidents export page. The Experience agent reviews it and scores:
- Clarity: 5 (plain-English labels, clear button text)
- Consistency: 4 (matches the platform's existing export flow)
- Error handling: 4 (shows an error message if the export fails)
- Accessibility: 4 (keyboard navigable, all icons have labels)
- Mobile: 3 (acceptable on most screens)

Average: 4.0 — **passes**. The release checklist shows Experience: ✅.

---

### Example 2: A panel fails on accessibility
The Code Author adds a new status indicator that uses only a coloured dot to show active/inactive. The Experience agent flags:
- Accessibility: 1 — "Colour-only status indicator. Add a text label."

The required fix appears. The Code Author updates the component to show a text label alongside the dot. The experience review is re-run and the score rises to 4 — task unblocked.

---

### Example 3: A critical experience failure
A new form has no error messages at all — if the user submits incorrectly, the form just resets with no feedback. The Experience agent scores:
- Error handling: 1 — "No error feedback on form submission failure."

This becomes a required fix that blocks the release. The agent notes the specific form and what message should appear. The Code Author adds the error message and re-runs the stage.

---

## Tips for getting a good experience score

- **Write button text that says what happens:** "Download CSV" not "Submit"
- **Write empty-state messages:** Don't leave a blank panel — explain what to do next
- **Test error cases:** What happens if the user submits without filling in a required field?
- **Use the platform's existing components:** Don't invent new patterns when existing ones work
- **Add labels to icons:** A trash icon needs a "Delete" label or tooltip
