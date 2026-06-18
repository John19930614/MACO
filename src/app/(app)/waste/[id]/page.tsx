import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWasteStreamById } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditWasteForm } from "./EditWasteForm";

const CLASS_STYLE: Record<string, string> = {
  hazardous:    "bg-red-100 text-red-700",
  non_hazardous:"bg-emerald-100 text-emerald-700",
  clinical:     "bg-orange-100 text-orange-700",
  radioactive:  "bg-purple-100 text-purple-700",
  recyclable:   "bg-blue-100 text-blue-700",
  general:      "bg-slate-100 text-slate-600",
};

export default async function WasteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = await getWasteStreamById(id);
  if (!stream) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={stream.waste_name}
        subtitle={`Waste Stream · ${stream.disposal_method.replace(/_/g, " ")}`}
        actions={
          <Link href="/waste" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to Waste
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Waste Stream</h2>
              <Pill className={CLASS_STYLE[stream.classification] ?? "bg-slate-100 text-slate-600"}>
                {stream.classification.replace(/_/g, " ")}
              </Pill>
            </div>
            <EditWasteForm stream={stream} />
          </div>
        </div>
      </div>
    </div>
  );
}
