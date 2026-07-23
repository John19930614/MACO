import Link from "next/link";
import { getServerTenantId } from "@/lib/auth/session";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { canManage } from "@/lib/constants";
import { getSites } from "@/lib/data/repo";
import { NFPA704_BETA_ENABLED, NFPA704_BETA_DISABLED_MESSAGE } from "@/lib/nfpa704/flag";

export const metadata = { title: "NFPA 704 Ratings" };

export default async function NfpaIndexPage() {
  if (!NFPA704_BETA_ENABLED) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">NFPA 704 Ratings</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {NFPA704_BETA_DISABLED_MESSAGE}
        </div>
      </div>
    );
  }

  const role = await resolveCallerRole();
  if (!role || !canManage(role)) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">NFPA 704 Ratings</h1>
        <p className="text-slate-600">
          You do not have permission to view NFPA 704 postings. Contact an admin if you
          believe this is a mistake.
        </p>
      </div>
    );
  }

  const tenantId = await getServerTenantId();
  const sites = (await getSites()).filter((s) => s.tenant_id === tenantId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">NFPA 704 Ratings</h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Pick a building to see its NFPA 704 diamond, how it rolls up from each storage
          area, and to open a printable entrance posting. Ratings combine{" "}
          <strong>worst-case per category</strong> (health, flammability, instability) —
          the standard NFPA 704 posting rule — and never dilute or average by quantity.
        </p>
        <p className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          BETA — pending EHS / fire-safety sign-off. Do not rely on these for real signage yet.
        </p>
      </div>

      {sites.length === 0 ? (
        <div className="text-slate-500">
          No buildings (sites) set up yet for this organization. Add a site to start tracking
          NFPA 704 ratings.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sites.map((s) => (
            <li key={s.id}>
              <Link
                href={`/chemicals/nfpa/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-blue-600">View ratings →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
