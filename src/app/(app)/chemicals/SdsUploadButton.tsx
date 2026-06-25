"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { Modal } from "@/components/modals/Modal";
import { uploadSdsDocument, extractSdsData } from "@/lib/actions/sds";
import type { SdsExtracted } from "@/lib/types";

type Stage = "idle" | "uploading" | "extracting" | "done" | "error";

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

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : score >= 60 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}% confidence
    </span>
  );
}

export function SdsUploadButton() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<SdsExtracted | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStage("idle");
    setFile(null);
    setError("");
    setExtracted(null);
    setDocId(null);
    setDragging(false);
  }

  function handleClose() {
    setOpen(false);
    if (stage === "done") router.refresh();
    setTimeout(reset, 300);
  }

  function pickFile(f: File) {
    if (f.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    if (f.size > 20 * 1024 * 1024) { setError("PDF must be under 20 MB."); return; }
    setError("");
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setStage("uploading");
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const up = await uploadSdsDocument(fd);

    if (!up.ok) { setError(up.error); setStage("error"); return; }

    setDocId(up.docId);
    setStage("extracting");

    const ex = await extractSdsData(up.docId);
    if (!ex.ok) { setError(ex.error); setStage("error"); return; }

    setExtracted(ex.extracted);
    setStage("done");
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload SDS
      </button>

      <Modal open={open} onClose={handleClose} title="Upload Safety Data Sheet" width="max-w-lg">
        <div className="flex flex-col gap-5 px-6 py-5">

          {/* Idle — dropzone */}
          {stage === "idle" && (
            <>
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors cursor-pointer
                  ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
                onClick={() => inputRef.current?.click()}
              >
                <FileText className="h-10 w-10 text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Drop your SDS PDF here</p>
                  <p className="text-xs text-slate-400 mt-0.5">or click to browse · PDF only · max 20 MB</p>
                </div>
                <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              </div>

              {file && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="text-slate-300 hover:text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-1">
                <button onClick={handleClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Upload &amp; Extract
                </button>
              </div>
            </>
          )}

          {/* Uploading */}
          {stage === "uploading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">Uploading PDF…</p>
                <p className="text-xs text-slate-400 mt-0.5">{file?.name}</p>
              </div>
            </div>
          )}

          {/* Extracting */}
          {stage === "extracting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">AI reading SDS…</p>
                <p className="text-xs text-slate-400 mt-0.5">Claude is extracting all GHS data · typically 15–30 s</p>
              </div>
              <div className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-violet-700">
                Extracting: product name · CAS number · signal word · pictograms · H-codes · P-codes · PPE · storage requirements…
              </div>
            </div>
          )}

          {/* Done */}
          {stage === "done" && extracted && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-sm font-semibold text-slate-800">Extraction complete — review before approving</p>
                <ConfidenceBadge score={extracted.confidence_score} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                <Row label="Product Name" value={extracted.product_name} bold />
                <Row label="Chemical Name" value={extracted.chemical_name} />
                <Row label="CAS Number" value={extracted.cas_number} />
                <Row label="Manufacturer" value={extracted.manufacturer} />
                <Row label="Signal Word" value={extracted.signal_word} highlight={
                  extracted.signal_word === "Danger" ? "text-red-600 font-bold" :
                  extracted.signal_word === "Warning" ? "text-amber-600 font-bold" : ""
                } />
                <Row label="Physical State" value={extracted.physical_state} />
                <Row label="Flash Point" value={extracted.flash_point} />
                <Row label="SDS Date" value={extracted.sds_revision_date} />
              </div>

              {extracted.ghs_pictogram_codes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">GHS Pictograms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.ghs_pictogram_codes.map((code) => (
                      <span key={code} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${GHS_COLORS[code] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {code} · {GHS_NAMES[code] ?? code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {extracted.hazard_statements.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Hazard Statements ({extracted.hazard_statements.length})
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {extracted.hazard_statements.map((code, i) => (
                      <p key={code} className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{code}</span>
                        {extracted.hazard_statement_texts[i] ? ` — ${extracted.hazard_statement_texts[i]}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-1">
                <button onClick={handleClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Close — Review Later
                </button>
                <button onClick={handleClose} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Go to SDS Queue
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {stage === "error" && (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800">Extraction failed</p>
                  <p className="mt-1 text-xs text-red-600">{error}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-1">
                <button onClick={handleClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => { setStage("idle"); setError(""); }} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Try Again</button>
              </div>
            </>
          )}

        </div>
      </Modal>
    </>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-right text-xs text-slate-700 ${bold ? "font-semibold" : ""} ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}
