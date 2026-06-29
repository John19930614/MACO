import { Card, CardHeader } from "@/components/ui/primitives";
import { PLAIN_ENGLISH_REPLACEMENTS } from "@/lib/devcenter/labels";
import { Languages, ArrowRight } from "lucide-react";

/** Reference table of technical terms → their plain-English replacements. */
export function PlainEnglishTable() {
  return (
    <Card>
      <CardHeader title="Plain-English review" subtitle="Technical wording the team replaces with everyday language" right={<Languages className="h-4 w-4 text-slate-300" />} />
      <div className="p-4">
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-slate-800/60">
                <th className="px-3 py-2 font-semibold">Technical</th>
                <th className="px-3 py-2 font-semibold">Plain-English</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {PLAIN_ENGLISH_REPLACEMENTS.map((r) => (
                <tr key={r.technical}>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.technical}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      <ArrowRight className="h-3 w-3 text-slate-300" /> {r.plain}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
