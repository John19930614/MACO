"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMMON_CHEMICALS, type CommonChemical } from "@/lib/chemicalRefData";

interface ChemicalNamePickerProps {
  /** Fires when a common chemical is picked, so the parent can auto-fill the form. */
  onSelect: (chem: CommonChemical) => void;
}

export function ChemicalNamePicker({ onSelect }: ChemicalNamePickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (q === "") return COMMON_CHEMICALS;
    return COMMON_CHEMICALS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.commonName.toLowerCase().includes(q) ||
        c.cas.toLowerCase().includes(q),
    );
  }, [query]);

  function pick(chem: CommonChemical) {
    onSelect(chem);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search common chemicals — name or CAS, e.g. 'acetone' or '67-64-1'"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-blue-50"
              >
                <span>
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.commonName}</span>
                </span>
                {c.cas && <span className="shrink-0 text-xs text-slate-400">{c.cas}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() !== "" && options.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          No common chemical matches — fill the fields manually below.
        </div>
      )}
    </div>
  );
}
