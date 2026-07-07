/**
 * Daily platform improvement suggestions — shown on the Dev Command Center
 * overview. One suggestion per day, rotated deterministically by date so it
 * stays stable all day and changes at midnight.
 */

export type SuggestionType = "add" | "change" | "improve" | "fix";
export type SuggestionEffort = "small" | "medium" | "large";

export interface PlatformSuggestion {
  id: string;
  type: SuggestionType;
  module: string;
  title: string;
  why: string;
  business_goal: string;
  feature_description: string;
  risk_level: "low" | "medium" | "high";
  effort: SuggestionEffort;
  success_criteria: string;
}

const SUGGESTIONS: PlatformSuggestion[] = [
  {
    id: "csv-incidents",
    type: "add",
    module: "Incidents",
    title: "Add CSV export to the Incidents table",
    why: "Safety managers regularly need to share incident data with leadership and auditors. Right now they screenshot the table or copy rows manually.",
    business_goal: "Let admins download a clean spreadsheet of incidents with one click.",
    feature_description: "Add an Export button to the Incidents page that downloads the current filtered table as a CSV file. Include: date, type, severity, location, reporter, regulatory flag, linked CAPAs, and status.",
    risk_level: "low",
    effort: "small",
    success_criteria: "Clicking Export downloads a CSV with all visible incidents. Filters apply before export. File is named incidents-YYYY-MM-DD.csv.",
  },
  {
    id: "capa-aging-chart",
    type: "add",
    module: "CAPA",
    title: "Add a CAPA aging chart showing how long items have been open",
    why: "Overdue CAPAs are the most common audit finding. A visual aging chart makes it immediately obvious which CAPAs have been sitting too long.",
    business_goal: "Help admins spot CAPAs that are overdue or at risk of becoming overdue before auditors do.",
    feature_description: "Add a bar chart to the CAPA page showing counts by age bucket: 0-7 days, 7-30 days, 30-90 days, 90+ days. Color code: green, amber, red, dark red. Click a bar to filter the table to that age range.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A bar chart shows on the CAPA page above the table. Buckets are color-coded. Clicking a bar filters the table.",
  },
  {
    id: "training-reminder",
    type: "add",
    module: "Training & Competency",
    title: "Send automatic email reminders for training expiring in 30 days",
    why: "Training gaps are the number 2 compliance failure. Admins currently check manually. An automated reminder would eliminate most lapses.",
    business_goal: "Reduce training compliance failures by alerting staff and admins 30 days before a certification expires.",
    feature_description: "Add a setting in Company Settings to enable email reminders. When enabled, send an email to the assigned staff member and their admin 30 days before a training record expires. Use the existing Supabase email integration.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A toggle in Settings enables reminders. Test email sends when toggled on. Staff and admin both receive the reminder 30 days before expiry.",
  },
  {
    id: "incident-heatmap",
    type: "add",
    module: "Incidents",
    title: "Add an incident location heatmap to the Incidents page",
    why: "When multiple incidents happen in the same area, that pattern is invisible in a table. A location heatmap reveals clusters instantly.",
    business_goal: "Help safety managers identify where incidents cluster so they can prioritize preventive action in those areas.",
    feature_description: "Add a simple grid or table heatmap below the incident trend chart showing incident counts by location (using the existing location field). Color cells by count: 0=white, 1-2=amber, 3+=red.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A location breakdown appears on the Incidents page. Cells are color-coded by count. Clicking a cell filters the table to that location.",
  },
  {
    id: "osha-300a-summary",
    type: "add",
    module: "OSHA Logs",
    title: "Generate the OSHA 300A Annual Summary with one click",
    why: "OSHA 300A must be posted every February 1. Right now admins calculate the totals manually from the 300 log.",
    business_goal: "Save the compliance admin 2-3 hours every February and eliminate calculation errors on the mandatory annual posting.",
    feature_description: "Add an OSHA 300A tab to the OSHA Logs page. Auto-calculate the required totals (injuries, illnesses, DART cases, hours worked) from the existing OSHA 300 records and establishment settings. Show a print-ready summary and a PDF export button.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A 300A tab shows on the OSHA page. All required fields auto-populate from live data. PDF export produces a correctly formatted summary ready to post.",
  },
  {
    id: "chemical-sds-expiry",
    type: "add",
    module: "Chemical Management",
    title: "Add SDS expiry alerts to the Chemicals page",
    why: "OSHA requires SDS documents to be current. Expired SDS is one of the most common OSHA citations. Right now there is no expiry tracking.",
    business_goal: "Prevent SDS-related OSHA citations by flagging chemicals whose safety data sheets are overdue for review.",
    feature_description: "Add an SDS review date field to chemical records (defaults to 3 years from upload). Flag chemicals where SDS is expired (red) or expiring in 90 days (amber) in the chemicals table and in the dashboard compliance health.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "Chemicals with overdue SDS show in red. Chemicals with SDS expiring in 90 days show in amber. Dashboard compliance health includes SDS status.",
  },
  {
    id: "document-bulk-acknowledge",
    type: "improve",
    module: "Documents & Programs",
    title: "Add bulk send for document acknowledgment requests",
    why: "Admins currently send acknowledgment requests one document at a time. With a large team this takes 20-30 minutes per document update cycle.",
    business_goal: "Cut the time to request team acknowledgments from 20 minutes to 30 seconds.",
    feature_description: "Add a checkbox column to the Document Register. Allow admins to select multiple documents and send acknowledgment requests to the whole team in one action. Show a confirmation with recipient count before sending.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "Checkboxes appear on the Document Register. Selecting 2+ documents shows a Bulk Send button. Confirmation dialog shows recipient count. Requests send to all active staff.",
  },
  {
    id: "risk-matrix-view",
    type: "add",
    module: "Risk Intelligence",
    title: "Add a 5x5 risk matrix view to the Risk page",
    why: "The current risk register is a table. Safety professionals expect a likelihood vs consequence matrix — it's the industry standard visual for risk communication.",
    business_goal: "Make risk communication faster in meetings and audits by showing a standard risk matrix alongside the existing list view.",
    feature_description: "Add a Matrix tab to the Risk page showing a 5x5 grid of likelihood (rows) vs consequence (columns). Plot each risk assessment as a dot in the correct cell. Color cells: green (low), amber (medium), red (high), dark red (extreme). Click a dot to open the risk record.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A Matrix tab shows on the Risk page. Risks are plotted in the correct cell. Cells are color-coded. Clicking a dot opens the risk record.",
  },
  {
    id: "ai-finding-dismiss-reason",
    type: "improve",
    module: "AI Safety Assistant",
    title: "Require a reason when dismissing an AI finding",
    why: "AI findings are sometimes dismissed without explanation. This makes it impossible to know later if the dismissal was intentional or accidental — and creates an audit gap.",
    business_goal: "Create a clear audit trail for every AI finding decision so compliance reviewers can see why something was accepted or dismissed.",
    feature_description: "When an admin rejects or dismisses an AI finding, show a required text field asking for a brief reason (1-2 sentences). Store the reason with the finding. Show the reason in the finding history and in the audit log.",
    risk_level: "low",
    effort: "small",
    success_criteria: "Dismissing a finding opens a dialog with a required reason field. The reason saves with the finding. The audit log shows the reason. The finding record displays the dismissal reason.",
  },
  {
    id: "compliance-trend",
    type: "add",
    module: "Dashboard",
    title: "Add a 6-month compliance score trend chart to the dashboard",
    why: "The dashboard shows today's compliance score but not whether it is going up or down. Trend is the most important signal for EHS leadership.",
    business_goal: "Give EHS managers one chart that shows whether the platform is improving or declining — so they can report progress to leadership.",
    feature_description: "Add a line chart below the compliance gauge on the dashboard showing compliance scores for each of the last 6 months. One line per major module (Incidents, Training, CAPA, Documents). Requires storing a monthly score snapshot.",
    risk_level: "medium",
    effort: "large",
    success_criteria: "A line chart shows the last 6 months of compliance scores on the dashboard. Lines are labeled per module. Hovering shows the exact score and date.",
  },
  {
    id: "incident-quickcapture",
    type: "add",
    module: "Incidents",
    title: "Add a near-miss quick-capture form accessible from the dashboard",
    why: "Near-miss events go unreported because the full incident form is too long. A 3-field quick form (what, where, when) would dramatically increase near-miss reporting.",
    business_goal: "Increase near-miss reporting by making it fast enough that workers actually use it.",
    feature_description: "Add a Report Near Miss quick-action button on the dashboard. Opens a modal with 3 fields: What happened (text), Where (location picker), When (date/time). Saves as an incident with type=near_miss and status=open. Full details can be added later.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A Report Near Miss button appears on the dashboard. The modal has 3 fields. Submitting creates a real incident record with type=near_miss. The new record appears in the incidents table.",
  },
  {
    id: "waste-manifest-export",
    type: "add",
    module: "Waste Management",
    title: "Add a waste manifest PDF export to the Waste page",
    why: "EPA and state regulators require waste manifests during inspections. Admins currently compile these manually from the waste records.",
    business_goal: "Cut manifest preparation time from 45 minutes to 1 click and reduce errors on regulatory documents.",
    feature_description: "Add an Export Manifest button to the Waste page. For the selected waste stream and date range, generate a PDF formatted as a standard waste manifest with generator info, waste description, quantity, TSDF info, and certification block.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "An Export Manifest button appears on the Waste page. Selecting a waste stream and date range generates a PDF. PDF includes all required manifest fields populated from live data.",
  },
  {
    id: "equipment-qr",
    type: "add",
    module: "Monitoring & Equipment",
    title: "Generate QR code labels for equipment calibration records",
    why: "Field staff need to quickly look up whether equipment is in-calibration. A QR code sticker on the equipment linking to its record eliminates paperwork lookups.",
    business_goal: "Let field staff scan equipment and instantly see calibration status — reducing unsafe use of out-of-calibration equipment.",
    feature_description: "Add a Print QR Label button on each equipment record. Generates a printable label (PDF) with: equipment name, ID, last calibration date, next due date, and a QR code that opens the equipment record in SafetyIQ.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A Print QR Label button appears on equipment records. Clicking it generates a PDF label. The QR code in the label opens the correct equipment record when scanned.",
  },
  {
    id: "biosafety-inspection-checklist",
    type: "add",
    module: "Biosafety & Lab Safety",
    title: "Add a printable inspection checklist to each biosafety lab record",
    why: "Lab inspectors currently create paper checklists manually before each inspection. A generated checklist from the lab record would be faster and more accurate.",
    business_goal: "Cut biosafety inspection prep time in half and ensure every inspection uses the same standardized checklist.",
    feature_description: "Add a Print Inspection Checklist button on each biosafety lab record. Generates a PDF checklist pre-populated with the lab's registered agents, cabinet certifications, and inspection requirements based on BSL level.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A Print Inspection Checklist button appears on biosafety lab records. The PDF includes lab-specific items based on BSL level and registered agents. The checklist has check boxes and a signature line.",
  },
  {
    id: "team-activity-log",
    type: "add",
    module: "Team & Settings",
    title: "Add a team activity log showing who did what and when",
    why: "When something changes in the platform — a CAPA closed, a chemical added, a document updated — there is no easy way for an admin to see who did it.",
    business_goal: "Give admins visibility into team activity for accountability, training follow-up, and audit readiness.",
    feature_description: "Add an Activity tab to the Team page showing a time-sorted log of platform actions by team members: records created, records updated, approvals given, documents acknowledged. Show actor name, action description, and timestamp. Filter by team member.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "An Activity tab shows on the Team page. It lists actions by team members in reverse chronological order. Filtering by a team member shows only their actions.",
  },
  {
    id: "capa-template",
    type: "add",
    module: "CAPA",
    title: "Add CAPA templates for the most common corrective action types",
    why: "Safety managers create the same types of CAPAs repeatedly (chemical spill, slip and fall, equipment failure). Templates would cut CAPA creation time by 50%.",
    business_goal: "Reduce the time to create a well-structured CAPA from 10 minutes to 2 minutes.",
    feature_description: "Add a Use Template option when creating a new CAPA. Provide 8 built-in templates (chemical spill, slip and fall, equipment failure, near miss, training gap, regulatory finding, audit finding, AI recommendation). Each template pre-fills the description, root cause categories, and suggested actions.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A Use Template button appears on the New CAPA form. Selecting a template pre-fills description and suggested root causes. The admin can edit before saving.",
  },
  {
    id: "mobile-incident-report",
    type: "improve",
    module: "Incidents",
    title: "Improve the incident report form for mobile use in the field",
    why: "Most incidents are reported from a phone right after they happen. The current form was designed for desktop and is difficult to use on a small screen.",
    business_goal: "Make it easier for field workers to report incidents immediately, on their phone, without waiting to get back to a computer.",
    feature_description: "Review and improve the incident report form for mobile: larger tap targets, single-column layout on small screens, simplified required fields, camera upload for photos, GPS auto-fill for location. Test at 375px width.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "The incident report form is fully usable on a 375px screen. All form fields have tap targets of at least 44px. Location auto-fills from GPS. Photo upload works from phone camera.",
  },
  {
    id: "risk-reeval-reminder",
    type: "add",
    module: "Risk Intelligence",
    title: "Add annual re-evaluation reminders for risk assessments",
    why: "Risk assessments become stale after a year but there is no prompt to re-evaluate them. Auditors regularly flag outdated risk records.",
    business_goal: "Ensure risk assessments are reviewed at least annually and flag ones that are overdue for re-evaluation.",
    feature_description: "Add a last_reviewed_at date to risk assessments. Flag assessments not reviewed in the past 12 months as due for re-evaluation (amber). Add a Re-evaluate button that timestamps the review and optionally updates the risk scores.",
    risk_level: "low",
    effort: "small",
    success_criteria: "Risk assessments have a Last Reviewed date. Assessments over 12 months old are flagged amber. A Re-evaluate button updates the reviewed date. The risk register can be filtered by re-evaluation status.",
  },
  {
    id: "document-version-history",
    type: "add",
    module: "Documents & Programs",
    title: "Add a version history viewer to document records",
    why: "When a document is updated, the previous version is lost. Auditors frequently ask to see what a document said at a specific point in time.",
    business_goal: "Maintain a full version history for every document so auditors can see the document as it was on any given date.",
    feature_description: "Add a Version History tab to each document record. Show a list of previous versions with version number, date, and changed-by field. Allow admins to view (but not edit) any prior version. Store version snapshots when documents are updated.",
    risk_level: "medium",
    effort: "large",
    success_criteria: "A Version History tab appears on document records. Previous versions are listed with date and author. Clicking a version shows the document as it was at that time.",
  },
  {
    id: "chemical-cas-search",
    type: "improve",
    module: "Chemical Management",
    title: "Add CAS number search to the chemical inventory",
    why: "EHS professionals look up chemicals by CAS number, not trade name. The current search only matches product name, making it slow to find specific chemicals.",
    business_goal: "Let safety managers find any chemical in the inventory in under 5 seconds using its CAS number.",
    feature_description: "Add CAS number to the chemical search filter. Search should match partial CAS numbers. Display the CAS number as a column in the chemical table. Make it sortable.",
    risk_level: "low",
    effort: "small",
    success_criteria: "Typing a CAS number in the search filters the chemical table correctly. Partial CAS numbers match. The CAS number column is visible in the table and sortable.",
  },
  {
    id: "ergonomics-report",
    type: "add",
    module: "Ergonomics & MSD",
    title: "Add a printable ergonomics assessment report for each workstation",
    why: "Ergonomics assessments are often shared with HR and department managers for budgeting and action planning. Currently there is no way to export the assessment.",
    business_goal: "Let EHS coordinators share ergonomics findings with other departments in a professional format.",
    feature_description: "Add a Print Report button to each workstation assessment. Generates a PDF with: workstation details, risk level, assessment results by body region, recommended fixes, and assessor signature block.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A Print Report button appears on workstation assessments. The PDF includes all assessment fields, risk level, and a signature block. The report is branded with the company name.",
  },
  {
    id: "ai-weekly-digest",
    type: "add",
    module: "AI Safety Assistant",
    title: "Add a weekly AI safety digest email summarizing top findings",
    why: "Safety managers don't check the AI findings page daily. A weekly email summary of the top 3 AI recommendations would drive much higher engagement with AI insights.",
    business_goal: "Increase action taken on AI findings by delivering them to managers via email once a week.",
    feature_description: "Add a Weekly Digest setting in Company Settings. When enabled, send a weekly email every Monday with: top 3 AI findings from the past week, compliance score change vs last week, and any overdue CAPAs. Include direct links to each item.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A Weekly Digest toggle appears in Settings. Enabling it sends a test email. The email includes AI findings, compliance score delta, and overdue CAPA count with links.",
  },
  {
    id: "waste-pickup-calendar",
    type: "add",
    module: "Waste Management",
    title: "Add a calendar view for scheduled waste pickups",
    why: "Waste pickup schedules are listed in a table but are hard to visualize against other compliance deadlines. A calendar view makes scheduling conflicts obvious.",
    business_goal: "Make it easy for waste coordinators to see upcoming pickups and plan around other site activities.",
    feature_description: "Add a Calendar tab to the Waste page showing waste pickup appointments on a monthly calendar view. Color code by waste stream type. Click an appointment to see the full pickup details. Allow admins to add/edit pickups from the calendar.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A Calendar tab shows on the Waste page. Upcoming pickups appear on the correct dates. Colors match waste type. Clicking a pickup opens the record.",
  },
  {
    id: "audit-finding-capa-link",
    type: "improve",
    module: "Audits & Assessments",
    title: "Show CAPA status directly on each audit finding row",
    why: "Auditors and managers want to know if a finding has been addressed. Currently you have to open the finding, find the linked CAPA, and check its status — three steps.",
    business_goal: "Let managers see at a glance which audit findings have been resolved vs which are still open.",
    feature_description: "Add a CAPA Status column to the audit findings table. Show the status (open, in progress, closed) of the linked CAPA inline. If no CAPA is linked, show a Create CAPA button. Click the status to go to the CAPA record.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A CAPA Status column appears in the audit findings table. Linked CAPA status shows with color coding. Findings without a CAPA show a Create CAPA button.",
  },
  {
    id: "training-certificate-pdf",
    type: "add",
    module: "Training & Competency",
    title: "Generate training completion certificates as printable PDFs",
    why: "Workers frequently ask for proof of training completion for their personal records or when changing jobs. Currently there is no way to produce this.",
    business_goal: "Let admins instantly produce a signed training certificate for any completed training record.",
    feature_description: "Add a Print Certificate button on completed training records. Generate a PDF certificate with: employee name, course name, completion date, expiry date, and company name. Include a certification statement and admin signature line.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A Print Certificate button appears on completed training records. The PDF is professionally formatted with all required fields. The certificate is branded with the company name.",
  },
  {
    id: "incident-severity-trend",
    type: "add",
    module: "Incidents",
    title: "Add a severity trend chart showing whether incidents are getting more or less serious",
    why: "Total incident count can stay flat while severity increases. Tracking severity trend is the leading indicator that matters most for worker safety.",
    business_goal: "Give EHS managers a clear signal whether incidents are trending more or less severe over time.",
    feature_description: "Add a severity trend line chart below the 12-month incident bar chart on the Incidents page. Show monthly average severity score (1=near miss, 2=first aid, 3=recordable, 4=lost time, 5=fatality). A declining line means safety is improving.",
    risk_level: "low",
    effort: "small",
    success_criteria: "A severity trend chart shows on the Incidents page below the existing bar chart. The line shows monthly average severity. Hovering shows the exact score and month.",
  },
  {
    id: "legal-register-export",
    type: "add",
    module: "Legal Register",
    title: "Add a legal register export to the Legal page",
    why: "Legal registers are frequently shared with auditors and legal counsel as part of compliance reviews. Currently there is no export from the legal register.",
    business_goal: "Let admins export the full legal register as a formatted spreadsheet for audits and legal reviews.",
    feature_description: "Add an Export button to the Legal Register page. Export includes: regulation name, requirement description, compliance status, gap notes, linked CAPAs, and last reviewed date. Export as CSV and optionally as PDF.",
    risk_level: "low",
    effort: "small",
    success_criteria: "An Export button appears on the Legal page. CSV export includes all required columns. File is named legal-register-YYYY-MM-DD.csv.",
  },
  {
    id: "workspace-priority-sort",
    type: "improve",
    module: "Workspace",
    title: "Sort the Workspace task list by priority and due date automatically",
    why: "The Workspace shows tasks in the order they were created. Workers have to manually identify which task is most urgent — which leads to important items being missed.",
    business_goal: "Make sure workers always see their most urgent task first without having to think about it.",
    feature_description: "Auto-sort the Workspace task list by: (1) overdue items first, (2) critical priority, (3) high priority, (4) due soonest. Add a small urgency indicator (days until due or days overdue) next to each task. Keep the manual sort option available.",
    risk_level: "low",
    effort: "small",
    success_criteria: "Workspace tasks are sorted by urgency on load. Overdue items appear first in red. A days-until-due indicator shows next to each task.",
  },
  {
    id: "chemical-label-generator",
    type: "add",
    module: "Chemical Management",
    title: "Add GHS-compliant chemical label printing to the Chemical page",
    why: "Labs frequently need to print secondary container labels. Currently staff create these manually in Word, leading to non-compliant or inconsistent labels.",
    business_goal: "Ensure every secondary container label in the facility is GHS-compliant and generated in under 30 seconds.",
    feature_description: "Add a Print Label button on each chemical record. Generate a GHS-compliant label PDF with: product identifier, signal word, hazard pictograms (from H-codes), hazard statements, precautionary statements, and supplier contact. Size: 4x3 inches.",
    risk_level: "low",
    effort: "medium",
    success_criteria: "A Print Label button appears on chemical records. The PDF includes all GHS-required elements for the chemical's hazard classification. The label is correctly sized for standard label stock.",
  },
];

