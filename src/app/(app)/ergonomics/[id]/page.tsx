import { notFound } from "next/navigation";
import { getWorkstationById, getErgonomicsJobTasks, getCapaActions, getIncidents } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { WorkstationDetail } from "./WorkstationDetail";

export default async function ErgonomicsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getEffectiveTenantId();
  const [workstation, allTasks, allCapas, allIncidents] = await Promise.all([
    getWorkstationById(id),
    getErgonomicsJobTasks(),
    getCapaActions(tenantId),
    getIncidents(tenantId),
  ]);
  if (!workstation) notFound();

  const deptTasks = allTasks.filter(
    (t) => t.department.toLowerCase() === workstation.department.toLowerCase()
  );
  const relatedCapas = allCapas.filter(
    (c) =>
      c.status !== "closed" &&
      (c.title.toLowerCase().includes("ergonomic") ||
        c.description.toLowerCase().includes("ergonomic"))
  );
  const recentIncidents = allIncidents
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 5);

  return (
    <WorkstationDetail
      workstation={workstation}
      deptTasks={deptTasks}
      relatedCapas={relatedCapas}
      recentIncidents={recentIncidents}
    />
  );
}