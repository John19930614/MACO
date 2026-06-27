import { Card, CardHeader } from "@/components/ui/primitives";
import { RiskLevelBadge, Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { FilePlus2, FilePen, FileX2, FileSymlink } from "lucide-react";
import type { DevFileChangePlan, FileChangeType, FileChangeStatus } from "@/lib/devcenter/types";
import type { Tone } from "@/lib/devcenter/labels";

const CHANGE_META: Record<FileChangeType, { label: string; icon: typeof FilePlus2 }> = {
  create: { label: "New file",     icon: FilePlus2 },
  modify: { label: "Edit file",    icon: FilePen },
  delete: { label: "Remove file",  icon: FileX2 },
  rename: { label: "Rename file",  icon: FileSymlink },
};

const STATUS_TONE: Record<FileChangeStatus, Tone> = {
  proposed: "info", approved: "success", rejected: "neutral", applied: "success",
};
const STATUS_LABEL: Record<FileChangeStatus, string> = {
  proposed: "Proposed", approved: "Approved", rejected: "Rejected", applied: "Applied",
};

/**
 * Proposed file changes for a task — what the team WANTS to change, before any
 * of it is saved. Nothing here is written to disk in this phase.
 */
export function FileChangePlanViewer({ plans }: { plans: DevFileChangePlan[] }) {
  return (
    <Card>
      <CardHeader title="Proposed file changes" subtitle="What the team wants to change — not saved until you approve" />
      <div className="p-4">
        {plans.length === 0 ? (
          <EmptyStateCard title="No file changes proposed" description="When the team drafts code, the affected files show up here." />
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => {
              const meta = CHANGE_META[p.change_type];
              const Icon = meta.icon;
              return (
                <li key={p.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{meta.label}</span>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{p.file_path}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RiskLevelBadge level={p.risk_level} />
                      <Badge label={STATUS_LABEL[p.status]} tone={STATUS_TONE[p.status]} />
                    </div>
                  </div>
                  {p.rationale && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.rationale}</p>}
                  {p.diff && (
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-slate-900/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200">{p.diff}</pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
