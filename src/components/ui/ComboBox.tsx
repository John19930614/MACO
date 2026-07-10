"use client";

import { useId } from "react";

// A native combobox: a text input backed by a <datalist>. Users pick from the
// suggestions OR type their own value — the "dropdown, but manual entry too"
// pattern used across the app's forms. Value-based onChange so callers can apply
// transforms (e.g. upper-casing a state code).

export type ComboOption = string | { value: string; label?: string };

function normalize(opt: ComboOption): { value: string; label?: string } {
  return typeof opt === "string" ? { value: opt } : opt;
}

export function ComboBox({
  value,
  onValueChange,
  options,
  placeholder = "Pick from the list or type your own…",
  className = "mt-1 w-full rounded border px-2 py-1.5 text-sm",
  maxLength,
  inputMode,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ComboOption[];
  placeholder?: string;
  className?: string;
  maxLength?: number;
  inputMode?: "text" | "decimal" | "numeric";
  id?: string;
}) {
  const generatedId = useId();
  const listId = id ?? generatedId;
  return (
    <>
      <input
        list={listId}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className={className}
      />
      <datalist id={listId}>
        {options.map((o) => {
          const { value: v, label } = normalize(o);
          return <option key={v} value={v}>{label}</option>;
        })}
      </datalist>
    </>
  );
}
