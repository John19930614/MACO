"use client";

import { useState } from "react";
import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { X, Upload } from "lucide-react";

interface Template {
  name: string; category: string; format: string; tenants: number; version: string;
}

const INITIAL: Template[] = [
  { name: "Chemical Hygiene Plan",        category: "plan",      format: "DOCX", tenants: 3, version: "v2.1" },
  { name: "EHS Induction Package",        category: "training",  format: "PDF",  tenants: 4, version: "v1.4" },
  { name: "Incident Report Form",         category: "form",      format: "PDF",  tenants: 4, version: "v3.0" },
  { name: "CAPA Tracking Template",       category: "form",      format: "XLSX", tenants: 3, version: "v1.2" },
  { name: "Risk Assessment Matrix",       category: "form",      format: "XLSX", tenants: 4, version: "v2.0" },
  { name: "SDS Request Letter",           category: "letter",    format: "DOCX", tenants: 2, version: "v1.0" },
  { name: "Waste Manifest Template",      category: "form",      format: "PDF",  tenants: 3, version: "v1.1" },
  { name: "Audit Checklist — Lab Safety", category: "checklist", format: "PDF",  tenants: 4, version: "v2.3" },
  { name: "Emergency Response Plan",      category: "plan",      format: "DOCX", tenants: 2, version: "v1.5" },
];

const CAT_STYLE: Record<string, string> = {
  plan:      "bg-blue-900/50 text-blue-300",
  training:  "bg-violet-900/50 text-violet-300",
  form:      "bg-amber-900/50 text-amber-300",
  letter:    "bg-slate-800 text-slate-400",
  checklist: "bg-emerald-900/50 text-emerald-300",
};

const CATEGORIES = ["form", "plan", "checklist", "training", "letter", "policy"];
const FORMATS    = ["PDF", "DOCX", "XLSX"];

function UploadTemplateModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Template) => void }) {
  const [name, setName]         = useState("");
  const [category, setCategory] = useState("form");
  const [format, setFormat]     = useState("PDF");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving]     = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    if (!name) {
      const base = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setName(base.charAt(0).toUpperCase() + base.slice(1));
    }
    const ext = f.name.split(".").pop()?.toUpperCase();
    if (ext && FORMATS.includes(ext)) setFormat(ext);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onAdd({ name: name.trim(), category, format, tenants: 0, version: "v1.0" });
      onClose();
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/60 border border-white/8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="text-sm font-bold text-white">Upload Template</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/6"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">File</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-white/10 px-4 py-5 hover:border-blue-500 hover:bg-blue-900/20">
              <input type="file" accept=".pdf,.docx,.xlsx,.xls,.doc" onChange={handleFile} className="sr-only" />
              <Upload className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-200">{fileName || "Click to select file"}</div>
                <div className="text-[10.5px] text-slate-400">PDF, DOCX, XLSX</div>
              </div>
            </label>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Template Name <span className="text-red-400">*</span></label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lab Safety Checklist"
              className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-900/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none">
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/4">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Uploading…" : "Upload Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SATemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState("");

  function handleAdd(t: Template) {
    setTemplates(prev => [...prev, t]);
    setToast(`"${t.name}" uploaded`);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="flex flex-1 flex-col">
      {showModal && <UploadTemplateModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
      <DarkPageHeader
        title="Template Library"
        subtitle="Reusable EHS documents, forms, and checklists for all tenants"
        actions={
          <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Upload Template
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <DarkCard>
          <DarkCardHeader title="Template Catalogue" subtitle={`${templates.length} templates`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Template Name</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Format</th>
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-center">In Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {templates.map((t, i) => (
                  <tr key={`${t.name}-${i}`} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                    <td className="px-4 py-3">
                      <Pill className={CAT_STYLE[t.category] ?? "bg-slate-800 text-slate-400"}>{t.category}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-800 text-slate-400 text-xs">{t.format}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{t.version}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-200">{t.tenants} tenants</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
