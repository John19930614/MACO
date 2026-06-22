"use client";
import { Settings2 } from "lucide-react";

export function TemplateEditButton() {
  return (
    <button
      type="button"
      onClick={() => alert("Custom template editing is managed by Reliance. Contact your SA to configure bespoke checklists.")}
      className="rounded p-1 text-slate-300 hover:text-slate-500 transition-colors"
      title="Edit template"
    >
      <Settings2 className="h-3.5 w-3.5" />
    </button>
  );
}
