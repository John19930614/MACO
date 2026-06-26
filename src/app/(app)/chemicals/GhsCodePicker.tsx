"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  H_TEXTS,
  P_TEXTS,
  deriveSignalWord,
  derivePictograms,
  getPictogramName,
} from "@/lib/ghsData";

type Mode = "hazard" | "precaution";

interface GhsCodePickerProps {
  /** Form field name. When set, submits the selected codes as a comma-joined
   *  string, compatible with parseHazardCodes/parsePrecautionCodes. Omit when
   *  driving the picker outside a <form> (use onChange instead). */
  name?: string;
  mode: Mode;
  /** Codes already on the record (edit form / AI extraction). */
  defaultCodes?: string[];
  /** Fires with the full code list whenever the selection changes. */
  onChange?: (codes: string[]) => void;
}

const chipCls =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm";

export function GhsCodePicker({ name, mode, defaultCodes = [], onChange }: GhsCodePickerProps) {
  const dict = mode === "hazard" ? H_TEXTS : P_TEXTS;
  const placeholder =
    mode === "hazard"
      ? "Search H-codes — e.g. H225 or 'flammable'"
      : "Search P-codes — e.g. P210 or 'ventilated'";

  const [selected, setSelected] = useState<string[]>(() => {
    const seen = new Set<string>();
    return defaultCodes
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && !seen.has(c) && (seen.add(c), true));
  });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(dict)
      .filter(
        ([code, text]) =>
          !selected.includes(code) &&
          (q === "" || code.toLowerCase().includes(q) || text.toLowerCase().includes(q)),
      )
      .slice(0, 40);
  }, [query, selected, dict]);

  function add(code: string) {
    setSelected((s) => {
      if (s.includes(code)) return s;
      const next = [...s, code];
      onChange?.(next);
      return next;
    });
    setQuery("");
  }
  function remove(code: string) {
    setSelected((s) => {
      const next = s.filter((c) => c !== code);
      onChange?.(next);
      return next;
    });
  }

  const signalWord = mode === "hazard" ? deriveSignalWord(selected) : null;
  const pictograms = mode === "hazard" ? derivePictograms(selected) : [];

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {/* Submitted value — comma-joined codes, read by the save action. */}
      {name && <input type="hidden" name={name} value={selected.join(", ")} />}

      {/* Selected codes */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <span key={code} className={chipCls}>
              <span className="font-semibold text-slate-900">{code}</span>
              {dict[code] && (
                <span className="max-w-[16rem] truncate text-slate-500">{dict[code]}</span>
              )}
              <button
                type="button"
                onClick={() => remove(code)}
                aria-label={`Remove ${code}`}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
        {open && options.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {options.map(([code, text]) => (
              <li key={code}>
                <button
                  type="button"
                  // Use onMouseDown so selection fires before the input blurs.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(code);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-blue-50"
                >
                  <span className="font-semibold text-slate-900">{code}</span>
                  <span className="text-slate-500">{text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() !== "" && options.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
            No matching codes
          </div>
        )}
      </div>

      {/* Auto-fill preview — hazard mode only */}
      {mode === "hazard" && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-500">Auto-derived:</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">Signal word</span>
            <span
              className={`rounded px-1.5 py-0.5 font-bold ${
                signalWord === "Danger"
                  ? "bg-red-100 text-red-700"
                  : signalWord === "Warning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {signalWord ?? "Not classified"}
            </span>
          </span>
          {pictograms.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className="text-slate-500">Pictograms</span>
              {pictograms.map((p) => (
                <span
                  key={p}
                  title={getPictogramName(p)}
                  className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 font-medium text-red-700"
                >
                  {p} · {getPictogramName(p)}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
