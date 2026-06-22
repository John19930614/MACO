import type { Vertical } from "@/lib/arc/arc";
import type { Site, SafetyCell, HslReading, VelaInsight } from "@/lib/types";

export interface VerticalStats {
  vertical: Vertical;
  site: Site;
  totalCells: number;
  openCells: number;
  criticalCount: number;
  highCount: number;
  avgRisk: number;
  openActions: number;
  proofGapCount: number;
  proofTotal: number;
  topCells: SafetyCell[];
  hslReadings: HslReading[];
  velaPatterns: VelaInsight[];
  topGaps: { gap: string; count: number }[];
}
