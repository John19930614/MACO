import { notFound } from "next/navigation";
import { getBiosafetyLabById, getBiohazardAgents, getIncidents } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { LabDetail } from "./LabDetail";

export default async function BiosafetyLabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getEffectiveTenantId();
  const [lab, agents, allIncidents] = await Promise.all([
    getBiosafetyLabById(id),
    getBiohazardAgents(),
    getIncidents(tenantId),
  ]);
  if (!lab) notFound();

  const recentIncidents = allIncidents
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 5);

  return <LabDetail lab={lab} agents={agents} incidents={recentIncidents} />;
}