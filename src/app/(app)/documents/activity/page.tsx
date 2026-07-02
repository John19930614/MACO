import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { DocumentActivityPanel } from "@/components/documents/DocumentActivityPanel";
import { getDocumentActivity } from "@/lib/actions/getDocumentActivity";

/**
 * Document Activity — a unified snapshot of the Documents & Programs module.
 * Server component; tenant-scoped data is fetched at request time via the
 * getDocumentActivity server action (no client-side org id, no placeholder).
 * Route: /documents/activity
 */
export default async function DocumentActivityPage() {
  const result = await getDocumentActivity();

  const emptyData = {
    recentlyGenerated: [],
    underReview: [],
    outstandingApprovals: [],
    missingDocuments: [],
    completedExports: [],
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Document Activity"
        subtitle="Recently created, under review, awaiting approval, missing, and ready to download"
        actions={
          <Link
            href="/documents"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Back to Documents
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <DocumentActivityPanel
          data={result.success && result.data ? result.data : emptyData}
          lastRefreshed={new Date().toISOString()}
          error={result.success ? undefined : result.error}
        />
      </div>
    </div>
  );
}
