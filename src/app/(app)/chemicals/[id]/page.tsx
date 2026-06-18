import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getChemicalById } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditChemicalForm } from "./EditChemicalForm";

export default async function ChemicalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chemical = await getChemicalById(id);
  if (!chemical) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={chemical.name}
        subtitle={`Chemical · ${chemical.storage_location}`}
        actions={
          <Link
            href="/chemicals"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chemicals
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Chemical</h2>
              <div className="flex gap-2">
                {chemical.is_scheduled && (
                  <Pill className="bg-orange-100 text-orange-700">Scheduled</Pill>
                )}
                <Pill className="bg-slate-100 text-slate-600 capitalize">{chemical.status}</Pill>
              </div>
            </div>
            <EditChemicalForm chemical={chemical} />
          </div>
        </div>
      </div>
    </div>
  );
}
