// Real paging (SMS / phone / on-call dispatch) is intentionally OFF for Phase 4
// of the Predictive Risk Engine. This is a plain module (not a "use server"
// file) so the flag can be imported by both the server action and its test —
// a "use server" file may only export async functions, not a boolean const.
//
// Do NOT flip this to true without ALL of:
//   1. Phase 5 statistical validation showing an acceptable false-positive rate,
//   2. written EHS-lead sign-off that the false-alarm rate is acceptable for a
//      specific real site, and
//   3. an agreed escalation ladder (who is paged first, who is backup, after
//      how long).
//
// There is deliberately NO external paging/SMS provider wired anywhere in this
// codebase. This flag documents that boundary; the Phase 4 confirm action sends
// an in-app notification ONLY and never calls an external dispatcher.
export const PAGING_ENABLED = false;
