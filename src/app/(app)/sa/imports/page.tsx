import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";

const IMPORT_HISTORY = [
  { id: "imp-001", tenant: "BioStar Research Inc.",  type: "Chemical Inventory",  records: 8,   status: "complete", date: "2026-06-10" },
  { id: "imp-002", tenant: "BioStar Research Inc.",  type: "Training Records",    records: 14,  status: "complete", date: "2026-06-10" },
  { id: "imp-003", tenant: "BioStar Research Inc.",  type: "Legal Requirements",  records: 6,   status: "complete", date: "2026-06-10" },
  { id: "imp-004", tenant: "NovaChem Solutions",     type: "Chemical Inventory",  records: 0,   status: "pending",  date: "2026-06-17" },
  { id: "imp-005", tenant: "GenTech Biopharma",      type: "SDS Documents",       records: 23,  status: "in_progress", date: "2026-06-16" },
];

const STATUS_STYLE: Record<string, string> = {
  complete:     "bg-emerald-100 text-emerald-700",
  in_progress:  "bg-amber-100 text-amber-700",
  pending:      "bg-blue-100 text-blue-700",
  failed:       "bg-red-100 text-red-700",
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SAImportsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Data Imports"
        subtitle="Client data ingestion — chemicals, training records, documents"
        actions={
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + New Import
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader title="Import History" subtitle={`${IMPORT_HISTORY.length} imports`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Tenant</th>
                  <th className="px-4 py-2.5 text-left">Data Type</th>
                  <th className="px-4 py-2.5 text-center">Records</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {IMPORT_HISTORY.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{i.tenant}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.type}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">
                      {i.records > 0 ? i.records : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(i.date)}</td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[i.status] ?? "bg-slate-100 text-slate-600"}>
                        {i.status.replace("_", " ")}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
