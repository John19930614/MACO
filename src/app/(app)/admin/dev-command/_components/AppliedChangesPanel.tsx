import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { FileCheck2, Undo2 } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import type { DevAppliedChange } from "@/lib/devcenter/types";

/**
 * The staging "working area" — approved drafts that have been applied here (not
 * to the real codebase). Each shows its rollback note. Display only.
 */
export function AppliedChangesPanel({ changes }: { changes: DevAppliedChange[] }) {
  if (changes.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Applied changes (working area)"
        subtitle="Approved drafts staged here — nothing has been written to your real codebase or production"
        right={<FileCheck2 className="h-4 w-4 text-slate-300" />}
      />
      <div className="space-y-2 p-4">
        {changes.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{c.file_path}</span>
              <div className="flex items-center gap-1.5">
                {c.dangerous && <Badge label="Was dangerous path" tone="warn" />}
                <Badge label={c.status === "applied" ? "Applied (staged)" : "Rolled back"} tone={c.status === "applied" ? "success" : "neutral"} />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Applied {relativeTime(c.applied_at)}{c.applied_by ? ` by ${c.applied_by}` : ""}</p>
            {c.rollback_note && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Undo2 className="mt-0.5 h-3 w-3 shrink-0" /> {c.rollback_note}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
