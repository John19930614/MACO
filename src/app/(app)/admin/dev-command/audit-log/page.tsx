import { AuditLogTable } from "../_components/AuditLogTable";
import { getDevAuditLog } from "@/lib/devcenter/repo";
import { SAMPLE_AUDIT } from "@/lib/devcenter/sample";

export const metadata = { title: "Activity Log · AI Dev Command Center" };

export default async function AuditLogPage() {
  const real = await getDevAuditLog({ limit: 200 });
  const usingSample = real.length === 0;
  const entries = usingSample ? SAMPLE_AUDIT : real;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Activity log</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Every important action by you and the AI team, in one place. This record can&apos;t be edited — it&apos;s the trail later phases rely on.
        </p>
        {usingSample && (
          <p className="mt-1 text-xs text-blue-500 dark:text-blue-400">
            Showing example entries — no real activity yet.
          </p>
        )}
      </div>
      <AuditLogTable entries={entries} />
    </div>
  );
}
