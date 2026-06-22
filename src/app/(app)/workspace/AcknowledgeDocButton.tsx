"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle, X } from "lucide-react";
import { acknowledgeDocument } from "@/lib/actions/ehs";

interface Props {
  documentId: string;
  documentTitle: string;
  profileId: string;
}

export function AcknowledgeDocButton({ documentId, documentTitle, profileId }: Props) {
  const [open, setOpen]       = useState(false);
  const [done, setDone]       = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setPending(true);
    await acknowledgeDocument(documentId, profileId);
    setDone(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
        <CheckCircle className="h-3 w-3" /> Acknowledged
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition"
      >
        <BookOpen className="h-3 w-3" />
        Acknowledge
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-bold text-slate-800">Acknowledge Document</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 line-clamp-2 max-w-xs">{documentTitle}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                By clicking <strong>Confirm</strong>, you acknowledge that you have read and understood the contents of this document.
              </p>
              <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2.5 text-[11.5px] text-purple-700 leading-snug">
                Acknowledgment date &amp; time will be recorded as{" "}
                <strong>{new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</strong>.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {pending ? "Saving…" : "Confirm Acknowledgment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
