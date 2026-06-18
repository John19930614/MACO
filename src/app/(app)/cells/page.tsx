import Link from "next/link";
import { getCells, getSites, getLocations } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/primitives";
import { SeverityBadge, StatusBadge } from "@/components/ui/badges";
import { relativeTime } from "@/lib/utils";

export default async function CellsPage() {
  const [cells, sites, locations] = await Promise.all([getCells(), getSites(), getLocations()]);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "—";
  const locName = (id: string) => locations.find((l) => l.id === id)?.label ?? "—";

  return (
    <>
      <PageHeader title="Safety Cells" subtitle={`${cells.length} living risk records`} />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Severity</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Risk</th>
                <th className="px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cells.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/cells/${c.id}`} className="font-medium text-slate-800 hover:text-[var(--color-pclss)] hover:underline">
                      {c.title}
                    </Link>
                    <div className="text-xs text-slate-400">{siteName(c.site_id)} · {c.task}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{locName(c.location_id)}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{c.risk_score}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{relativeTime(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
