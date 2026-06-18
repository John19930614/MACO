import Link from "next/link";
import { getCapaActions, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { CapaStatusBadge, SeverityBadge } from "@/components/ui/badges";
import type { Severity } from "@/lib/constants";
import { AddCapaButton } from "./AddCapaButton";

const SOURCE_LABEL: Record<string, string> = {
  audit_finding:    "Audit",
  incident:         "Incident",
  legal_requirement:"Legal",
  risk_assessment:  "Risk",
  ai_finding:       "AI Finding",
  manual:           "Manual",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(s: string | null): boolean {
  if (!s) return false;
  return new Date(s) < new Date();
}

export default async function CapaPage() {
  const capas    = await getCapaActions();
  const profiles = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const open                = capas.filter((c) => c.status === "open").length;
  const inProgress          = capas.filter((c) => c.status === "in_progress").length;
  const overdue             = capas.filter((c) => c.status === "overdue").length;
  const pendingVerification = capas.filter((c) => c.status === "pending_verification").length;
  const closed              = capas.filter((c) => c.status === "closed").length;

  const openActions = capas.filter(
    (c) => c.status !== "closed" && c.status !== "rejected",
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Corrective Actions"
        subtitle="Corrective and preventive actions — audit findings, incidents, AI flags"
        actions={
          <AddCapaButton />
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="Open"                value={open}                hint="Awaiting start"       accent="#2563eb" />
          <Stat label="In Progress"         value={inProgress}          hint="Active actions"        accent="#f59e0b" />
          <Stat label="Overdue"             value={overdue}             hint="Past due date"         accent={overdue > 0 ? "#dc2626" : "#10b981"} />
          <Stat label="Pending Verif."      value={pendingVerification} hint="Awaiting sign-off"     accent="#7c3aed" />
          <Stat label="Closed"              value={closed}              hint="Completed & verified"  accent="#10b981" />
        </div>

        {/* Overdue alert */}
        {overdue > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {overdue} Overdue CAPA Action{overdue > 1 ? "s" : ""} — Immediate Attention Required
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              {capas
                .filter((c) => c.status === "overdue")
                .map((c) => c.title)
                .join(" · ")}
            </div>
          </div>
        )}

        {/* CAPA table */}
        <Card>
          <CardHeader
            title="All CAPA Actions"
            subtitle={`${openActions.length} open · ${closed} closed`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Action</th>
                  <th className="px-4 py-2.5 text-left">Kind</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Source</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-left">Due Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {capas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 max-w-64">
                      <Link href={`/capa/${c.id}`} className="font-medium text-blue-700 hover:underline">
                        {c.title}
                      </Link>
                      {c.root_cause && (
                        <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                          Root cause: {c.root_cause}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={c.kind === "corrective" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                        {c.kind === "corrective" ? "Corrective" : "Preventive"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={c.severity as Severity} />
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-xs">
                        {SOURCE_LABEL[c.source_type] ?? c.source_type}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.owner_id ? (profileMap[c.owner_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <span className={isOverdue(c.due_date) && c.status !== "closed" ? "font-semibold text-red-600" : "text-slate-600"}>
                        {fmt(c.due_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CapaStatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
