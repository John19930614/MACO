import { getSites, getCells, getLocations } from "@/lib/data/repo";
import { SiteMapView } from "@/components/arc/SiteMapView";
import { PageHeader } from "@/components/ui/primitives";

export default async function MapPage() {
  const [sites, cells, locations] = await Promise.all([getSites(), getCells(), getLocations()]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Site Map"
        subtitle="All active sites, risk density, and live Safety Cell coverage by location."
      />
      <SiteMapView sites={sites} cells={cells} locations={locations} />
    </div>
  );
}
