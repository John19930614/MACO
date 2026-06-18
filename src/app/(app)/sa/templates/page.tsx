import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";

const TEMPLATES = [
  { name: "Chemical Hygiene Plan",       category: "plan",   format: "DOCX",  tenants: 3, version: "v2.1" },
  { name: "EHS Induction Package",       category: "training", format: "PDF", tenants: 4, version: "v1.4" },
  { name: "Incident Report Form",        category: "form",   format: "PDF",   tenants: 4, version: "v3.0" },
  { name: "CAPA Tracking Template",      category: "form",   format: "XLSX",  tenants: 3, version: "v1.2" },
  { name: "Risk Assessment Matrix",      category: "form",   format: "XLSX",  tenants: 4, version: "v2.0" },
  { name: "SDS Request Letter",          category: "letter", format: "DOCX",  tenants: 2, version: "v1.0" },
  { name: "Waste Manifest Template",     category: "form",   format: "PDF",   tenants: 3, version: "v1.1" },
  { name: "Audit Checklist — Lab Safety", category: "checklist", format: "PDF", tenants: 4, version: "v2.3" },
  { name: "Emergency Response Plan",     category: "plan",   format: "DOCX",  tenants: 2, version: "v1.5" },
];

const CAT_STYLE: Record<string, string> = {
  plan:       "bg-blue-100 text-blue-700",
  training:   "bg-violet-100 text-violet-700",
  form:       "bg-amber-100 text-amber-700",
  letter:     "bg-slate-100 text-slate-600",
  checklist:  "bg-emerald-100 text-emerald-700",
};

export default function SATemplatesPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Template Library"
        subtitle="Reusable EHS documents, forms, and checklists for all tenants"
        actions={
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Upload Template
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader title="Template Catalogue" subtitle={`${TEMPLATES.length} templates`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Template Name</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Format</th>
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-center">In Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {TEMPLATES.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-3">
                      <Pill className={CAT_STYLE[t.category] ?? "bg-slate-100 text-slate-600"}>
                        {t.category}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-xs">{t.format}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{t.version}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{t.tenants} tenants</td>
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
