import Link from "next/link";
import { getEquipment } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AddEquipmentButton } from "./AddEquipmentButton";

const EQUIP_STATUS_STYLE: Record<string, string> = {
  operational:     "bg-emerald-100 text-emerald-700",
  calibration_due: "bg-amber-100 text-amber-700",
  inspection_due:  "bg-amber-100 text-amber-700",
  out_of_service:  "bg-red-100 text-red-700",
  decommissioned:  "bg-slate-100 text-slate-400",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isDue(s: string | null): boolean {
  if (!s) return false;
  return new Date(s) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export default async function MonitoringPage() {
  const equipment = await getEquipment();

  const active     = equipment.filter((e) => e.status === "operational").length;
  const calDue     = equipment.filter((e) => e.status === "calibration_due" || isDue(e.next_calibration_date)).length;
  const inspDue    = equipment.filter((e) => e.status === "inspection_due" || isDue(e.next_inspection_date)).length;
  const overdue    = equipment.filter((e) => e.status === "out_of_service").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Monitoring & Equipment"
        subtitle="Calibration schedules, inspection records, and equipment status"
        actions={
          <AddEquipmentButton />
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Equipment"    value={equipment.length}  hint="All tracked items"    />
          <Stat label="Calibration Due"    value={calDue}            hint="Within 30 days"        accent={calDue > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Inspection Due"     value={inspDue}           hint="Within 30 days"        accent={inspDue > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Overdue"            value={overdue}           hint="Require urgent action"  accent={overdue > 0 ? "#dc2626" : "#10b981"} />
        </div>

        {/* Overdue alert */}
        {overdue > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {overdue} Equipment Item{overdue > 1 ? "s" : ""} Out of Service — May Not Be Used Until Serviced
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              {equipment
                .filter((e) => e.status === "out_of_service")
                .map((e) => e.name)
                .join(" · ")}
            </div>
          </div>
        )}

        {/* Equipment table */}
        <Card>
          <CardHeader title="Equipment Register" subtitle={`${equipment.length} items`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Equipment</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Last Calibration</th>
                  <th className="px-4 py-2.5 text-left">Next Calibration</th>
                  <th className="px-4 py-2.5 text-left">Next Inspection</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {equipment.map((e) => {
                  const calWarning  = isDue(e.next_calibration_date);
                  const inspWarning = isDue(e.next_inspection_date);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/monitoring/${e.id}`} className="font-medium text-blue-700 hover:underline">
                          {e.name}
                        </Link>
                        {e.serial_number && (
                          <div className="mt-0.5 text-xs font-mono text-slate-400">{e.serial_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className="bg-slate-100 text-slate-600 text-xs">
                          {e.type.replace(/_/g, " ")}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{e.location}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(e.last_calibration_date)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={calWarning ? "font-semibold text-amber-600" : "text-slate-600"}>
                          {fmt(e.next_calibration_date)}
                        </span>
                        {calWarning && <div className="text-[10px] text-amber-500 font-medium">Due soon</div>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={inspWarning ? "font-semibold text-amber-600" : "text-slate-600"}>
                          {fmt(e.next_inspection_date)}
                        </span>
                        {inspWarning && <div className="text-[10px] text-amber-500 font-medium">Due soon</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={EQUIP_STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600"}>
                          {e.status.replace(/_/g, " ")}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
                {equipment.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No equipment registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
