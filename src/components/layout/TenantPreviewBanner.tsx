"use client";

import { useTransition } from "react";
import { Eye, X, Loader2 } from "lucide-react";
import { stopTenantPreview } from "@/lib/actions/preview";

/**
 * Sticky banner shown whenever a Reliance superadmin is previewing a tenant.
 * Makes the read-only preview state unmistakable and offers a one-click exit.
 */
export function TenantPreviewBanner({ tenantName }: { tenantName: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white print:hidden">
      <Eye className="h-3.5 w-3.5" />
      <span>
        Previewing as <strong>{tenantName}</strong> — read only
      </span>
      <button
        type="button"
        onClick={() => start(() => stopTenantPreview())}
        disabled={pending}
        className="ml-2 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 transition hover:bg-white/30 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Exit preview
      </button>
    </div>
  );
}
