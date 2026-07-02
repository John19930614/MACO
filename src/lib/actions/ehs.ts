// ─── EHS actions barrel (backwards-compatible entry point) ────────────────────
// The original ~2,800-line monolith was split into focused server-action
// modules; this file re-exports everything so every existing import of
// "@/lib/actions/ehs" keeps working unchanged. Add new actions to the module
// that owns the domain — this file must stay logic-free.
//
//   • ehs-records.ts    → CAPAs, incidents, chemicals, audits, risk,
//                         CAPA-from-incident/finding/trigger
//   • ehs-compliance.ts → equipment, legal, training, documents, workspace,
//                         SDS/evidence, biosafety, OSHA, exposure, ergonomics,
//                         settings, saved reports
//   • ehs-waste.ts      → waste streams/vendors/pickups/inspections + the
//                         waste-profile pipeline and wizard
//   • ehs-ai.ts         → P-Engine predictability scan, AI program builder,
//                         staged document import
//   • ehs-shared.ts     → getCtx() session-context helper (not re-exported)

export * from "./ehs-records";
export * from "./ehs-compliance";
export * from "./ehs-waste";
export * from "./ehs-ai";
