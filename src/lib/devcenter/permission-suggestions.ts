/**
 * Suggested permissions for a dev task, derived from the intake form's plain-
 * language fields. Same pattern as the other Dev Command planners
 * (planning-agents.ts, security-review.ts): deterministic rules presented as
 * the AI team's recommendation — pure and unit-testable, no model call.
 *
 * The suggestions only pre-fill the opt-in checkboxes; the human still ticks
 * (or unticks) them and still approves every action later. Human approval is
 * never suggested away — it is not user-disablable at all.
 */

export type DevPermissionName =
  | "database_changes_allowed"
  | "file_changes_allowed"
  | "github_branch_allowed"
  | "deployment_allowed";

export interface PermissionSuggestion {
  name: DevPermissionName;
  reason: string;
}

export interface PermissionSuggestionInput {
  title?: string;
  business_goal?: string;
  feature_description?: string;
  module_affected?: string;
  risk_level?: string;
  data_involved?: string;
  success_criteria?: string;
  notes?: string;
}

// Words that imply new information must be stored or tracked.
const DB_WORDS =
  /\b(save|sav(?:e|ing)|store|stor(?:e|ing|age)|record|field|column|database|table|history|track|log|remember|keep|archive|import|upload)\w*\b/i;

// Words that imply building or changing something in the app.
const CODE_WORDS =
  /\b(add|build|creat\w*|fix|chang\w*|updat\w*|remov\w*|improv\w*|show|display|mak\w*|new|button|feature|export|report|page|move|rename|hide)\w*\b/i;

// Words that imply the requester wants to see/click through the result.
const PREVIEW_WORDS =
  /\b(look|preview|see|design|style|layout|screen|page|button|colou?rs?|theme|click|review it|try it|demo)\w*\b/i;

/**
 * Recommend which opt-in permissions the AI team will likely need for the task
 * as described. Returns an empty list when nothing has been written yet, so the
 * UI can ask for a description first instead of guessing.
 */
export function suggestPermissions(input: PermissionSuggestionInput): PermissionSuggestion[] {
  const text = [
    input.title,
    input.business_goal,
    input.feature_description,
    input.data_involved,
    input.success_criteria,
    input.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) return [];

  const suggestions: PermissionSuggestion[] = [];

  const wantsDb = DB_WORDS.test(text) || input.module_affected === "Database";
  if (wantsDb) {
    suggestions.push({
      name: "database_changes_allowed",
      reason:
        "You're asking to save or track new information, so the team will likely propose storing it — you'd still review the change first.",
    });
  }

  if (CODE_WORDS.test(text) || wantsDb) {
    suggestions.push({
      name: "file_changes_allowed",
      reason:
        "Building or changing anything in the app means proposing edits to its code — you'll see the exact changes before they're saved.",
    });
  }

  const risky = input.risk_level === "medium" || input.risk_level === "high" || input.risk_level === "critical";
  const wantsPreview = PREVIEW_WORDS.test(text);

  if (risky || wantsDb || wantsPreview) {
    suggestions.push({
      name: "github_branch_allowed",
      reason: risky
        ? "You rated this a bigger change, so testing it in a safe copy of the code first is the careful route."
        : "A safe testing area lets the team try the change without touching the real app.",
    });
  }

  if (wantsPreview || risky) {
    suggestions.push({
      name: "deployment_allowed",
      reason:
        "A private test version lets you click through the result and decide before anything goes live.",
    });
  }

  return suggestions;
}
