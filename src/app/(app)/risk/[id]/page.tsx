import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRiskById } from "@/lib/data/ehsRepo";
import { PageHeader } from "@/components/ui/primitives";
import { RiskLevelBadge } from "@/components/ui/badges";
import type { RiskLevel } from "@/lib/constants";
import { EditRiskForm } from "./EditRiskForm";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const risk = await getRiskById(id);
  if (!risk) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={risk.title}
        subtitle={`Risk · ${risk.category} · Score ${risk.risk_score}/25`}
        actions={
          <Link href="/risk" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to Risk Register
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Risk Assessment</h2>
              <RiskLevelBadge level={risk.risk_level as RiskLevel} />
            </div>
            <EditRiskForm risk={risk} />
          </div>
        </div>
      </div>
    </div>
  );
}
