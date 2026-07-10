import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { getYoungWorkerAccess } from "@/lib/young-worker/access";
import { getProfiles } from "@/lib/data/repo";
import { NewYoungWorkerClient } from "@/components/team/NewYoungWorkerClient";

export const dynamic = "force-dynamic";

// Add-a-profile route. Previously missing — the list's "Add Young Worker Profile"
// CTA linked here but the page didn't exist (404) and YoungWorkerForm was never
// wired to a route. Manager/superadmin only, mirroring the list page.
export default async function NewYoungWorkerPage() {
  const access = await getYoungWorkerAccess();
  if (!access.authorized) redirect("/dashboard");

  const profiles = (await getProfiles())
    .filter((p) => !!p.display_name)
    .map((p) => ({ id: p.id, display_name: p.display_name as string }));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Add Young Worker Profile"
        subtitle="Record age, work permits, and school status for an employee under 18."
      />
      {profiles.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No employees found for your organization yet. Add team members first, then create a young-worker profile.
        </p>
      ) : (
        <NewYoungWorkerClient profiles={profiles} />
      )}
    </div>
  );
}
