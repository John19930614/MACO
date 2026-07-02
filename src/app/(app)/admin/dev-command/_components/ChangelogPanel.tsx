import { Card, CardHeader } from "@/components/ui/primitives";
import { FileText } from "lucide-react";
import type { ReleaseSection } from "@/lib/devcenter/release";

/** The generated changelog / release notes (9 sections). Display only. */
export function ChangelogPanel({ sections }: { sections: ReleaseSection[] }) {
  return (
    <Card>
      <CardHeader title="Changelog / release notes" subtitle="Generated from this task's records" right={<FileText className="h-4 w-4 text-slate-300" />} />
      <div className="space-y-3 p-4">
        {sections.map((s) => (
          <div key={s.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            {s.lines.length === 1 ? (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{s.lines[0]}</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {s.lines.map((l, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-slate-600 dark:text-slate-300"><span className="text-slate-300">•</span> {l}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
