import { z } from "zod";

// Persisted audit conduct snapshot (audit.notes, stored as JSON). Historically
// saved in two shapes — a bare `items` array, or `items` nested inside
// `{ items, oshaStandard }` — so every field is optional and unknown extras
// are passed through rather than rejected. `items` itself is left as
// `unknown`; parseSavedAudit() narrows it further based on which shape it finds.
export const rawAuditNotesSchema = z
  .object({
    conductedBy: z.string().optional(),
    conductedDate: z.string().optional(),
    score: z.number().optional(),
    overallNotes: z.string().optional(),
    oshaStandard: z
      .object({ code: z.string(), title: z.string(), cfr: z.string() })
      .nullable()
      .optional(),
    items: z.unknown().optional(),
  })
  .passthrough();

export type RawAuditNotes = z.infer<typeof rawAuditNotesSchema>;
