// Curated suggestion lists for waste-module comboboxes. Every field that uses
// these still accepts a typed-in value — the lists just make the common cases
// one click.

// General hazardous / universal-waste materials seen on a determination.
export const COMMON_WASTE_MATERIALS: readonly string[] = [
  "Spent AA/AAA batteries",
  "Lead-acid batteries",
  "Lithium-ion batteries",
  "Fluorescent lamps / tubes",
  "HID lamps",
  "Mercury-containing devices / thermostats",
  "Aerosol cans",
  "Spent solvents",
  "Used oil",
  "Waste paint & thinner",
  "Contaminated rags & absorbents",
  "Electronic waste (e-waste)",
  "Toner & ink cartridges",
  "Acids (corrosive)",
  "Bases / caustics (corrosive)",
  "Oxidizers",
  "Pesticides / herbicides",
  "Antifreeze / coolant",
  "Cutting oils & coolants",
  "Photographic / developer solution",
  "Laboratory chemicals (lab pack)",
  "Cleaning chemicals",
];

// Common nonhazardous recyclable material streams.
export const COMMON_RECYCLABLE_MATERIALS: readonly string[] = [
  "Cardboard / OCC",
  "Mixed paper",
  "Scrap metal",
  "Aluminum",
  "Steel",
  "Plastic — PET (#1)",
  "Plastic — HDPE (#2)",
  "Plastic film / shrink wrap",
  "Glass",
  "Wood pallets",
  "Electronics",
  "Organics / compost",
  "Tires",
  "Concrete / aggregate",
];

// Common reasons a load is rejected.
export const COMMON_REJECT_REASONS: readonly string[] = [
  "Improperly labeled",
  "Leaking container",
  "Incompatible materials mixed",
  "Missing / incomplete manifest",
  "Prohibited item in load",
  "Over-limit quantity",
  "Free liquids present",
  "Unidentified material",
  "Container damaged",
  "Exceeded accumulation time",
];

// US states + DC as { value: 2-letter code, label: name }. Shown as a dropdown
// but the field still accepts a typed 2-letter code.
export const US_STATES: readonly { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" }, { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" }, { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" }, { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" }, { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];
