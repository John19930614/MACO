import { getSites } from "@/lib/data/repo";
import { CausalityGraph } from "@/components/causality/CausalityGraph";
import { CausalitySitePicker } from "@/components/causality/CausalitySitePicker";

export default async function CausalityPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams;
  const sites = await getSites();
  const siteId = site ?? sites[0]?.id;
  const siteName = sites.find((s) => s.id === siteId)?.name;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Causality Map</h1>
          <p className="text-sm text-slate-500">Why a risk recurs — not only where. Dashed links are AI-proposed and await human review.</p>
        </div>
        <div className="ml-auto">
          <CausalitySitePicker sites={sites} siteId={siteId} />
        </div>
      </div>
      <CausalityGraph siteId={siteId} />
    </>
  );
}
