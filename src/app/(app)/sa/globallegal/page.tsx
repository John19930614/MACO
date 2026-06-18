import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";

const GLOBAL_REQS = [
  { ref: "OSHA 29 CFR 1910.1200", title: "Hazard Communication (HazCom/GHS)", jurisdictions: ["US Federal"], category: "chemical",  tenants: 4 },
  { ref: "OSHA 29 CFR 1910.1450", title: "Lab Chemical Hygiene Standard",       jurisdictions: ["US Federal"], category: "chemical",  tenants: 3 },
  { ref: "OSHA 29 CFR 1910.1048", title: "Formaldehyde Standard",               jurisdictions: ["US Federal"], category: "chemical",  tenants: 2 },
  { ref: "EPA 40 CFR 262",        title: "RCRA Hazardous Waste Generator",      jurisdictions: ["US Federal"], category: "waste",     tenants: 4 },
  { ref: "EPA 40 CFR 302",        title: "CERCLA Hazardous Substance Reporting",jurisdictions: ["US Federal"], category: "emergency", tenants: 2 },
  { ref: "CDC/NIH BSG",           title: "Biosafety in Microbiological Labs",   jurisdictions: ["US Federal"], category: "biosafety", tenants: 3 },
  { ref: "NFPA 30",               title: "Flammable & Combustible Liquids Code",jurisdictions: ["US Federal"], category: "fire",      tenants: 4 },
  { ref: "ISO 45001:2018",        title: "OHS Management System",               jurisdictions: ["International"], category: "general", tenants: 1 },
  { ref: "EU CLP 1272/2008",      title: "Classification, Labelling, Packaging",jurisdictions: ["EU"],         category: "chemical",  tenants: 0 },
];

const CAT_STYLE: Record<string, string> = {
  chemical: "bg-red-100 text-red-700",  waste: "bg-orange-100 text-orange-700",
  emergency:"bg-amber-100 text-amber-700", biosafety:"bg-purple-100 text-purple-700",
  fire:     "bg-orange-100 text-orange-700", general:"bg-blue-100 text-blue-700",
};

export default function SAGlobalLegalPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Global Legal Register"
        subtitle="Master library of regulations used across all tenants"
        actions={
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Add Regulation
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader title="Regulation Library" subtitle={`${GLOBAL_REQS.length} regulations across all jurisdictions`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Reference</th>
                  <th className="px-4 py-2.5 text-left">Title</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Jurisdictions</th>
                  <th className="px-4 py-2.5 text-center">Tenants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {GLOBAL_REQS.map((r) => (
                  <tr key={r.ref} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{r.ref}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-64">{r.title}</td>
                    <td className="px-4 py-3">
                      <Pill className={CAT_STYLE[r.category] ?? "bg-slate-100 text-slate-600"}>
                        {r.category}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      {r.jurisdictions.map((j) => (
                        <Pill key={j} className="bg-slate-100 text-slate-600 mr-1 text-xs">{j}</Pill>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{r.tenants}</td>
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
