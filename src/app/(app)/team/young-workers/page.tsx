import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { getYoungWorkerAccess } from "@/lib/young-worker/access";
import { YoungWorkerList } from "@/components/team/YoungWorkerList";

export const maxDuration = 30;

// Young-worker PII is manager-only. Gate here (mirrors young_workers RLS) and
// bounce anyone else back to their dashboard rather than rendering the shell.
export default async function YoungWorkersPage() {
  const access = await getYoungWorkerAccess();
  if (!access.authorized) redirect("/dashboard");

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="Young Worker Profiles"
        subtitle="Track age, work permits, and school status for workers under 18. Visible only to safety/EHS managers and admins."
      />
      <YoungWorkerList />
    </div>
  );
}
