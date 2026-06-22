"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDocument } from "@/lib/actions/ehs";
import { useDemoUser } from "@/lib/context/demo-user";
import {
  DOCUMENT_LIBRARY,
  LIBRARY_GROUPS,
  type LibraryDocument,
} from "./libraryTemplates";
import { Pill } from "@/components/ui/primitives";
import { BookOpen, Check, Plus, X, ChevronRight, FileText } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  sop: "SOP", policy: "Policy", procedure: "Procedure",
  form: "Form", permit: "Permit", msds: "SDS",
  plan: "Plan", guideline: "Guideline",
};

const PRIORITY_STYLE: Record<string, string> = {
  required:    "bg-red-50 text-red-700 border border-red-200",
  recommended: "bg-amber-50 text-amber-700 border border-amber-200",
  optional:    "bg-slate-50 text-slate-500 border border-slate-200",
};

const PRIORITY_LABEL: Record<string, string> = {
  required:    "Required",
  recommended: "Recommended",
  optional:    "Optional",
};

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  doc,
  onClose,
  onAdd,
  isAdding,
  isAdded,
}: {
  doc: LibraryDocument;
  onClose: () => void;
  onAdd: () => void;
  isAdding: boolean;
  isAdded: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal header */}
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {CATEGORY_LABEL[doc.category] ?? doc.category}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[doc.priority]}`}>
                  {PRIORITY_LABEL[doc.priority]}
                </span>
                <span className="text-[11px] font-medium text-blue-600">{doc.regulatoryBasis}</span>
              </div>
              <h2 className="text-lg font-bold leading-tight text-slate-900">{doc.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{doc.description}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
            <span>Review cycle: <strong className="text-slate-600">{doc.reviewMonths} months</strong></span>
            <span>Sections: <strong className="text-slate-600">{doc.sections.length}</strong></span>
            {doc.acknowledgmentRequired && (
              <span className="text-indigo-500 font-medium">Acknowledgment required</span>
            )}
          </div>
        </div>

        {/* Document sections */}
        <div className="divide-y divide-slate-50 px-6 py-4">
          {doc.sections.map((section, idx) => (
            <div key={idx} className="py-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                {section.heading}
              </h3>
              <div className="pl-5.5 space-y-2">
                {section.body.split("\n\n").map((para, pi) => (
                  <p key={pi} className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white px-6 py-4">
          <p className="text-xs text-slate-400">
            This template will be added to your Document Register as a draft with today&apos;s effective date.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={onAdd}
              disabled={isAdding || isAdded}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isAdded
                  ? "bg-emerald-50 text-emerald-700 cursor-default"
                  : isAdding
                  ? "bg-blue-50 text-blue-500 cursor-default"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isAdded ? (
                <><Check className="h-3.5 w-3.5" /> Added to Register</>
              ) : isAdding ? (
                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> Adding…</>
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Add to Register</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Library ──────────────────────────────────────────────────────────

export function DocumentLibrary() {
  const router = useRouter();
  const { user } = useDemoUser();
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<LibraryDocument | null>(null);

  const filtered = DOCUMENT_LIBRARY.filter((d) => {
    const matchGroup = activeGroup === "All" || d.group === activeGroup;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.regulatoryBasis.toLowerCase().includes(q) ||
      d.group.toLowerCase().includes(q);
    return matchGroup && matchSearch;
  });

  async function handleAdd(doc: LibraryDocument) {
    setAdding((prev) => new Set([...prev, doc.id]));
    const today = new Date().toISOString().slice(0, 10);
    const reviewMs =
      new Date().setMonth(new Date().getMonth() + doc.reviewMonths);
    const reviewDate = new Date(reviewMs).toISOString().slice(0, 10);
    const fd = new FormData();
    fd.set("title", doc.title);
    fd.set("category", doc.category);
    fd.set("version", "1.0");
    fd.set("effective_date", today);
    fd.set("review_date", reviewDate);
    fd.set("status", "draft");
    fd.set("acknowledgment_required", doc.acknowledgmentRequired ? "true" : "false");
    await addDocument(null, fd);
    setAdding((prev) => {
      const s = new Set(prev);
      s.delete(doc.id);
      return s;
    });
    setAdded((prev) => new Set([...prev, doc.id]));
    router.refresh();
  }

  const requiredCount = filtered.filter((d) => d.priority === "required").length;

  return (
    <>
      {preview && (
        <PreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          onAdd={() => handleAdd(preview)}
          isAdding={adding.has(preview.id)}
          isAdded={added.has(preview.id)}
        />
      )}

      <div className="space-y-5">
        {/* Header bar */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Pharma / Biotech Document Library
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {DOCUMENT_LIBRARY.length} pre-built templates matched to {user.company}&apos;s regulatory scope. Preview any template to review its full structure before adding it to your Document Register as a draft.
              </p>
            </div>
          </div>
        </div>

        {/* Search + filter row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search by title, description, or standard…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          />
          <div className="text-xs text-slate-400">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
            {requiredCount > 0 && (
              <span className="ml-1 text-red-600 font-medium">
                · {requiredCount} required
              </span>
            )}
          </div>
        </div>

        {/* Group filter tabs */}
        <div className="flex flex-wrap gap-2">
          {["All", ...LIBRARY_GROUPS].map((g) => {
            const isActive = activeGroup === g;
            const count =
              g === "All"
                ? DOCUMENT_LIBRARY.length
                : DOCUMENT_LIBRARY.filter((d) => d.group === g).length;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-blue-300 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {g}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-6 py-16 text-center text-sm text-slate-400">
            No templates match your search.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => {
              const isAdding = adding.has(doc.id);
              const isAdded = added.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Top row: category + priority */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Pill className="bg-slate-100 text-slate-600 text-xs">
                      {CATEGORY_LABEL[doc.category] ?? doc.category}
                    </Pill>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${PRIORITY_STYLE[doc.priority]}`}
                    >
                      {PRIORITY_LABEL[doc.priority]}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-1 text-sm font-semibold leading-tight text-slate-900">
                    {doc.title}
                  </h3>

                  {/* Regulatory basis */}
                  <p className="mb-2 text-[11px] font-medium text-blue-600">
                    {doc.regulatoryBasis}
                  </p>

                  {/* Description */}
                  <p className="mb-3 flex-1 text-xs leading-relaxed text-slate-500 line-clamp-3">
                    {doc.description}
                  </p>

                  {/* Section count hint */}
                  <p className="mb-4 text-[11px] text-slate-400">
                    {doc.sections.length} section{doc.sections.length !== 1 ? "s" : ""}
                    {" · "}
                    {doc.sections.map((s) => s.heading.replace(/^\d+\.\s+/, "")).slice(0, 2).join(", ")}
                    {doc.sections.length > 2 ? "…" : ""}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Review every {doc.reviewMonths} mo
                      {doc.acknowledgmentRequired && (
                        <> · <span className="text-indigo-500">Ack</span></>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreview(doc)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                      >
                        <FileText className="h-3 w-3" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleAdd(doc)}
                        disabled={isAdding || isAdded}
                        className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          isAdded
                            ? "bg-emerald-50 text-emerald-700 cursor-default"
                            : isAdding
                            ? "bg-blue-50 text-blue-500 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isAdded ? (
                          <><Check className="h-3 w-3" /> Added</>
                        ) : isAdding ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                        ) : (
                          <><Plus className="h-3 w-3" /> Add</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
