import { Card, CardHeader } from "@/components/ui/primitives";
import { Badge } from "./badges";
import { EmptyStateCard } from "./states";
import { RISK_META } from "@/lib/devcenter/labels";
import { relativeTime } from "@/lib/utils";
import { Bot, User, Cog } from "lucide-react";
import type { DevAuditEntry, AuditActorType } from "@/lib/devcenter/types";

const ACTOR_META: Record<AuditActorType, { label: string; icon: typeof Bot; tone: "info" | "success" | "neutral" }> = {
  agent:  { label: "AI agent", icon: Bot,  tone: "info" },
  human:  { label: "You",      icon: User, tone: "success" },
  system: { label: "System",   icon: Cog,  tone: "neutral" },
};

/**
 * A readable history of everything the team and the operator did. Append-only —
 * this is the record later phases lean on.
 */
export function AuditLogTable({ entries }: { entries: DevAuditEntry[] }) {
  const ordered = [...entries].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return (
    <Card>
      <CardHeader title="Activity log" subtitle="A record of every important action — newest first" />
      <div className="p-2 sm:p-4">
        {ordered.length === 0 ? (
          <EmptyStateCard title="No activity recorded yet" description="Actions taken by you and the AI team will be listed here." />
        ) : (
          <>
            {/* Table on tablet/desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-700">
                    <th className="py-2 pr-3 font-semibold">Who</th>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                    <th className="py-2 pr-3 font-semibold">Item</th>
                    <th className="py-2 pr-3 font-semibold">Risk</th>
                    <th className="py-2 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {ordered.map((e) => {
                    const actor = ACTOR_META[e.actor_type];
                    const Icon = actor.icon;
                    return (
                      <tr key={e.id} className="text-slate-600 dark:text-slate-300">
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-slate-400" />
                            {e.actor_id ?? actor.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">{e.action}</td>
                        <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-400">{e.entity ?? "—"}</td>
                        <td className="py-2.5 pr-3">{e.risk_level ? <Badge label={RISK_META[e.risk_level].label} tone={RISK_META[e.risk_level].tone} /> : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2.5 text-xs text-slate-400">{relativeTime(e.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Stacked list on mobile */}
            <ul className="space-y-2 sm:hidden">
              {ordered.map((e) => {
                const actor = ACTOR_META[e.actor_type];
                const Icon = actor.icon;
                return (
                  <li key={e.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Icon className="h-3.5 w-3.5 text-slate-400" /> {e.actor_id ?? actor.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{relativeTime(e.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{e.action}</p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
