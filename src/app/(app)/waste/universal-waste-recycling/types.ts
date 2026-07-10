// Row shapes for the Universal-Waste & Recycling page (subset of the DB columns
// the UI actually reads). Kept alongside the page so the server component and the
// client component share one definition.

export type DeterminationResult = "hazardous" | "universal_waste" | "nonhazardous" | "excluded";
export type UwCategory =
  | "batteries" | "lamps" | "mercury_equipment" | "aerosol_cans"
  | "pesticides" | "e_waste" | "used_oil" | "solvents";

export interface Determination {
  id: string;
  material_description: string;
  determination_result: DeterminationResult;
  jurisdiction_state: string | null;
  status: string;
  determined_at: string;
}

export interface UwItem {
  id: string;
  determination_id: string;
  category: UwCategory;
  handler_class: "small_quantity" | "large_quantity";
  jurisdiction_state: string;
  quantity: number | null;
  quantity_uom: string | null;
  quantity_limit: number | null;
  accumulation_start_date: string;
  accumulation_deadline: string;
  inspection_frequency_days: number | null;
  status: "accumulating" | "shipped" | "rejected" | "closed";
  retention_period_years: number | null;
}

export interface NonhazRecord {
  id: string;
  material_category: string;
  weight_recycled: number | null;
  weight_landfill: number | null;
  weight_uom: string | null;
  diversion_rate: number | null;
  cost_avoided: number | null;
  revenue: number | null;
  vendor_id: string | null;
  status: "active" | "rejected" | "closed";
  created_at: string;
}

export interface VendorLite {
  id: string;
  name: string;
  permit_expiry: string | null;
  insurance_expiry: string | null;
  recycler_authorization_expiry: string | null;
  status: string | null;
}

export interface Certificate {
  id: string;
  universal_waste_item_id: string | null;
  nonhaz_recycling_record_id: string | null;
  certificate_type: "recycling" | "reclamation" | "destruction";
  issued_date: string;
  document_url: string;
  status: string;
}

export interface RejectedLoad {
  id: string;
  universal_waste_item_id: string | null;
  nonhaz_recycling_record_id: string | null;
  rejected_reason: string;
  rejected_at: string;
  resolved_at: string | null;
}
