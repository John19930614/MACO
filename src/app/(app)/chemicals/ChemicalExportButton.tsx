"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { Chemical } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
} from "@/lib/xlsExport";
import type { XlsCell, XlsRow, StyleId } from "@/lib/xlsExport";

const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];

function isHighHazardChem(c: Chemical): boolean {
  return c.is_scheduled || c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh)));
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const INVENTORY_COLS = [180, 90, 120, 65, 50, 120, 80, 85, 90, 140];
const D = 5;

export function ChemicalExportButton({ chemicals }: { chemicals: Chemical[] }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);

    const highHazard  = chemicals.filter(isHighHazardChem);
    const missingSds  = chemicals.filter((c) => !c.sds_url);
    const scheduled   = chemicals.filter((c) => c.is_scheduled);
    const locations   = [...new Set(chemicals.map((c) => c.storage_location).filter(Boolean))];

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────

    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Chemical Inventory",
        "OSHA HazCom Standard — 29 CFR 1910.1200 · GHS Hazard Communication",
        dateStr,
        D,
      ),
      ...kpiBlock(
        [
          { label: "TOTAL CHEMICALS",  value: chemicals.length,    style: "kpi_val" },
          { label: "HIGH HAZARD",       value: highHazard.length,   style: highHazard.length > 0  ? "kpi_red" : "kpi_val" },
          { label: "SCHEDULED / DEA",   value: scheduled.length,    style: scheduled.length > 0   ? "kpi_red" : "kpi_val" },
          { label: "MISSING SDS",       value: missingSds.length,   style: missingSds.length > 0  ? "kpi_red" : "kpi_grn" },
          { label: "LOCATIONS",         value: locations.length,    style: "kpi_blu" },
        ],
        D,
      ),
      sectionRow("INVENTORY STATUS", D),
      theadRow(["Category", "Count", "", "", ""]),
      ...(
        [
          ["All Chemicals",        chemicals.length],
          ["High Hazard / Toxic",  highHazard.length],
          ["Scheduled Substances", scheduled.length],
          ["SDS On File",          chemicals.filter((c) => c.sds_url).length],
          ["Missing SDS",          missingSds.length],
        ] as [string, number][]
      ).map(([lbl, cnt], i): XlsRow => ({
        cells: [
          { v: lbl, s: alt(i) },
          { v: cnt, s: alt(i), t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [
          {
            v: "OSHA HazCom 1910.1200 — Safety Data Sheets must be readily accessible for all hazardous chemicals in the workplace.",
            s: "meta",
            m: D - 1,
          },
        ] as XlsCell[],
      },
    ];

    // ── Shared inventory row builder ────────────────────────────────────────────

    function buildInventoryRow(c: Chemical, i: number): XlsRow {
      const highHaz = isHighHazardChem(c);
      const nameStyle: StyleId = c.is_scheduled ? "danger" : highHaz ? "warn" : alt(i);
      const sdsStyle: StyleId  = c.sds_url ? alt(i) : "danger";
      const riskStyle: StyleId = c.is_scheduled ? "danger" : highHaz ? "warn" : alt(i);
      const schedStyle: StyleId = c.is_scheduled ? "danger" : alt(i);

      return {
        cells: [
          { v: c.name, s: nameStyle },
          { v: c.cas_number ?? "—", s: alt(i) },
          { v: c.supplier ?? "—", s: alt(i) },
          { v: c.quantity ?? null, s: alt(i), t: "Number" },
          { v: c.unit ?? "—", s: alt(i) },
          { v: c.storage_location ?? "—", s: alt(i) },
          { v: c.sds_url ? "On File" : "MISSING — Obtain SDS", s: sdsStyle },
          { v: fmtDate(c.sds_expiry), s: alt(i) },
          { v: c.is_scheduled ? "Yes" : "No", s: schedStyle },
          { v: highHaz ? "HIGH — Carcinogen/Toxic" : "Standard", s: riskStyle },
        ] as XlsCell[],
      };
    }

    // ── Sheet 2: Chemical Inventory ─────────────────────────────────────────────

    const inventoryRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Chemical Inventory",
        "OSHA HazCom Standard — 29 CFR 1910.1200 · GHS Hazard Communication",
        dateStr,
        10,
      ),
      theadRow(["Chemical Name", "CAS #", "Supplier", "Qty", "Unit", "Location", "SDS Status", "SDS Expiry", "Scheduled", "Risk Level"]),
      ...chemicals.map((c, i) => buildInventoryRow(c, i)),
    ];

    // ── Sheet 3: High Hazard & Scheduled ────────────────────────────────────────

    const highHazardRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "High Hazard & Scheduled",
        "OSHA HazCom Standard — 29 CFR 1910.1200 · GHS Hazard Communication",
        dateStr,
        10,
      ),
      ...(highHazard.length === 0
        ? [{ cells: [{ v: "✓ No high-hazard or scheduled substances found.", s: "good", m: 9 }] as XlsCell[] }]
        : [
            theadRow(["Chemical Name", "CAS #", "Supplier", "Qty", "Unit", "Location", "SDS Status", "SDS Expiry", "Scheduled", "Risk Level"]),
            ...highHazard.map((c, i) => buildInventoryRow(c, i)),
          ]),
    ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Chemical-Inventory-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",               cols: Array(D).fill(140), rows: dashRows },
        { name: "Chemical Inventory",       cols: INVENTORY_COLS,     rows: inventoryRows, freeze: 6 },
        { name: "High Hazard & Scheduled",  cols: INVENTORY_COLS,     rows: highHazardRows, freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Inventory
    </button>
  );
}
