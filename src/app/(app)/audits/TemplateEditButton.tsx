"use client";
import { Settings2 } from "lucide-react";

export function TemplateEditButton() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        disabled
        className="rounded p-1 text-slate-300 cursor-not-allowed opacity-50"
        title="Custom template editing is managed by your SA"
        aria-disabled="true"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
      <span className="text-[9px] leading-tight text-slate-400 text-center max-w-[80px]">
        Managed by SA
      </span>
    </div>
  );
}
