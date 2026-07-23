// `nfpa704_beta` feature flag — OFF by default.
//
// This feature computes safety-critical NFPA 704 postings using a worst-case-
// per-category aggregation rule that has NOT yet been signed off by an EHS /
// fire-safety subject-matter expert for this deployment. It stays hidden and
// non-functional until an EHS lead explicitly flips this flag on, AFTER that
// SME review (a manual approval gate, tracked outside the code).
//
// Enable by setting NEXT_PUBLIC_NFPA704_BETA=true in the environment. It is a
// NEXT_PUBLIC_* var so the same value gates the nav (client) and the route/
// server action (server). Any value other than the exact string "true" = off.

export const NFPA704_BETA_ENABLED =
  process.env.NEXT_PUBLIC_NFPA704_BETA === 'true';

export const NFPA704_BETA_DISABLED_MESSAGE =
  'NFPA 704 Ratings is in beta and turned off. It stays off until an EHS / ' +
  'fire-safety expert has signed off on the roll-up rule used for real ' +
  'building postings. Ask your EHS lead to enable the nfpa704_beta flag.';
