import { NextResponse } from "next/server";
import { getCells, getEvents, getSessionUser } from "@/lib/data/repo";
import { MOCK_MODE, serverSecrets } from "@/lib/env";

// POST /api/embeddings/reindex — admin-only batch (re)embed of all cells +
// events. Uses the skip-unchanged batch path, so re-running only pays for what
// changed. Live mode + OpenAI key required.
export async function POST() {
  if ((await getSessionUser()).role !== "admin") {
    return NextResponse.json({ error: "forbidden", detail: "admin only" }, { status: 403 });
  }
  if (MOCK_MODE || !serverSecrets().openaiKey) {
    return NextResponse.json({ error: "unavailable", detail: "Embeddings require live mode + OPENAI_API_KEY" }, { status: 503 });
  }
  const { embedAndStoreCells, embedAndStoreEvents } = await import("@/lib/ai/embeddings");
  const [cells, events] = await Promise.all([getCells(), getEvents()]);
  const [cellsRes, eventsRes] = await Promise.all([embedAndStoreCells(cells), embedAndStoreEvents(events)]);
  return NextResponse.json({ cells: cellsRes, events: eventsRes });
}
