"use client";

import { useState } from "react";
import { PPE_TYPES } from "@/lib/chemicalRefData";

interface PpePickerProps {
  /** Form field name. Submits selected PPE codes as a comma-joined string. */
  name?: string;
  defaultCodes?: string[];
  onChange?: (codes: string[]) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  eye_face: "Eye / Face",
  hand: "Hands",
  body: "Body",
  respiratory: "Respiratory",
  foot: "Feet",
  engineering_control: "Engineering Controls",
};

export function PpePicker({ name, defaultCodes = [], onChange }: PpePickerProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    defaultCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
  );

  function toggle(code: string) {
    setSelected((s) => {
      const next = s.includes(code) ? s.filter((c) => c !== code) : [...s, code];
      onChange?.(next);
      return next;
    });
  }

  // Group PPE by category for a tidy checklist.
  const groups = PPE_TYPES.reduce<Record<string, typeof PPE_TYPES>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-2">
      {name && <input type="hidden" name={name} value={selected.join(", ")} />}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
            {items.map((p) => (
              <label key={p.code} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={selected.includes(p.code)}
                  onChange={() => toggle(p.code)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                {p.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
