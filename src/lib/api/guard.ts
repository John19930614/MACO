import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/data/repo";

/**
 * Run a route handler body, mapping an app-layer AuthorizationError (the
 * tenant + role gate in repo.ts) to a 403 JSON response. Keeps the per-route
 * boilerplate to a single wrap instead of a try/catch in every handler.
 */
export async function withAuthz(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: "forbidden", detail: e.message }, { status: 403 });
    }
    throw e;
  }
}
