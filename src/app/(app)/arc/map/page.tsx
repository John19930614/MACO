import { SITES, CELLS, LOCATIONS } from "@/lib/data/mock";
import { SiteMapView } from "@/components/arc/SiteMapView";
import { PageHeader } from "@/components/ui/primitives";

export default function MapPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Site Map"
        subtitle="All active sites, risk density, and live Safety Cell coverage by location."
      />
      <SiteMapView sites={SITES} cells={CELLS} locations={LOCATIONS} />
    </div>
  );
}
