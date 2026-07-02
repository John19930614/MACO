import { notFound } from "next/navigation";
import { BuildSmartChemicalPassport } from "@/components/chemicals/BuildSmartChemicalPassport";
import { PassportActions } from "@/components/chemicals/PassportActions";
import { getChemicalPassportData } from "@/lib/actions/build-smart-chemical-passport";
import type { ChemicalPassportData } from "@/types/chemical-passport";

export const metadata = { title: "Smart Chemical Passport · SafetyIQ" };

export default async function SmartChemicalPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: ChemicalPassportData;
  try {
    data = await getChemicalPassportData(id);
  } catch {
    notFound();
  }

  return (
    <div className="iq-scroll h-full overflow-y-auto bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Chemical Passport Label</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review the auto-populated label below. Check any flagged fields, then print or export it for the container.
          </p>
        </div>

        <PassportActions
          chemicalId={id}
          containerCapacity={data.containerCapacity}
          containerCapacityUnit={data.containerCapacityUnit}
        />

        <BuildSmartChemicalPassport data={data} />
      </div>
    </div>
  );
}
