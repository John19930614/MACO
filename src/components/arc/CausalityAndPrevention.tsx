"use client";

import { useState } from "react";
import { CELLS, EDGES, ACTIONS, AI_FINDINGS } from "@/lib/data/mock";
import { buildPreventionWeb } from "@/lib/arc/prevention";
import { CausalityMap } from "./CausalityMap";
import { PreventionWebView } from "./PreventionWebView";

type Tab = "causality" | "prevention";

const model = buildPreventionWeb(CELLS, ACTIONS, AI_FINDINGS);

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  {
    id: "causality",
    label: "Causality Map",
    subtitle: "AI-proposed links dashed · accepted links solid",
  },
  {
    id: "prevention",
    label: "Prevention Web",
    subtitle: "Control-gap clusters → Safety Cells → preventive actions",
  },
];

export function CausalityAndPrevention() {
  const [tab, setTab] = useState<Tab>("causality");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative mr-1 pb-2.5 pt-2 text-sm font-medium transition-colors ${
              t.id === tab
                ? "text-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.id === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
            )}
          </button>
        ))}
        <span className="ml-4 text-xs text-slate-400">
          {TABS.find((t) => t.id === tab)?.subtitle}
        </span>
      </div>

      <div className="flex-1" style={{ minHeight: 0 }}>
        {tab === "causality" ? (
          <CausalityMap cells={CELLS} edges={EDGES} />
        ) : (
          <PreventionWebView cells={CELLS} edges={EDGES} model={model} />
        )}
      </div>
    </div>
  );
}
