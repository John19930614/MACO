import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { ImportNotesClient } from "./ImportNotesClient";

export default function ImportNotesPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Import from Meeting Notes"
        subtitle="Upload a PDF or Word document — Claude will read it and propose tasks for you to approve or deny"
        actions={
          <Link
            href="/admin/dev-command"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dev Command
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <ImportNotesClient />
        </div>
      </div>
    </div>
  );
}
