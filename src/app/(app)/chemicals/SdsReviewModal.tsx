"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, FileText, Loader2 } from "lucide-react";
import { Modal } from "@/components/modals/Modal";
import { GhsCodePicker } from "./GhsCodePicker";
import { approveSdsExtraction, rejectSdsExtraction } from "@/lib/actions/sds";
import type { SdsDocument, SdsExtracted } from "@/lib/types";

const GHS_COLORS: Record<string, string> = {
  GHS01: "bg-red-100 text-red-700 border-red-200",
  GHS02: "bg-orange-100 text-orange-700 border-orange-200",
  GHS03: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GHS04: "bg-blue-100 text-blue-700 border-blue-200",
  GHS05: "bg-orange-100 text-orange-700 border-orange-200",
  GHS06: "bg-red-100 text-red-800 border-red-300",
  GHS07: "bg-amber-100 text-amber-700 border-amber-200",
  GHS08: "bg-purple-100 text-purple-700 border-purple-200",
  GHS09: "bg-green-100 text-green-700 border-green-200",
};
const GHS_NAMES: Record<string, string> = {
  GHS01: "Explosive", GHS02: "Flammable", GHS03: "Oxidizer",
  GHS04: "Gas", GHS05: "Corrosive", GHS06: "Toxic",
  GHS07: "Irritant", GHS08: "Health Hazard", GHS09: "Environmental",
};

interface Props {
  doc: SdsDocument;
  open: boolean;
  onClose: () => void;
}

export function SdsReviewModal({ doc, open, onClose }: Props) {
  const ext = doc.ai_extraction_json;
  const router = useRouter();

  // Editable overrides — user can fix obvious extraction errors before approving
  const [productName, setProductName] = useState(ext?.product_name ?? "");
  const [casNumber, setCasNumber]     = useState(ext?.cas_number ?? "");
  const [manufacturer, setManuf]      = useState(ext?.manufacturer ?? "");
  const [hazardCodes, setHazardCodes] = useState<string[]>(ext?.hazard_statements ?? []);
  const [precautionCodes, setPrecautionCodes] = useState<string[]>(ext?.precautionary_statements ?? []);
  const [notes, setNotes]             = useState("");
  const [pending, setPending]         = useState<"approve" | "reject" | null>(null);
  const [done, setDone]               = useState<"approved" | "rejected" | null>(null);
  const [err, setErr]                 = useState("");

  async function handleApprove() {
    setPending("approve");
    setErr("");
    const overrides: Partial<SdsExtracted> = {};
    if (productName !== ext?.product_name) overrides.product_name = productName;
    if (casNumber   !== ext?.cas_number)   overrides.cas_number   = casNumber;
    if (manufacturer !== ext?.manufacturer) overrides.manufacturer = manufacturer;
    // Reviewer corrections to the GHS classification flow straight into the
    // chemical_inventory record (approveSdsExtraction merges overrides).
    if (hazardCodes.join() !== (ext?.hazard_statements ?? []).join())
      overrides.hazard_statements = hazardCodes;
    if (precautionCodes.join() !== (ext?.precautionary_statements ?? []).join())
      overrides.precautionary_statements = precautionCodes;

    const res = await approveSdsExtraction(doc.id, overrides, notes);
    setPending(null);
    if (!res.ok) { setErr(res.error); return; }
    setDone("approved");
    router.refresh();
  }

  async function handleReject() {
    setPending("reject");
    setErr("");
    const res = await rejectSdsExtraction(doc.id, notes);
    setPending(null);
    if (!res.ok) { setErr(res.error); return; }
    setDone("rejected");
    router.refresh();
  }

  const confidence = doc.ai_confidence_score ?? 0;
  const confColor = confidence >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : confidence >= 60 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  return (
    <Modal open={open} onClose={onClose} title={`SDS Review — ${doc.file_name}`} width="max-w-2xl">
      <div className="flex flex-col gap-5 px-6 py-5">

        {/* Completed state */}
        {done === "approved" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">Chemical record created and added to inventory</p>
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        )}
        {done === "rejected" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <XCircle className="h-12 w-12 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">SDS marked as rejected</p>
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        )}

        {!done && !ext && (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
            <FileText className="h-8 w-8" />
            <p className="text-sm">No extraction data available for this document.</p>
          </div>
        )}

        {!done && ext && (
          <>
            {/* Header strip: confidence + signal word + pictograms */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${confColor}`}>
                {confidence}% confidence
              </span>
              {ext.signal_word && (
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${ext.signal_word === "Danger" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {ext.signal_word.toUpperCase()}
                </span>
              )}
              {ext.ghs_pictogram_codes.map((code) => (
                <span key={code} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GHS_COLORS[code] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {code} {GHS_NAMES[code]}
                </span>
              ))}
            </div>

            {/* Editable key fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Product Name *</label>
                <input value={productName} onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">CAS Number</label>
                <input value={casNumber} onChange={(e) => setCasNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Manufacturer</label>
                <input value={manufacturer} onChange={(e) => setManuf(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>

            {/* Editable GHS classification — reviewer can correct the AI before approving */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Hazard Statements (editable)
                </p>
                <GhsCodePicker mode="hazard" defaultCodes={ext.hazard_statements} onChange={setHazardCodes} />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Precautionary Statements (editable)
                </p>
                <GhsCodePicker mode="precaution" defaultCodes={ext.precautionary_statements} onChange={setPrecautionCodes} />
              </div>
            </div>

            {/* Read-only extracted detail */}
            <div className="grid grid-cols-2 gap-4">
              {/* PPE */}
              {ext.recommended_ppe.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">PPE Required</p>
                  <ul className="space-y-0.5">
                    {ext.recommended_ppe.map((p) => (
                      <li key={p} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Storage */}
              {ext.storage_requirements.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Storage Requirements</p>
                  <ul className="space-y-0.5">
                    {ext.storage_requirements.map((s) => (
                      <li key={s} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Disposal */}
            {ext.disposal_guidance && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Disposal Guidance</p>
                <p className="text-xs text-slate-600 leading-relaxed">{ext.disposal_guidance}</p>
              </div>
            )}

            {/* Review notes */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Review Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any corrections or observations about this extraction…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              />
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!pending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {pending === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={!productName || !!pending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {pending === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Approve &amp; Add to Inventory
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