/** Pick today's suggestion deterministically — same all day, changes at midnight. */
export function getDailySuggestion(dateStr?: string): PlatformSuggestion {
  const today = dateStr ?? new Date().toISOString().split("T")[0];
  // Simple numeric hash of YYYY-MM-DD string
  const hash = today.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SUGGESTIONS[hash % SUGGESTIONS.length];
}

/** The full suggestion pool, in stable order — used for filtering and rotation. */
export function getAllSuggestions(): PlatformSuggestion[] {
  return SUGGESTIONS;
}

/**
 * The next eligible suggestion after `currentId` in the pool (wrapping around),
 * skipping any id in `excludeIds` (dismissed or already turned into a task).
 * Returns null when nothing is eligible.
 */
export function getNextEligibleSuggestion(
  excludeIds: Set<string>,
  currentId?: string,
): PlatformSuggestion | null {
  const eligible = SUGGESTIONS.filter((s) => !excludeIds.has(s.id));
  if (!eligible.length) return null;
  const currentIndex = currentId ? eligible.findIndex((s) => s.id === currentId) : -1;
  return eligible[(currentIndex + 1) % eligible.length];
}

/**
 * Today's suggestion, unless it's been dismissed or already turned into a
 * task — in which case the next eligible suggestion is shown instead. Returns
 * null only when every suggestion in the pool has been excluded.
 */
