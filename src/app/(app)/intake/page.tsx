import { getSites, getLocations } from "@/lib/data/repo";
import { ExpIntake } from "@/components/exp/ExpIntake";

// EXP Intake — the Experience Intelligence Protocol front door (Elicit → Convert
// → Embed). Capture an observation in plain language, let AI draft a structured
// Safety Cell, review, and file it — logging the knowledge-ghost capture.
export default async function IntakePage() {
  const [sites, locations] = await Promise.all([getSites(), getLocations()]);
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">EXP Intake</h1>
        <p className="text-sm text-slate-500">
          Turn what someone saw — in plain words or an interview — into a structured Safety Cell. The Experience Intelligence Protocol&apos;s Convert step.
        </p>
      </div>
      <div className="amaya-scroll flex-1 overflow-auto">
        <ExpIntake sites={sites} locations={locations} />
      </div>
    </>
  );
}
