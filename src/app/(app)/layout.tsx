import { LeftNav } from "@/components/layout/LeftNav";
import { TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GusStatusBriefing } from "@/components/layout/GusStatusBriefing";
import { GusMaintenancePanel } from "@/components/layout/GusMaintenancePanel";
import { AssistantDrawer } from "@/components/layout/AssistantDrawer";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { ModuleGateClient } from "@/components/layout/ModuleGateClient";
import { DemoUserProvider } from "@/lib/context/demo-user";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GuidedTour } from "@/components/tour/GuidedTour";
import { getCapaActions, getRiskAssessments, getWorkspaceTasks, getIncidents } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId, getServerUser, getServerProfileId } from "@/lib/auth/session";
import type { NotifItem } from "@/components/layout/NotificationsDropdown";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [serverUser, effectiveTenantId, profileId] = await Promise.all([
    getServerUser(),
    getEffectiveTenantId(),
    getServerProfileId(),
  ]);

  const [capas, risks, tasks, incidents] = await Promise.all([
    getCapaActions(effectiveTenantId),
    getRiskAssessments(effectiveTenantId),
    getWorkspaceTasks(profileId, effectiveTenantId),
    getIncidents(effectiveTenantId),
  ]);

  const now = new Date();

  const openCapas     = capas.filter((c) => c.status === "open" || c.status === "in_progress" || c.status === "overdue").length;
  const openRisks     = risks.filter((r) => r.status === "active" && (r.risk_level === "high" || r.risk_level === "extreme")).length;
  const pendingTasks  = tasks.filter((t) => t.status !== "done").length;
  const openIncidents = incidents.filter((i) => i.status === "reported" || i.status === "under_investigation").length;

  // Build notification items from live data
  const capaNotifs: NotifItem[] = capas
    .filter(
      (c) =>
        c.status === "overdue" ||
        ((c.status === "open" || c.status === "in_progress") &&
          c.due_date != null &&
          new Date(c.due_date) < now)
    )
    .slice(0, 4)
    .map((c) => ({
      id:       c.id,
      type:     "capa" as const,
      title:    c.title,
      href:     `/capa/${c.id}`,
      tag:      c.status === "overdue" ? "CAPA Overdue" : "Due Soon",
      severity: "high" as const,
      date:     c.due_date ?? c.created_at,
    }));

  const incidentNotifs: NotifItem[] = incidents
    .filter(
      (i) =>
        (i.severity === "high" || i.severity === "critical") &&
        (i.status === "reported" || i.status === "under_investigation")
    )
    .slice(0, 3)
    .map((i) => ({
      id:       i.id,
      type:     "incident" as const,
      title:    i.title,
      href:     `/incidents/${i.id}`,
      tag:      i.severity === "critical" ? "Critical" : "High Severity",
      severity: i.severity === "critical" ? ("critical" as const) : ("high" as const),
      date:     i.occurred_at,
    }));

  const riskNotifs: NotifItem[] = risks
    .filter(
      (r) =>
        (r.risk_level === "high" || r.risk_level === "extreme") &&
        r.status === "active"
    )
    .slice(0, 3)
    .map((r) => ({
      id:       r.id,
      type:     "risk" as const,
      title:    r.title,
      href:     `/risk/${r.id}`,
      tag:      "High Risk",
      severity: "high" as const,
      date:     r.review_date ?? r.created_at,
    }));

  const notifItems: NotifItem[] = [...capaNotifs, ...incidentNotifs, ...riskNotifs];
  const notifCount = notifItems.length;

  return (
    <DemoUserProvider serverUser={serverUser}>
      <AuthGuard>
        <GusStatusBriefing />
        <GusMaintenancePanel capas={capas} incidents={incidents} />
        <AssistantDrawer />
        <MobileNavDrawer />
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <TopBar notifCount={notifCount} notifItems={notifItems} serverUser={serverUser} />
          <CommandPalette />
          <div className="flex flex-1 overflow-hidden">
            <div className="hidden md:block print:hidden" data-tour="left-nav">
              <LeftNav openCapas={openCapas} openRisks={openRisks} pendingTasks={pendingTasks} serverUser={serverUser} />
            </div>
            <main id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ModuleGateClient>
                {children}
              </ModuleGateClient>
            </main>
          </div>
        </div>
        <GuidedTour />
      </AuthGuard>
    </DemoUserProvider>
  );
}
