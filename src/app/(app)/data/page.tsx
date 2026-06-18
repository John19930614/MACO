import {
  getTenants, getSites, getLocations, getCells, getProofs, getEvidence, getEdges, getFindings, getActions, getEvents, getBehaviors,
} from "@/lib/data/repo";
import { checkReferentialIntegrity } from "@/lib/data/integrity";
import { DataSpace } from "@/components/data/DataSpace";

// Data Space — a "virtual space" that shows how Safety Cells store and connect
// their data across tables, with a live referential-integrity check.
export default async function DataPage() {
  const [tenants, sites, locations, cells, proofs, evidence, edges, findings, actions, events, behaviors] = await Promise.all([
    getTenants(), getSites(), getLocations(), getCells(), getProofs(), getEvidence(), getEdges(), getFindings(), getActions(), getEvents(), getBehaviors(),
  ]);

  const report = checkReferentialIntegrity({ tenants, sites, locations, cells, proofs, evidence, edges, findings, actions, events, behaviors });
  const cellRefs = cells.map((c) => ({ id: c.id, title: c.title, severity: c.severity, site_id: c.site_id }));

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">Data Space</h1>
        <p className="text-sm text-slate-500">
          How each Safety Cell stores its data — every spoke is the table that holds it. Use it to understand the model and verify the database is correct.
        </p>
      </div>
      <DataSpace report={report} cells={cellRefs} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
