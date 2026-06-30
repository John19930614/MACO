import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/primitives";
import { TaskStatusBadge, PriorityBadge, RiskLevelBadge, Badge } from "../../_components/badges";
import { TaskTimeline } from "../../_components/TaskTimeline";
import { AgentOutputPanel } from "../../_components/AgentOutputPanel";
import { FileChangePlanViewer } from "../../_components/FileChangePlanViewer";
import { ApprovalCenter } from "../../_components/ApprovalCenter";
import { TestResultsPanel } from "../../_components/TestResultsPanel";
import { SecurityReviewPanel } from "../../_components/SecurityReviewPanel";
import { ExperienceReviewPanel } from "../../_components/ExperienceReviewPanel";
import { ReleasePanel } from "../../_components/ReleasePanel";
import { ChangelogPanel } from "../../_components/ChangelogPanel";
import { releaseChecklist, releaseNotes, type ReleaseDetail } from "@/lib/devcenter/release";
import { AgentTeamBoard } from "../../_components/AgentTeamBoard";
import { AuditLogTable } from "../../_components/AuditLogTable";
import { PlanningOutputPanel } from "../../_components/PlanningOutputPanel";
import { ArtifactViewer } from "../../_components/ArtifactViewer";
import { ReviewChecklistPanel } from "../../_components/ReviewChecklistPanel";
import { ExperienceScorecard } from "../../_components/ExperienceScorecard";
import { RequiredFixesPanel } from "../../_components/RequiredFixesPanel";
import { PlainEnglishTable } from "../../_components/PlainEnglishTable";
import { TestPlanPanel } from "../../_components/TestPlanPanel";
import { AppliedChangesPanel } from "../../_components/AppliedChangesPanel";
import { testPlan } from "@/lib/devcenter/qa-tests";
import { BranchPlanPanel } from "../../_components/BranchPlanPanel";
import { PullRequestPlanPanel } from "../../_components/PullRequestPlanPanel";
import { RunNextStepButton } from "../../_components/RunNextStepButton";
import { DeleteTaskButton } from "../../_components/DeleteTaskButton";
import { getTaskDetail, getGithubSettings } from "@/lib/devcenter/repo";
import { taskBundle, SAMPLE_AUDIT, getAgentsOrSample } from "@/lib/devcenter/sample";
import { WORKFLOW_STAGES, stageIndex, isWorkflowStage, isTerminal } from "@/lib/devcenter/workflow";
import { branchName, prSections, prTitle, releaseRisk } from "@/lib/devcenter/github-plan";
import { relativeTime } from "@/lib/utils";
import { ArrowLeft, Target, Flag, ShieldCheck, Lock, Workflow, Code2, ClipboardList } from "lucide-react";
import type { DevTaskMeta } from "@/lib/devcenter/types";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  // Real task from Supabase; fall back to the Phase 2 sample tasks by id.
  const real = await getTaskDetail(taskId);
  const view = real.task
    ? real
    : { ...taskBundle(taskId), audit: SAMPLE_AUDIT.filter((a) => a.task_id === taskId) };
  if (!view.task) notFound();

  const t = view.task;
  const isReal = !!real.task;
  const meta = (t.metadata ?? {}) as DevTaskMeta;
  const { agents } = await getAgentsOrSample();
  const onStage = isWorkflowStage(t.status);
  const stageNum = isWorkflowStage(t.status) ? stageIndex(t.status) + 1 : 0;
  const canRun = isReal && onStage && !isTerminal(t.status) && t.status !== "blocked";

  // "Ready for code" = the planning is done and the team has produced code drafts.
  const CODE_READY_STAGES = [
    "code_draft", "qa_review", "security_review", "experience_final_review",
    "documentation", "release_plan", "human_final_approval",
  ];
  const isCodeReady = CODE_READY_STAGES.includes(t.status);

  // Split artifacts so each panel shows its own kind (no duplication).
  const planningArtifacts = view.artifacts.filter((a) => (a.structured as Record<string, unknown> | null)?._agent);
  const codeDraftArtifacts = view.artifacts.filter((a) => a.artifact_type && a.artifact_type !== "release_notes");
  const otherArtifacts = view.artifacts.filter((a) => !(a.structured as Record<string, unknown> | null)?._agent && !a.artifact_type);

  // Phase 11 — GitHub branch/PR plan (prepared, not executed).
  const githubSettings = await getGithubSettings();
  const branch = branchName(t);
  const agentsInvolved = [...new Set(view.reviewGates.map((g) => g.agent_name).filter(Boolean) as string[])];
  const prPlanSections = prSections({ task: t, filePlans: view.filePlans, reviewGates: view.reviewGates, approvals: view.approvals, agentsInvolved });
  const release = releaseRisk(t, view.filePlans, view.approvals);
  const approvedForBranch = view.artifacts
    .filter((a) => a.status === "approved" || a.status === "ready_for_branch")
    .map((a) => ({ id: a.id, title: a.title ?? "Draft", path: a.path }));
  const githubRequested = view.approvals.some((a) => a.approval_type === "github_branch" || a.approval_type === "pull_request");

  // Phase 13 — release planning + preview tracking.
  const releaseDetail: ReleaseDetail = { reviewGates: view.reviewGates, approvals: view.approvals, deployments: view.deployments, filePlans: view.filePlans, artifacts: view.artifacts };
  const checklist = releaseChecklist(t, releaseDetail);
  const changelogSections = releaseNotes(t, releaseDetail);
  const latestDeployment = view.deployments[0] ?? null;
  const productionRequested = view.approvals.some((a) => a.approval_type === "production_release");

  const permissions = [
    { label: "Database changes", on: meta.database_changes_allowed },
    { label: "File changes", on: meta.file_changes_allowed },
    { label: "Code branch", on: meta.github_branch_allowed },
    { label: "Deploy preview", on: meta.deployment_allowed },
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/dev-command/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {/* 1-4. Task summary + status + priority + risk */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.title}</h2>
            {t.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>}
            <p className="mt-2 text-xs text-slate-400">{t.target_area ?? "Platform"} · created {relativeTime(t.created_at)} · updated {relativeTime(t.updated_at)}{t.created_by ? ` · by ${t.created_by}` : ""}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <PriorityBadge priority={t.priority} />
            <RiskLevelBadge level={t.risk_level} />
            <TaskStatusBadge status={t.status} />
            {isReal && <DeleteTaskButton taskId={t.id} taskTitle={t.title} />}
          </div>
        </div>
      </div>

      {/* Ready-for-code instructions banner */}
      {isCodeReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
              <Code2 className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">The team has finished planning — code changes are ready</p>
                <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
                  The AI team has written out exactly what needs to change in the app. Here&apos;s how to get it live:
                </p>
              </div>
              <ol className="space-y-2">
                {[
                  { step: "1", text: "Scroll down to 'Proposed changes' below — you'll see the exact code the team wrote." },
                  { step: "2", text: "Share this page with your developer, or paste this page's URL into a message to Claude Code and ask it to apply the changes shown." },
                  { step: "3", text: "Once the changes are applied and tested, come back here and click 'Run next step' to continue through the review and release stages." },
                  { step: "4", text: "When you reach 'Going live' at the bottom of this page, give your final approval and the change goes live." },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                      {step}
                    </span>
                    <p className="text-sm text-amber-800 dark:text-amber-300">{text}</p>
                  </li>
                ))}
              </ol>
              <div className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 dark:bg-amber-900/50">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Not sure what to do?</strong> Copy this page&apos;s URL and send it to whoever helps you with the technical side. They&apos;ll know exactly what to do with it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow control — run the next stage (real tasks only) */}
      {isReal && (
        <Card>
          <CardHeader title="Progress" subtitle="The AI team works through this one step at a time — you approve anything important" right={<Workflow className="h-4 w-4 text-slate-300" />} />
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Current stage:</span>
                <TaskStatusBadge status={t.status} />
                {onStage && <span className="text-xs text-slate-400">Step {stageNum} of {WORKFLOW_STAGES.length}</span>}
              </div>
              {canRun
                ? <RunNextStepButton taskId={t.id} />
                : <span className="text-xs font-medium text-slate-400">{isTerminal(t.status) ? "This task is finished." : t.status === "blocked" ? "Paused." : ""}</span>}
            </div>
            {onStage && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.round((stageNum / WORKFLOW_STAGES.length) * 100)}%` }} />
              </div>
            )}
            {t.status === "approval_required" || t.status === "human_final_approval" ? (
              <p className="text-xs text-violet-600">This task is waiting on your approval below. Approve it, then run the next step.</p>
            ) : null}
          </div>
        </Card>
      )}

      {/* 5-6. Business goal + success criteria + details + safety controls */}
      <Card>
        <CardHeader title="About this task" subtitle="What you asked for and how we'll know it's done" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <Detail icon={<Flag className="h-4 w-4" />} label="Why this matters" value={meta.business_goal} />
          <Detail icon={<Target className="h-4 w-4" />} label="How we know it's done" value={meta.success_criteria} />
          <Detail label="Who uses it" value={meta.who_uses_it} />
          <Detail label="Sensitive information involved" value={meta.data_involved} />
          <Detail label="What the team is focused on" value={meta.ai_role} />
          <Detail label="Extra notes" value={meta.notes} />
        </div>
        {meta.visual_reference && (
          <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Visual reference</p>
            <img
              src={meta.visual_reference}
              alt="Visual reference uploaded by task creator"
              className="max-h-96 rounded-lg border border-slate-200 object-contain shadow-sm dark:border-slate-700"
            />
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> What the team is allowed to do
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge label="Your approval always required" tone="success" />
            {permissions.map((p) =>
              p.on ? (
                <Badge key={p.label} label={`${p.label}: allowed`} tone="info" />
              ) : (
                <span key={p.label} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Lock className="h-3 w-3" /> {p.label}: off
                </span>
              ),
            )}
          </div>
        </div>
      </Card>

      {/* ── Section: Planning ─────────────────────────────────────────────── */}
      <SectionLabel label="Planning" hint="What the team is planning to do — they figure out the technical details so you don't have to" />
      <PlanningOutputPanel artifacts={planningArtifacts} />

      {/* ── Section: Code ─────────────────────────────────────────────────── */}
      <SectionLabel label="Proposed changes" hint="What the team wants to change — nothing is saved until you approve it" />
      <ArtifactViewer artifacts={codeDraftArtifacts} actionable={isReal} />
      <AppliedChangesPanel changes={view.appliedChanges} />
      <FileChangePlanViewer plans={view.filePlans} actionable={isReal} />

      {/* ── Section: Review ───────────────────────────────────────────────── */}
      <SectionLabel label="Quality check" hint="The team checks their own work before asking you to approve anything" />
      <ExperienceScorecard gates={view.reviewGates} approvals={view.approvals} />
      <RequiredFixesPanel gates={view.reviewGates} />
      <PlainEnglishTable />
      <ReviewChecklistPanel gates={view.reviewGates} actionable={isReal} />
      <TestPlanPanel plan={testPlan(t)} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <TestResultsPanel results={view.testResults} />
          <ExperienceReviewPanel reviews={view.experienceReviews} />
        </div>
        <div className="space-y-5">
          <SecurityReviewPanel reviews={view.securityReviews} taskId={t.id} actionable={isReal} />
          <AgentOutputPanel artifacts={otherArtifacts} />
        </div>
      </div>

      {/* ── Section: Approvals ────────────────────────────────────────────── */}
      <SectionLabel label="Your approvals" hint="The team has paused and is waiting for your go-ahead before doing anything that changes the app" />
      <ApprovalCenter approvals={view.approvals} title="Waiting for your approval" subtitle="Review each item and approve or reject it — nothing happens until you do" actionable={isReal} />

      {/* ── Section: Release ──────────────────────────────────────────────── */}
      <SectionLabel label="Going live" hint="The final steps to put the finished change into the real app" />
      <BranchPlanPanel
        settings={githubSettings} branch={branch} risk={release} approvedArtifacts={approvedForBranch}
        taskId={t.id} actionable={isReal} alreadyRequested={githubRequested}
      />
      <PullRequestPlanPanel title={prTitle(t, githubSettings.pr_title_template)} sections={prPlanSections} />
      <ReleasePanel deployment={latestDeployment} checklist={checklist} taskId={t.id} actionable={isReal} productionRequested={productionRequested} />
      <ChangelogPanel sections={changelogSections} />

      {/* ── Section: Timeline & Team ──────────────────────────────────────── */}
      <SectionLabel label="Activity &amp; team" hint="Everything the AI team has done on this task, in order" />
      <TaskTimeline runs={view.runs} messages={view.messages} agents={agents} />
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">The AI team on this task</p>
        <AgentTeamBoard agents={agents} />
      </div>

      {/* ── Section: Audit log ────────────────────────────────────────────── */}
      <SectionLabel label="Audit log" hint="Every action on this task — by agents and by you — is logged here permanently" />
      <AuditLogTable entries={view.audit} />
    </div>
  );
}

function SectionLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2 pt-1 dark:border-slate-700">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</h3>
      {hint && <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}{label}
      </p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{value?.trim() ? value : <span className="text-slate-300 dark:text-slate-600">—</span>}</p>
    </div>
  );
}
