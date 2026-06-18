import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEquipmentById } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditEquipmentForm } from "./EditEquipmentForm";

const STATUS_STYLE: Record<string, string> = {
  operational:     "bg-emerald-100 text-emerald-700",
  calibration_due: "bg-amber-100 text-amber-700",
  inspection_due:  "bg-amber-100 text-amber-700",
  out_of_service:  "bg-red-100 text-red-700",
  decommissioned:  "bg-slate-100 text-slate-400",
};

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipment = await getEquipmentById(id);
  if (!equipment) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={equipment.name}
        subtitle={`Equipment · ${equipment.type.replace(/_/g, " ")} · ${equipment.location}`}
        actions={
          <Link href="/monitoring" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to Equipment
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Equipment</h2>
              <Pill className={STATUS_STYLE[equipment.status] ?? "bg-slate-100 text-slate-600"}>
                {equipment.status.replace(/_/g, " ")}
              </Pill>
            </div>
            <EditEquipmentForm equipment={equipment} />
          </div>
        </div>
      </div>
    </div>
  );
}
