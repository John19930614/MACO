/**
 * AI Dev Command Center — Release planning (Phase 13).
 *
 * Pure functions: the release checklist and the changelog / release notes,
 * computed from a task's real records. Nothing here deploys anything.
 */
import { rollbackPlan } from "./github-plan";
import type {
  DevApproval, DevArtifact, DevDeployment, DevFileChangePlan, DevReviewGate, DevTask, DevTaskMeta, ReviewGateType,
} from "./types";

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;
const gateOk = (gates: DevReviewGate[], type: ReviewGateType) => {
  const g = gates.find((x) => x.gate_type === type);
  return g ? g.status === "passed" || g.status === "waived_by_admin" : false;
};

export interface ReleaseDetail {
  reviewGates: DevReviewGate[];
  approvals: DevApproval[];
  deployments: DevDeployment[];
  filePlans: DevFileChangePlan[];
  artifacts: DevArtifact[];
}

export interface ChecklistItem { label: string; passed: boolean }

/** The 10-item release checklist. */
export function releaseChecklist(task: DevTask, d: ReleaseDetail): ChecklistItem[] {
  const dep = d.deployments[0];
  const prCreated = !!(dep && (dep.pr_number || dep.pull_request_url)) || d.approvals.some((a) => a.approval_type === "pull_request" && a.status === "approved");
  const previewAvail = !!(dep && dep.preview_url) && (dep.status === "preview_ready" || dep.status === "approved_for_production" || dep.status === "production_released");
  const docs = gateOk(d.reviewGates, "documentation") || d.artifacts.some((a) => a.kind === "doc" || a.artifact_type === "documentation");
  const approvalsDone = d.approvals.length > 0 && !d.approvals.some((a) => a.status === "pending");
  const rollback = !!(dep && dep.notes);
  const noHighRisk =
    !d.reviewGates.some((g) => g.gate_type === "security" && (g.status === "failed" || g.status === "needs_revision")) &&
    !d.filePlans.some((p) => (p.risk_level === "high" || p.risk_level === "critical") && p.status !== "approved");
  const finalApproval = d.approvals.some((a) => a.approval_type === "production_release" && a.status === "approved");

  return [
    { label: "Pull request created", passed: prCreated },
    { label: "Preview available", passed: previewAvail },
    { label: "QA passed", passed: gateOk(d.reviewGates, "qa") },
    { label: "Security passed", passed: gateOk(d.reviewGates, "security") },
    { label: "Experience review passed", passed: gateOk(d.reviewGates, "experience") },
    { label: "Documentation complete", passed: docs },
    { label: "Human approval complete", passed: approvalsDone },
    { label: "Rollback plan complete", passed: rollback },
    { label: "No unresolved high-risk findings", passed: noHighRisk },
    { label: "Final approval recorded", passed: finalApproval },
  ];
}

export interface ReleaseSection { label: string; lines: string[] }

/** The 9-section changelog / release notes. */
export function releaseNotes(task: DevTask, d: ReleaseDetail): ReleaseSection[] {
  const m = meta(task);
  const nonRej = d.filePlans.filter((p) => p.status !== "rejected");
  const dbChanges = nonRej.filter((p) => p.change_type === "migration");
  const agents = [...new Set([...d.reviewGates.map((g) => g.agent_name), ...d.artifacts.map((a) => a.created_by)].filter(Boolean) as string[])];
  const expGate = d.reviewGates.find((g) => g.gate_type === "experience");

  return [
    { label: "What changed", lines: [task.title, ...nonRej.map((p) => `${p.change_type}: ${p.file_path}`)] },
    { label: "Why it changed", lines: [m.business_goal || "—"] },
    { label: "Who requested it", lines: [task.created_by || "—"] },
    { label: "Agents involved", lines: agents.length ? agents : ["Dev Manager Agent"] },
    { label: "Files changed", lines: nonRej.length ? nonRej.map((p) => p.file_path) : ["None"] },
    { label: "Database changes", lines: dbChanges.length ? dbChanges.map((p) => p.file_path) : ["None"] },
    { label: "User experience improvements", lines: [m.success_criteria || expGate?.summary || "Keeps the platform simple and clear."] },
    { label: "Risks", lines: [`Risk level: ${task.risk_level}.`] },
    { label: "Rollback plan", lines: [rollbackPlan(task)] },
  ];
}

export function releaseNotesMarkdown(task: DevTask, d: ReleaseDetail): string {
  return releaseNotes(task, d)
    .map((s) => `## ${s.label}\n${s.lines.map((l) => (s.lines.length > 1 ? `- ${l}` : l)).join("\n")}`)
    .join("\n\n");
}
