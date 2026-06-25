import { NextRequest, NextResponse } from "next/server";
import { parseCsv, mapRowsToCells, type EtlMapping } from "@/lib/etl/import";
import { createCell, getSessionUser, GatewayRejectionError } from "@/lib/data/repo";
import { withAuthz } from "@/lib/api/guard";

/**
 * POST /api/etl/import — import an existing platform's CSV export into SafetyIQ.
 * Body: { csv: string, mapping: EtlMapping, dry?: boolean }
 * Validates every row with the app's schema, inserts the valid ones (under the
 * caller's tenant via createCell), and returns a reconciliation report with the
 * legacy ids of imported records and the issues for rejected ones.
 *
 * `dry: true` validates and reports without writing — run it first.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.csv || !body?.mapping) {
    return NextResponse.json({ error: "csv and mapping are required" }, { status: 400 });
  }

  const rows = parseCsv(String(body.csv));
  const result = mapRowsToCells(rows, body.mapping as EtlMapping);

  // withAuthz maps an AuthorizationError (bad role / unauthenticated) to 403.
  return withAuthz(async () => {
    const created: { legacyId: string; cellId: string }[] = [];
    const gatewayRejected: { legacyId: string; reason: string }[] = [];
    if (!body.dry) {
      const userId = (await getSessionUser()).id;
      for (let i = 0; i < result.inputs.length; i++) {
        try {
          const cell = await createCell(result.inputs[i], userId);
          created.push({ legacyId: result.legacyIds[i], cellId: cell.id });
        } catch (e) {
          // A row the gateway blocks (dup / bad reference) is skipped + reported,
          // not fatal to the whole import; auth errors propagate to withAuthz.
          if (e instanceof GatewayRejectionError) {
            gatewayRejected.push({ legacyId: result.legacyIds[i], reason: e.rejections.map((r) => r.reason).join("; ") });
            continue;
          }
          throw e;
        }
      }
    }
    return NextResponse.json({
      dry: Boolean(body.dry),
      report: { ...result.report, imported: body.dry ? 0 : created.length, gatewayRejected: gatewayRejected.length },
      created,
      rejected: result.rejected,
      gatewayRejected,
    });
  });
}
