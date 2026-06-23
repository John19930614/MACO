import { getEquipment } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { Gauge } from "lucide-react";
import { AddEquipmentButton } from "./AddEquipmentButton";
import { MonitoringExportButton } from "./MonitoringExportButton";
import { MonitoringDashboard } from "./MonitoringDashboard";

export default async function MonitoringPage() {
  const tenantId = await getEffectiveTenantId();
  const equipment = await getEquipment(tenantId);

  const operational    = equipment.filter((e) => e.status === "operational").length;
  const calibDue       = equipment.filter((e) => e.status === "calibration_due").length;
  const inspDue        = equipment.filter((e) => e.status === "inspection_due").length;
  const outOfService   = equipment.filter((e) => e.status === "out_of_service").length;
  const actionRequired = calibDue + inspDue + outOfService;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Monitoring & Equipment"
        subtitle="Emergency equipment inspections with auto-CAPA, exposure monitoring vs OELs, spill response, and calibration schedules"
        actions={
          <div className="flex gap-2">
            <MonitoringExportButton equipment={equipment} />
            <AddEquipmentButton />
          </div>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {equipment.length === 0 ? (
          <EmptyState
            icon={<Gauge className="h-6 w-6" />}
            title="No equipment registered yet"
            description="Add monitoring or emergency equipment with the button above. SafetyIQ tracks calibration and inspection schedules and auto-raises CAPAs when they lapse."
          />
        ) : (
          <>
        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Total Equipment"  value={equipment.length} hint="All registered units" />
          <Stat label="Operational"      value={operational}      hint="Ready for use"     accent="#10b981" />
          <Stat label="Calibration Due"  value={calibDue}         hint="Overdue or upcoming" accent={calibDue > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Inspection Due"   value={inspDue}          hint="Overdue or upcoming" accent={inspDue > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Action Required"  value={actionRequired}   hint="Needs attention now"  accent={actionRequired > 0 ? "#dc2626" : "#10b981"} />
        </div>

        <MonitoringDashboard equipment={equipment} />
          </>
        )}
      </div>
    </div>
  );
}
