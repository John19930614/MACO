"use client";

import { useState } from "react";
import { Check, Ban, Sparkles, Network } from "lucide-react";
import type { AiFinding, CausalEdge, SafetyCell } from "@/lib/types";
import { EDGE_META, type EdgeType } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

interface Props {
  findings: AiFinding[];
  edges: CausalEdge[];
  cells: SafetyCell[];
}

export function ReviewQueue({ findings, edges, cells }: Props) {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const cellTitle = (id: string) => cells.find((c) => c.id === id)?.title ?? id;
  const pendingF  = findings.filter((f) => f.review_status === "pending" && !reviewed.has(f.id));
  const pendingE  = edges.filter((e) => e.review_status === "pending" && !reviewed.has(e.id));
  const queue     = pendingF.length + pendingE.length;

  const allReviewed = [...findings, ...edges].filter(
    (x) => x.review_status === "accepted" || x.review_status === "rejected" || reviewed.has(x.id)
  );
  const accepted       = allReviewed.filter((x) => x.review_status === "accepted").length;
  const acceptanceRate = allReviewed.length ? Math.round((accepted / allReviewed.length) * 100) : 0;

  function markReviewed(id: string) {
    setReviewed((prev) => new Set([...prev, id]));
  }

  return (
    <div className="iq-scroll flex-1 overflow-y-auto p-6">
      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In queue",           value: queue,                   color: "#3b82f6" },
          { label: "AI acceptance rate", value: `${acceptanceRate}%`,   color: "#14b8a6" },
          { label: "Reviewed to date",   value: allReviewed.length,     color: undefined  },
          { label: "Findings total",     value: findings.length,        color: undefined  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</div>
            <div
              className="mt-1 text-2xl font-bold"
              style={s.color ? { color: s.color } : { color: "#1e293b" }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {queue === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Review queue is clear — every AI suggestion has been actioned.
        </div>
      ) : (
        <div className="space-y-2">
          {pendingF.map((f) => (
            <div key={f.id} className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-violet-700">
                  AI finding
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {cellTitle(f.cell_id ?? "")}
                </span>
                <span className="text-[11px] text-slate-400">{relativeTime(f.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{f.input_summary}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => markReviewed(f.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  onClick={() => markReviewed(f.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  <Ban className="h-3 w-3" /> Reject
                </button>
              </div>
            </div>
          ))}

          {pendingE.map((e) => {
            const src = cells.find((c) => c.id === e.source_cell_id);
            const tgt = cells.find((c) => c.id === e.target_cell_id);
            return (
              <div key={e.id} className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-fuchsia-500" />
                  <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-fuchsia-700">
                    Causal link
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: EDGE_META[e.type as EdgeType]?.color }}
                  >
                    {EDGE_META[e.type as EdgeType]?.label} · {Math.round(e.confidence * 100)}%
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {e.created_at ? relativeTime(e.created_at) : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">{src?.title.slice(0, 50)}</span>
                  {" → "}
                  <span className="font-medium text-slate-800">{tgt?.title.slice(0, 50)}</span>
                </p>
                {e.rationale && <p className="mt-0.5 text-[11px] text-slate-500">{e.rationale}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => markReviewed(e.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    onClick={() => markReviewed(e.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    <Ban className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
