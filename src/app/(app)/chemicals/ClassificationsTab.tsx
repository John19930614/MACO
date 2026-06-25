"use client";

import type { Chemical } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";

// ── GHS classification derivation from H-codes (OSHA HCS 2012 / GHS Rev. 9) ────
// Read-only Section-2 view. The persisted, human-verified ghs_classifications
// table layers on once migration 20260625010000 is applied.

type HazType = "physical" | "health" | "environmental";

interface Classification {
  code: string;
  hazardClass: string;
  category: string | null;
  type: HazType;
  signalWord: "Danger" | "Warning" | null;
  route: string | null;
}

const TYPE_STYLE: Record<HazType, string> = {
  physical:      "bg-orange-100 text-orange-700",
  health:        "bg-red-100 text-red-700",
  environmental: "bg-emerald-100 text-emerald-700",
};

// Per-H-code classification rule. cat = GHS category, sw = signal word, route.
const RULES: Record<string, { cls: string; type: HazType; cat?: string; sw?: "Danger" | "Warning"; route?: string }> = {
  // Physical
  H200: { cls: "Explosive", type: "physical", cat: "Unstable", sw: "Danger" },
  H201: { cls: "Explosive", type: "physical", cat: "Div 1.1", sw: "Danger" },
  H202: { cls: "Explosive", type: "physical", cat: "Div 1.2", sw: "Danger" },
  H203: { cls: "Explosive", type: "physical", cat: "Div 1.3", sw: "Danger" },
  H204: { cls: "Explosive", type: "physical", cat: "Div 1.4", sw: "Warning" },
  H220: { cls: "Flammable gas", type: "physical", cat: "1A", sw: "Danger" },
  H221: { cls: "Flammable gas", type: "physical", cat: "1B/2", sw: "Warning" },
  H222: { cls: "Flammable aerosol", type: "physical", cat: "1", sw: "Danger" },
  H223: { cls: "Flammable aerosol", type: "physical", cat: "2", sw: "Warning" },
  H224: { cls: "Flammable liquid", type: "physical", cat: "1", sw: "Danger" },
  H225: { cls: "Flammable liquid", type: "physical", cat: "2", sw: "Danger" },
  H226: { cls: "Flammable liquid", type: "physical", cat: "3", sw: "Warning" },
  H228: { cls: "Flammable solid", type: "physical", cat: "1/2", sw: "Warning" },
  H240: { cls: "Self-reactive / Organic peroxide", type: "physical", cat: "Type A", sw: "Danger" },
  H241: { cls: "Self-reactive / Organic peroxide", type: "physical", cat: "Type B", sw: "Danger" },
  H242: { cls: "Self-reactive / Organic peroxide", type: "physical", cat: "Type C-F", sw: "Warning" },
  H250: { cls: "Pyrophoric", type: "physical", cat: "1", sw: "Danger" },
  H251: { cls: "Self-heating", type: "physical", cat: "1", sw: "Danger" },
  H252: { cls: "Self-heating", type: "physical", cat: "2", sw: "Warning" },
  H260: { cls: "Water-reactive (flammable gas)", type: "physical", cat: "1", sw: "Danger" },
  H261: { cls: "Water-reactive (flammable gas)", type: "physical", cat: "2/3", sw: "Warning" },
  H270: { cls: "Oxidizing gas", type: "physical", cat: "1", sw: "Danger" },
  H271: { cls: "Oxidizer", type: "physical", cat: "1", sw: "Danger" },
  H272: { cls: "Oxidizer", type: "physical", cat: "2/3", sw: "Warning" },
  H280: { cls: "Gas under pressure", type: "physical", cat: "Compressed", sw: "Warning" },
  H281: { cls: "Gas under pressure", type: "physical", cat: "Refrigerated", sw: "Warning" },
  H290: { cls: "Corrosive to metals", type: "physical", cat: "1", sw: "Warning" },
  // Health — acute toxicity
  H300: { cls: "Acute toxicity", type: "health", cat: "1/2", sw: "Danger", route: "Oral" },
  H301: { cls: "Acute toxicity", type: "health", cat: "3", sw: "Danger", route: "Oral" },
  H302: { cls: "Acute toxicity", type: "health", cat: "4", sw: "Warning", route: "Oral" },
  H310: { cls: "Acute toxicity", type: "health", cat: "1/2", sw: "Danger", route: "Dermal" },
  H311: { cls: "Acute toxicity", type: "health", cat: "3", sw: "Danger", route: "Dermal" },
  H312: { cls: "Acute toxicity", type: "health", cat: "4", sw: "Warning", route: "Dermal" },
  H330: { cls: "Acute toxicity", type: "health", cat: "1/2", sw: "Danger", route: "Inhalation" },
  H331: { cls: "Acute toxicity", type: "health", cat: "3", sw: "Danger", route: "Inhalation" },
  H332: { cls: "Acute toxicity", type: "health", cat: "4", sw: "Warning", route: "Inhalation" },
  H304: { cls: "Aspiration hazard", type: "health", cat: "1", sw: "Danger" },
  H314: { cls: "Skin corrosion", type: "health", cat: "1", sw: "Danger", route: "Skin" },
  H315: { cls: "Skin irritation", type: "health", cat: "2", sw: "Warning", route: "Skin" },
  H317: { cls: "Skin sensitization", type: "health", cat: "1", sw: "Warning", route: "Skin" },
  H318: { cls: "Serious eye damage", type: "health", cat: "1", sw: "Danger", route: "Eye" },
  H319: { cls: "Eye irritation", type: "health", cat: "2", sw: "Warning", route: "Eye" },
  H334: { cls: "Respiratory sensitization", type: "health", cat: "1", sw: "Danger", route: "Inhalation" },
  H335: { cls: "STOT — single exposure", type: "health", cat: "3 (resp.)", sw: "Warning", route: "Inhalation" },
  H336: { cls: "STOT — single exposure", type: "health", cat: "3 (narcotic)", sw: "Warning" },
  H340: { cls: "Germ cell mutagenicity", type: "health", cat: "1", sw: "Danger" },
  H341: { cls: "Germ cell mutagenicity", type: "health", cat: "2", sw: "Warning" },
  H350: { cls: "Carcinogenicity", type: "health", cat: "1", sw: "Danger" },
  H351: { cls: "Carcinogenicity", type: "health", cat: "2", sw: "Warning" },
  H360: { cls: "Reproductive toxicity", type: "health", cat: "1", sw: "Danger" },
  H361: { cls: "Reproductive toxicity", type: "health", cat: "2", sw: "Warning" },
  H362: { cls: "Reproductive toxicity", type: "health", cat: "Lactation", route: "Lactation" },
  H370: { cls: "STOT — single exposure", type: "health", cat: "1", sw: "Danger" },
  H371: { cls: "STOT — single exposure", type: "health", cat: "2", sw: "Warning" },
  H372: { cls: "STOT — repeated exposure", type: "health", cat: "1", sw: "Danger" },
  H373: { cls: "STOT — repeated exposure", type: "health", cat: "2", sw: "Warning" },
  // Environmental
  H400: { cls: "Hazardous to aquatic env. (acute)", type: "environmental", cat: "1", sw: "Warning" },
  H401: { cls: "Hazardous to aquatic env. (acute)", type: "environmental", cat: "2" },
  H402: { cls: "Hazardous to aquatic env. (acute)", type: "environmental", cat: "3" },
  H410: { cls: "Hazardous to aquatic env. (chronic)", type: "environmental", cat: "1", sw: "Warning" },
  H411: { cls: "Hazardous to aquatic env. (chronic)", type: "environmental", cat: "2" },
  H412: { cls: "Hazardous to aquatic env. (chronic)", type: "environmental", cat: "3" },
  H413: { cls: "Hazardous to aquatic env. (chronic)", type: "environmental", cat: "4" },
  H420: { cls: "Hazardous to the ozone layer", type: "environmental", cat: "1", sw: "Warning" },
};