export function getEligibleDailySuggestion(
  excludeIds: Set<string>,
  dateStr?: string,
): PlatformSuggestion | null {
  const today = getDailySuggestion(dateStr);
  if (!excludeIds.has(today.id)) return today;
  return getNextEligibleSuggestion(excludeIds, today.id);
}

export const SUGGESTION_TYPE_LABEL: Record<SuggestionType, string> = {
  add: "New feature",
  change: "Change",
  improve: "Improvement",
  fix: "Fix",
};

export const SUGGESTION_TYPE_TONE: Record<SuggestionType, string> = {
  add: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  change: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  improve: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  fix: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export const SUGGESTION_EFFORT_LABEL: Record<SuggestionEffort, string> = {
  small: "Small — a few hours",
  medium: "Medium — 1-2 days",
  large: "Large — several days",
};

/** Look up a suggestion by its id — used when pre-filling the new task form. */
export function getSuggestionById(id: string): PlatformSuggestion | undefined {
  return SUGGESTIONS.find((s) => s.id === id);
}

/** Maps effort → task priority so small suggestions get actioned sooner. */
const EFFORT_PRIORITY: Record<SuggestionEffort, string> = {
  small: "high",
  medium: "medium",
  large: "low",
};

/**
 * Returns a complete set of pre-fill values for every field on the new task
 * form — derived from the suggestion so nothing needs to be typed from scratch.
 */
export function getSuggestionPrefill(s: PlatformSuggestion): Record<string, string> {
  const typeWord =
    s.type === "add" ? "new feature" : s.type === "fix" ? "bug fix" : "improvement";

  const whoUsesIt = WHO_USES_IT[s.module] ?? "Company Admin and EHS Coordinator";

  const aiRole =
    `Draft the ${typeWord} described above for the ${s.module} module only. ` +
    `Do not change how existing data is stored or fetched. ` +
    `Do not modify authentication, RLS policies, or user permissions.`;

  const dataInvolved =
    s.risk_level === "low"
      ? `Reads from existing ${s.module} records only. No new database tables or schema changes required. No personal data beyond what is already stored.`
      : `May need minor additions to existing ${s.module} tables. No new sensitive data. No auth or permission changes.`;

  const notes = `Suggested by the daily AI team recommendation (${SUGGESTION_TYPE_LABEL[s.type]} · ${SUGGESTION_EFFORT_LABEL[s.effort]}).`;

  return {
    title: s.title,
    // Links the task back to the suggestion it came from so the Daily
    // Suggestion card can hide it once it's on the task board.
    source_suggestion_id: s.id,
    business_goal: s.business_goal,
    feature_description: s.feature_description,
    module_affected: s.module,
    who_uses_it: whoUsesIt,
    priority: EFFORT_PRIORITY[s.effort],
    risk_level: s.risk_level,
    ai_role: aiRole,
    data_involved: dataInvolved,
    success_criteria: s.success_criteria,
    notes,
  };
}

/** Who uses each module — defaults to admin + coordinator if not listed. */
const WHO_USES_IT: Record<string, string> = {
  "Dashboard":               "Company Admin and EHS Coordinator",
  "Incidents":               "EHS Coordinator, Company Admin, Field Workers",
  "CAPA":                    "EHS Coordinator and Company Admin",
  "OSHA Logs":               "Company Admin and EHS Coordinator",
  "Risk Intelligence":       "EHS Coordinator and Company Admin",
  "Audits & Assessments":    "EHS Coordinator and Auditors",
  "Training & Competency":   "Company Admin, EHS Coordinator, and Employees",
  "Documents & Programs":    "EHS Coordinator and Company Admin",
  "Chemical Management":     "EHS Coordinator and Lab Safety Officers",
  "Biosafety & Lab Safety":  "Biosafety Officer and Lab Managers",
  "Waste Management":        "Waste Coordinator and EHS Coordinator",
  "Ergonomics & MSD":        "EHS Coordinator and Ergonomics Assessors",
  "Monitoring & Equipment":  "EHS Coordinator and Maintenance Staff",
  "Legal Register":          "Company Admin and EHS Coordinator",
  "AI Safety Assistant":     "Company Admin and EHS Coordinator",
  "Reports & Analytics":     "Company Admin and EHS Coordinator",
  "Workspace":               "All platform users",
  "Team & Settings":         "Company Admin",
};
