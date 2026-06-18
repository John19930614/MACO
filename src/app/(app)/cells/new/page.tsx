import { getSites, getLocations } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/primitives";
import { SafetyCellForm } from "@/components/cells/SafetyCellForm";

export default async function NewCellPage() {
  const [sites, locations] = await Promise.all([getSites(), getLocations()]);
  return (
    <>
      <PageHeader title="Create Safety Cell" subtitle="Fast enough for the field, structured enough for AI analysis (manual §5.7)." />
      <div className="amaya-scroll flex-1 overflow-auto">
        <SafetyCellForm sites={sites} locations={locations} />
      </div>
    </>
  );
}