function classify(hazardStatements: string[]): Classification[] {
  const out: Classification[] = [];
  for (const raw of hazardStatements) {
    const code = raw.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase();
    const rule = RULES[code];
    if (!rule) continue;
    out.push({
      code,
      hazardClass: rule.cls,
      category: rule.cat ?? null,
      type: rule.type,
      signalWord: rule.sw ?? null,
      route: rule.route ?? null,
    });
  }
  // Stable order: physical → health → environmental, then by code.
  const rank: Record<HazType, number> = { physical: 0, health: 1, environmental: 2 };
  return out.sort((a, b) => rank[a.type] - rank[b.type] || a.code.localeCompare(b.code));
}

export function ClassificationsTab({ chemicals }: { chemicals: Chemical[] }) {
  const rows = chemicals
    .map((c) => ({ chem: c, rows: classify(c.hazard_statements ?? []) }))
    .filter((x) => x.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        <span className="font-semibold">GHS Section-2 classification</span> derived from each chemical&apos;s H-codes
        (OSHA 29 CFR 1910.1200 / GHS Rev. 9). Categories are indicative — verify against the full SDS. Persisted,
        human-verified classifications arrive with the chemical-intelligence migration.
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
          No chemicals with recognized H-codes to classify.
        </div>
      ) : (
        rows.map(({ chem, rows: cls }) => (
          <div key={chem.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-800">{chem.name}</span>
              {chem.cas_number && (
                <span className="font-mono text-[10px] text-slate-400">CAS {chem.cas_number}</span>
              )}
              <span className="ml-auto text-[10px] text-slate-400">{cls.length} classification{cls.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">H-code</th>
                  <th className="px-3 py-2">Hazard class</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Route</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cls.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-mono font-semibold text-slate-600">{r.code}</td>
                    <td className="px-3 py-2 text-slate-700">{r.hazardClass}</td>
                    <td className="px-3 py-2 text-slate-500">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 hidden text-slate-500 sm:table-cell">{r.route ?? "—"}</td>
                    <td className="px-3 py-2"><Pill className={TYPE_STYLE[r.type]}>{r.type}</Pill></td>
                    <td className="px-3 py-2">
                      {r.signalWord ? (
                        <span className={`font-bold ${r.signalWord === "Danger" ? "text-red-700" : "text-amber-600"}`}>
                          {r.signalWord}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
