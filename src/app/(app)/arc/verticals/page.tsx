import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSites } from "@/lib/data/repo";
import { PageHeader, Card } from "@/components/ui/primitives";
import { GUS_VERTICALS, GUS, VELA } from "@/lib/arc/arc";

export default async function VerticalsPage() {
  const sites = await getSites();
  const activeVerticals = new Set(sites.map((s) => s.vertical));
  const icons = Lucide as unknown as Record<string, LucideIcon>;

  return (
    <>
      <PageHeader title="GUS Verticals" subtitle={`${GUS.summary}`} />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--color-engine)" }}>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">{VELA.code}</span>
            <span className="text-sm font-semibold text-white">{VELA.title}</span>
          </div>
          <p className="p-4 text-sm text-slate-600">{VELA.summary}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GUS_VERTICALS.map((v) => {
            const Icon = icons[v.icon] ?? Lucide.Box;
            const live = activeVerticals.has(v.slug);
            return (
              <Card key={v.slug} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: live ? "var(--color-pclss)" : "#e2e8f0" }}>
                  <Icon className="h-5 w-5" style={{ color: live ? "#fff" : "#64748b" }} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{v.name}</div>
                  <div className="text-[11px] text-slate-400">{live ? "Live engine" : "Available"}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
