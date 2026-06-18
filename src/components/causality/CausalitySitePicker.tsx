"use client";

import { useRouter } from "next/navigation";
import type { Site } from "@/lib/types";

export function CausalitySitePicker({ sites, siteId }: { sites: Site[]; siteId: string }) {
  const router = useRouter();
  return (
    <select
      value={siteId}
      onChange={(e) => router.push(`/causality?site=${e.target.value}`)}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
    >
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
