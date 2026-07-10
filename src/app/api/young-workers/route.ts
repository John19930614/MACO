import { NextResponse } from "next/server";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getYoungWorkerAccess } from "@/lib/young-worker/access";
import { computeAge } from "@/lib/young-worker/gate-logic";

// Backs YoungWorkerList (the spec's fetch had no route). Manager/superadmin only;
// RLS on young_workers is the second line of defence.

type PermitStatus = "valid" | "expiring" | "expired" | "missing";

function permitStatus(expiry: string | null): PermitStatus {
  if (!expiry) return "missing";
  const days = Math.floor(
    (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "expired";
  if (days <= 14) return "expiring";
  return "valid";
}

export async function GET() {
  const access = await getYoungWorkerAccess();
  if (!access.authorized) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (MOCK_MODE) return NextResponse.json([]);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("young_workers")
    .select(
      "id, dob, classification, work_permit_expiry_date, profiles!young_workers_profile_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "load-failed" }, { status: 500 });
  }

  const nowISO = new Date().toISOString();
  const rows = (data ?? []).map((r) => {
    const rec = r as {
      id: string;
      dob: string;
      classification: string;
      work_permit_expiry_date: string | null;
      profiles: { display_name: string } | { display_name: string }[] | null;
    };
    const p = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles;
    return {
      id: rec.id,
      workerName: p?.display_name ?? "Unknown worker",
      age: computeAge(rec.dob, nowISO),
      classification: rec.classification,
      workPermitExpiryDate: rec.work_permit_expiry_date,
      status: permitStatus(rec.work_permit_expiry_date),
    };
  });

  return NextResponse.json(rows);
}
