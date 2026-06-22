import { CausalityAndPrevention } from "@/components/arc/CausalityAndPrevention";
import { PageHeader } from "@/components/ui/primitives";

export default function CausalityPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Causality & Prevention"
        subtitle="Causal chains between Safety Cells and control-gap → cell → prevention pathways."
      />
      <div className="flex-1" style={{ minHeight: 0 }}>
        <CausalityAndPrevention />
      </div>
    </div>
  );
}
