"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
    >
      <Printer className="h-4 w-4" />
      Print
    </button>
  );
}
