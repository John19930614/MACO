import { getCells, getProofs, getActions, getSites, getHslReadings, getVelaInsights } from "@/lib/data/repo";
import { VerticalsPage } from "@/components/arc/VerticalsView";

export const metadata = { title: "Platform Verticals — SafetyIQ" };

export default async function Page() {
  const [sites, cells, proofs, actions, hslReadings, velaInsights] = await Promise.all([
    getSites(),
    getCells(),
    getProofs(),
    getActions(),
    getHslReadings(),
    getVelaInsights(),
  ]);

  return (
    <VerticalsPage
      sites={sites}
      cells={cells}
      proofs={proofs}
      actions={actions}
      hslReadings={hslReadings}
      velaInsights={velaInsights}
    />
  );
}
