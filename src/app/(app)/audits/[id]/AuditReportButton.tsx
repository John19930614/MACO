"use client";

import { Printer } from "lucide-react";
import type { Audit, AuditFinding } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  internal: "Internal", external: "External", regulatory: "Regulatory",
  supplier: "Supplier", system: "System", process: "Process",
};
const SEV_COLOR: Record<string, string> = {
  critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open", in_progress: "In Progress", closed: "Closed", accepted_risk: "Accepted Risk",
};
const RESULT_LABEL: Record<string, string> = {
  pass: "Pass", partial: "Partial", fail: "Fail", na: "N/A",
};
const RESULT_COLOR: Record<string, string> = {
  pass: "#16a34a", partial: "#d97706", fail: "#dc2626", na: "#64748b",
};

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function esc(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

// ── Conducted-checklist data persisted in audit.notes ──────────────────────────

interface ConductedItem {
  id: string;
  section: string;
  text: string;
  result: "pass" | "partial" | "fail" | "na" | null;
  notes?: string;
  photoCount?: number;
}
interface ConductedData {
  conductedBy?: string;
  conductedDate?: string;
  score?: number | null;
  overallNotes?: string;
  items?: ConductedItem[];
  oshaStandard?: { code: string; title: string; cfr: string } | null;
}

function parseConducted(notes: string | null): ConductedData {
  if (!notes) return {};
  try {
    const p = JSON.parse(notes);
    // `items` was historically persisted either as a bare array or nested as
    // { oshaStandard, items: [...] } — accept both shapes.
    let items: ConductedItem[] | undefined;
    let osha = p.oshaStandard ?? null;
    if (Array.isArray(p.items)) items = p.items;
    else if (p.items && Array.isArray(p.items.items)) {
      items = p.items.items;
      osha = osha ?? p.items.oshaStandard ?? null;
    }
    return {
      conductedBy: p.conductedBy,
      conductedDate: p.conductedDate,
      score: p.score,
      overallNotes: p.overallNotes,
      items,
      oshaStandard: osha,
    };
  } catch {
    return {};
  }
}

interface Props {
  audit: Audit;
  findings: AuditFinding[];
  profileMap: Record<string, string>;
  tenantName: string;
}

export function AuditReportButton({ audit, findings, profileMap, tenantName }: Props) {
  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;

    const conducted = parseConducted(audit.notes);
    const items = conducted.items ?? [];
    const hasItems = items.length > 0;
    const isConducted =
      audit.status === "completed" ||
      conducted.score != null ||
      items.some((i) => i.result !== null);

    // ── Checklist results grouped by section ──────────────────────────────────
    const sectionOrder: string[] = [];
    const grouped = new Map<string, ConductedItem[]>();
    for (const it of items) {
      if (!grouped.has(it.section)) { grouped.set(it.section, []); sectionOrder.push(it.section); }
      grouped.get(it.section)!.push(it);
    }

    const checklistHtml = hasItems
      ? sectionOrder
          .map((sec) => {
            const rows = grouped
              .get(sec)!
              .map(
                (it) => `
                <tr>
                  <td style="max-width:340px">${esc(it.text)}${it.notes ? `<br><small style="color:#64748b">${esc(it.notes)}</small>` : ""}</td>
                  <td><span style="color:${RESULT_COLOR[it.result ?? ""] ?? "#94a3b8"};font-weight:700">${it.result ? RESULT_LABEL[it.result] : "—"}</span></td>
                  <td style="text-align:center;color:#94a3b8">${it.photoCount ? `📷 ${it.photoCount}` : ""}</td>
                </tr>`,
              )
              .join("");
            return `
              <h2>${esc(sec)}</h2>
              <table class="checklist">
                <thead><tr><th>Item</th><th style="width:90px">Result</th><th style="width:70px;text-align:center">Photos</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>`;
          })
          .join("")
      : "";

    // ── Result breakdown (from conducted checklist) ───────────────────────────
    const passC = items.filter((i) => i.result === "pass").length;
    const partialC = items.filter((i) => i.result === "partial").length;
    const failC = items.filter((i) => i.result === "fail").length;
    const naC = items.filter((i) => i.result === "na").length;

    // ── Findings table (audit_findings → corrective actions) ──────────────────
    const findingRows = findings
      .slice()
      .sort((a, b) => {
        const order = ["critical", "high", "medium", "low"];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      })
      .map(
        (f) => `
        <tr>
          <td style="max-width:280px">${esc(f.title)}<br><small style="color:#64748b">${esc(f.description)}</small></td>
          <td><span style="color:${SEV_COLOR[f.severity] ?? "#64748b"};font-weight:700;text-transform:capitalize">${f.severity}</span></td>
          <td style="text-transform:capitalize">${esc(f.category.replace(/_/g, " "))}</td>
          <td>${esc(profileMap[f.owner_id ?? ""]) || "—"}</td>
          <td>${fmt(f.due_date)}</td>
          <td>${STATUS_LABEL[f.status] ?? f.status}</td>
          <td>${f.capa_required ? (f.capa_id ? "Linked" : "Required") : "No"}</td>
        </tr>`,
      )
      .join("");

    const openCount = findings.filter((f) => f.status === "open" || f.status === "in_progress").length;
    const criticalCount = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
    const score = conducted.score;
    const scoreColor = score == null ? "#64748b" : score >= 85 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";

    // ── KPI cards ─────────────────────────────────────────────────────────────
    const kpis = isConducted
      ? `
        ${score != null ? `<div class="kpi"><div class="kpi-num" style="color:${scoreColor}">${score}%</div><div class="kpi-lbl">Audit Score</div></div>` : ""}
        <div class="kpi"><div class="kpi-num" style="color:#16a34a">${passC}</div><div class="kpi-lbl">Pass</div></div>
        <div class="kpi"><div class="kpi-num" style="color:#d97706">${partialC}</div><div class="kpi-lbl">Partial</div></div>
        <div class="kpi"><div class="kpi-num" style="color:#dc2626">${failC}</div><div class="kpi-lbl">Fail</div></div>
        <div class="kpi"><div class="kpi-num" style="color:#64748b">${naC}</div><div class="kpi-lbl">N/A</div></div>
        <div class="kpi"><div class="kpi-num">${findings.length}</div><div class="kpi-lbl">Findings</div></div>`
      : `
        <div class="kpi"><div class="kpi-num">${findings.length}</div><div class="kpi-lbl">Total Findings</div></div>
        <div class="kpi"><div class="kpi-num" style="color:#dc2626">${criticalCount}</div><div class="kpi-lbl">Critical / High</div></div>
        <div class="kpi"><div class="kpi-num" style="color:#d97706">${openCount}</div><div class="kpi-lbl">Open</div></div>`;

    const statusBanner = isConducted
      ? `<div class="banner ok">✓ Conducted by ${esc(conducted.conductedBy) || "—"} &nbsp;·&nbsp; ${fmt(conducted.conductedDate ?? audit.completed_date)}</div>`
      : `<div class="banner pending">This audit has not yet been conducted — scheduled for ${fmt(audit.scheduled_date)}.</div>`;

    const findingsSection =
      findings.length > 0
        ? `
      <h2>Findings &amp; Corrective Actions</h2>
      <table>
        <thead><tr>
          <th>Finding</th><th>Severity</th><th>Category</th><th>Owner</th><th>Due Date</th><th>Status</th><th>CAPA</th>
        </tr></thead>
        <tbody>${findingRows}</tbody>
      </table>`
        : isConducted
          ? `<h2>Findings &amp; Corrective Actions</h2><div class="no-findings">No separate corrective-action findings were recorded for this audit.</div>`
          : "";

    w.document.write(`<!DOCTYPE html><html><head>
<title>${esc(audit.title)} — Audit Report</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;margin:40px;color:#1e293b;line-height:1.5}
  h1{font-size:22px;font-weight:800;margin:0 0 4px}
  h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;
     margin:26px 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;page-break-after:avoid}
  .meta{color:#64748b;font-size:13px;margin:0 0 6px}
  .banner{margin:14px 0 4px;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600}
  .banner.ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
  .banner.pending{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
  .kpis{display:flex;gap:12px;margin:18px 0;flex-wrap:wrap}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;min-width:96px}
  .kpi-num{font-size:26px;font-weight:800;color:#1e293b}
  .kpi-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
  table.checklist{margin-bottom:6px}
  th{background:#f8fafc;text-align:left;padding:9px 10px;border-bottom:2px solid #e2e8f0;
     font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr{page-break-inside:avoid}
  .notes-block{margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px}
  .notes-block .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:3px}
  .no-findings{color:#94a3b8;padding:14px 2px;font-size:12px}
  .footer{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
  @media print{body{margin:20px}.no-print{display:none}}
</style></head><body>
<h1>${esc(audit.title)}</h1>
<div class="meta">${esc(tenantName)} &nbsp;·&nbsp; ${TYPE_LABEL[audit.type] ?? audit.type} Audit</div>
<div class="meta">
  Scheduled: ${fmt(audit.scheduled_date)}
  ${audit.completed_date ? ` &nbsp;·&nbsp; Completed: ${fmt(audit.completed_date)}` : ""}
  ${audit.lead_auditor_id ? ` &nbsp;·&nbsp; Lead Auditor: ${esc(profileMap[audit.lead_auditor_id]) || "—"}` : ""}
</div>
${audit.scope ? `<div class="meta"><em>Scope: ${esc(audit.scope)}</em></div>` : ""}
${conducted.oshaStandard ? `<div class="meta"><em>Standard: ${esc(conducted.oshaStandard.code)} — ${esc(conducted.oshaStandard.title)} (${esc(conducted.oshaStandard.cfr)})</em></div>` : ""}

${statusBanner}

<div class="kpis">${kpis}</div>

${conducted.overallNotes ? `<div class="notes-block"><div class="lbl">Overall Observations</div>${esc(conducted.overallNotes)}</div>` : ""}

${hasItems ? `<h2 style="border:0;margin-bottom:0">Checklist Results</h2>${checklistHtml}` : ""}

${findingsSection}

<div class="footer">
  Generated by SafetyIQ &nbsp;·&nbsp; Reliance Predictive Safety Technologies &nbsp;·&nbsp; ${new Date().toLocaleString()}
</div>
<script>window.onload = function(){ window.focus(); window.print(); }</script>
</body></html>`);
    w.document.close();
  }

  return (
    <button
      onClick={printReport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
    >
      <Printer className="h-3.5 w-3.5" />
      Print Report
    </button>
  );
}
