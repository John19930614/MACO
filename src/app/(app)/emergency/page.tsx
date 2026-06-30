import Link from "next/link";
import { Pencil, Printer, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { getEap } from "@/lib/actions/eap";
import { EapView } from "./EapView";
import { PrintButton } from "./PrintButton";

export default async function EmergencyPage() {
  const eap = await getEap();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Emergency Action Plan"
        subtitle="Emergency contacts, procedures, and response plan — post at all emergency stations"
        actions={
          <div className="flex items-center gap-2">
            {eap && <PrintButton />}
            <Link
              href="/emergency/edit"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
            >
              <Pencil className="h-4 w-4" />
              {eap ? "Edit Plan" : "Set Up Plan"}
            </Link>
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {!eap ? (
          <div className="mx-auto max-w-xl mt-16 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No Emergency Action Plan yet</h2>
            <p className="text-slate-500 mb-6">
              Set up your facility&apos;s emergency contacts, muster points, hospital route, and response procedures.
              Once configured, this plan can be printed and posted at all emergency stations.
            </p>
            <Link
              href="/emergency/edit"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700 transition"
            >
              <AlertTriangle className="h-4 w-4" />
              Set Up Emergency Action Plan
            </Link>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            <EapView eap={eap} />
          </div>
        )}
      </div>
    </div>
  );
}
