import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent, getSessionUser, AuthorizationError, GatewayRejectionError } from "@/lib/data/repo";
import { eventSchema } from "@/lib/schemas";
import { MOCK_MODE, serverSecrets } from "@/lib/env";

// GET /api/events?site_id= — list Event Cells (outcomes).
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id") ?? undefined;
  const events = await getEvents(siteId);
  return NextResponse.json({ events });
}

// POST /api/events — log an Event Cell. Tenant is derived from the site.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  let event;
  try {
    event = await createEvent(parsed.data, (await getSessionUser()).id);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: "forbidden", detail: e.message }, { status: 403 });
    if (e instanceof GatewayRejectionError) return NextResponse.json({ error: "rejected", rejections: e.rejections }, { status: 422 });
    throw e;
  }

  // Semantic embedding in live mode (best-effort; never blocks the create).
  if (!MOCK_MODE && serverSecrets().openaiKey) {
    try {
      const { embedAndStoreEvent } = await import("@/lib/ai/embeddings");
      await embedAndStoreEvent(event);
    } catch {
      /* embedding is non-critical */
    }
  }

  // Every create is held for human review (staged), in both mock and live mode.
  return NextResponse.json({ event, pending: true }, { status: 201 });
}
