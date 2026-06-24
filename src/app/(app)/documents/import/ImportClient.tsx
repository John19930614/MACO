"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Check, X, FileText, AlertTriangle, FlaskConical, Trash2, Scale } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { stageDocumentImport, approveStagedRow, rejectStagedRow } from "@/lib/actions/ehs";

type Kind = "chemical" | "waste" | "legal";

const KINDS: { id: Kind; label: string; hint: string; Icon: React.ElementType }[] = [
  { id: "chemical", label: "Chemical Inventory", hint: "→ Chemical Management", Icon: FlaskConical },
  { id: "waste", label: "Hazardous Waste", hint: "→ Waste Management", Icon: Trash2 },
  { id: "legal", label: "Permits & Regulations", hint: "→ Legal Register", Icon: Scale },
];

const KIND_LABEL: Record<string, string> = { chemical: "Chemical", waste: "Waste stream", legal: "Legal requirement" };

interface StagedRow {
  id: string; row_kind: string; candidate: Record<string, unknown>; label: string;
  source_name: string | null; status: string; dedup_of: string | null; dedup_note: string | null;
}

export function ImportClient({ tenantId, staged }: { tenantId: string; staged: StagedRow[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("chemical");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true); setMsg(""); setMsgErr(false);
    try {
      const supabase = createClient();
      const uploaded: { name: string; path: string }[] = [];
      for (const file of Array.from(fileList)) {
        const path = `${tenantId}/import/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        if (supabase) {
          const { error } = await supabase.storage.from("client-documents").upload(path, file, { upsert: false });
          if (error) { setMsgErr(true); setMsg(`Upload failed: ${error.message}`); setBusy(false); return; }
        }
        uploaded.push({ name: file.name, path });
      }
      const res = await stageDocumentImport(kind, uploaded);
      if (res.ok) {
        setMsgErr(false);
        setMsg(res.staged > 0
          ? `Extracted ${res.staged} ${KIND_LABEL[kind].toLowerCase()}(s)${res.dupes > 0 ? ` (${res.dupes} possible duplicate${res.dupes > 1 ? "s" : ""})` : ""} — review below.`
          : (res.note || "No rows extracted."));
        if (res.staged === 0) setMsgErr(true);
        router.refresh();
      } else {
        setMsgErr(true); setMsg(res.error || "Import failed.");
      }
    } catch {
      setMsgErr(true); setMsg("Import failed — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, accept: boolean) {
    setRowBusy(id);
    try {
      const res = accept ? await approveStagedRow(id) : await rejectStagedRow(id);
      if (!res.ok) { setMsgErr(true); setMsg(res.error || "Action failed."); }
      router.refresh();
    } finally { setRowBusy(null); }
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <Card>
        <CardHeader title="Upload a document" subtitle="Pick the type, then upload — extraction runs immediately. Nothing is written live until you approve it." />
        <div className="p-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {KINDS.map((k) => {
              const sel = kind === k.id;
              return (
                <button key={k.id} onClick={() => setKind(k.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition ${sel ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <k.Icon className={`h-5 w-5 ${sel ? "text-blue-600" : "text-slate-400"}`} />
                  <span className={`text-xs font-semibold ${sel ? "text-blue-700" : "text-slate-700"}`}>{k.label}</span>
                  <span className="text-[10px] text-slate-400">{k.hint}</span>
                </button>
              );
            })}
          </div>
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 text-sm font-medium transition ${busy ? "border-slate-200 text-slate-400" : "border-slate-300 text-slate-600 hover:border-blue-400 hover:bg-blue-50"}`}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : <><Upload className="h-4 w-4" /> Upload {KINDS.find((k) => k.id === kind)!.label} file(s)</>}
            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" disabled={busy} className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
          </label>
          {msg && <div className={`mt-3 text-xs ${msgErr ? "text-amber-700" : "text-emerald-700"}`}>{msg}</div>}
        </div>
      </Card>

      {/* Review queue */}
      <Card>
        <CardHeader title="Review Queue" subtitle={`${staged.length} extracted row${staged.length !== 1 ? "s" : ""} awaiting your approval`} />
        {staged.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            Nothing in the queue. Upload a document above to extract rows for review.
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {staged.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</span>
                    <Pill className="bg-slate-100 text-slate-500 text-[10px]">{KIND_LABEL[row.row_kind] ?? row.row_kind}</Pill>
                    {row.dedup_of && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Possible duplicate
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {summarize(row.candidate)}{row.source_name ? ` · from ${row.source_name}` : ""}
                  </div>
                </div>
                <button onClick={() => decide(row.id, true)} disabled={rowBusy !== null}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {rowBusy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Accept
                </button>
                <button onClick={() => decide(row.id, false)} disabled={rowBusy !== null}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function summarize(c: Record<string, unknown>): string {
  const parts: string[] = [];
  if (c.cas_number) parts.push(`CAS ${c.cas_number}`);
  if (c.quantity != null && c.unit) parts.push(`${c.quantity} ${c.unit}`);
  if (c.storage_location) parts.push(String(c.storage_location));
  if (Array.isArray(c.ghs_classes) && c.ghs_classes.length) parts.push(`[${c.ghs_classes.join(",")}]`);
  if (c.classification) parts.push(String(c.classification));
  if (c.disposal_method) parts.push(String(c.disposal_method));
  if (c.regulation_ref) parts.push(String(c.regulation_ref));
  if (c.jurisdiction) parts.push(String(c.jurisdiction));
  return parts.join(" · ") || "extracted record";
}
