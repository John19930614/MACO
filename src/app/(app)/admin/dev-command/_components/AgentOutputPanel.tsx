import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { FileText, Code2, Database, BookOpen, ListChecks } from "lucide-react";
import type { DevArtifact, ArtifactKind, ArtifactStatus } from "@/lib/devcenter/types";
import type { Tone } from "@/lib/devcenter/labels";

const KIND_META: Record<ArtifactKind, { label: string; icon: typeof FileText }> = {
  plan:       { label: "Plan",          icon: ListChecks },
  design:     { label: "Design",        icon: FileText },
  sql_draft:  { label: "Database draft", icon: Database },
  code_draft: { label: "Code draft",    icon: Code2 },
  doc:        { label: "Document",      icon: BookOpen },
  summary:    { label: "Summary",       icon: FileText },
  test_plan:  { label: "Test plan",     icon: ListChecks },
  other:      { label: "Note",          icon: FileText },
};

const STATUS_TONE: Record<ArtifactStatus, Tone> = {
  draft: "neutral", proposed: "info", approved: "success",
  rejected: "neutral", applied: "success", superseded: "neutral",
  needs_review: "violet", revised: "warn", ready_for_branch: "info",
};

const STATUS_LABEL: Record<ArtifactStatus, string> = {
  draft: "Draft", proposed: "Proposed", approved: "Approved",
  rejected: "Rejected", applied: "Applied", superseded: "Replaced",
  needs_review: "Needs review", revised: "Revision requested", ready_for_branch: "Ready for branch",
};

/**
 * What the agents produced — plans, code drafts, SQL drafts, docs. These are
 * drafts only; nothing here has been applied to the real codebase or database.
 */
export function AgentOutputPanel({ artifacts }: { artifacts: DevArtifact[] }) {
  return (
    <Card>
      <CardHeader title="What the agents produced" subtitle="Drafts only — nothing here has been applied yet" />
      <div className="p-4">
        {artifacts.length === 0 ? (
          <EmptyStateCard title="No drafts yet" description="Plans, code, and SQL drafts will appear here." />
        ) : (
          <ul className="space-y-3">
            {artifacts.map((a) => {
              const meta = KIND_META[a.kind];
              const Icon = meta.icon;
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.title ?? meta.label}</p>
                        <p className="text-xs text-slate-400">{meta.label}{a.created_by ? ` · by ${a.created_by}` : ""}</p>
                      </div>
                    </div>
                    <Badge label={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />
                  </div>
                  {a.path && (
                    <p className="mt-2 truncate rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">{a.path}</p>
                  )}
                  {a.content && (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-900/95 px-3 py-2 text-[11px] leading-relaxed text-slate-200">{a.content}</pre>
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
