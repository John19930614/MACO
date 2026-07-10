// EPA RCRA hazardous-waste generator categories.
//
// Category is determined from a site's HAZARDOUS waste generated in a calendar
// month plus its ACUTE hazardous waste. Thresholds (40 CFR 262.13):
//   • VSQG — < 100 kg/mo hazardous AND < 1 kg/mo acute hazardous
//   • SQG  — 100 to < 1,000 kg/mo hazardous AND < 1 kg/mo acute hazardous
//   • LQG  — >= 1,000 kg/mo hazardous, OR >= 1 kg/mo acute hazardous
//
// Pure and dependency-free so it is shared by the server action and the tests.

export type GeneratorCategory = "VSQG" | "SQG" | "LQG";

export const SQG_MIN_KG = 100;
export const LQG_MIN_KG = 1000;
export const ACUTE_LQG_MIN_KG = 1;

export function computeGeneratorCategory(
  hazardousKg: number,
  acuteHazardousKg: number,
): GeneratorCategory {
  // Any acute hazardous at/above threshold forces LQG regardless of total.
  if (acuteHazardousKg >= ACUTE_LQG_MIN_KG || hazardousKg >= LQG_MIN_KG) return "LQG";
  if (hazardousKg >= SQG_MIN_KG) return "SQG";
  return "VSQG";
}

export const GENERATOR_CATEGORY_META: Record<
  GeneratorCategory,
  { label: string; long: string; description: string }
> = {
  VSQG: {
    label: "VSQG",
    long: "Very Small Quantity Generator",
    description: "Under 100 kg/month of hazardous waste (and under 1 kg/month acute).",
  },
  SQG: {
    label: "SQG",
    long: "Small Quantity Generator",
    description: "100–1,000 kg/month of hazardous waste.",
  },
  LQG: {
    label: "LQG",
    long: "Large Quantity Generator",
    description: "1,000 kg/month or more of hazardous waste, or 1 kg/month or more acute.",
  },
};
