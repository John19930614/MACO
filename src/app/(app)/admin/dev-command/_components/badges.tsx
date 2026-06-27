import { Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  TONE_CLASS, TONE_DOT, TASK_STATUS_META, RISK_META, PRIORITY_META,
  RUN_STATUS_META, APPROVAL_STATUS_META, DEPLOYMENT_STATUS_META,
  TEST_STATUS_META, SECURITY_VERDICT_META, REVIEW_VERDICT_META,
  type Tone,
} from "@/lib/devcenter/labels";
import type {
  DevTaskStatus, RiskLevel, DevTaskPriority, AgentRunStatus, ApprovalStatus,
  DeploymentStatus, TestStatus, SecurityVerdict, ReviewVerdict,
} from "@/lib/devcenter/types";

/**
 * Generic badge: a tone-colored pill with a dot + word. We always show text
 * (and a shape), so the badge never relies on color alone.
 */
export function Badge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <Pill className={cn(TONE_CLASS[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_DOT[tone] }} />
      {label}
    </Pill>
  );
}

export function TaskStatusBadge({ status }: { status: DevTaskStatus }) {
  const m = TASK_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const m = RISK_META[level];
  return <Badge label={m.label} tone={m.tone} />;
}

export function PriorityBadge({ priority }: { priority: DevTaskPriority }) {
  const m = PRIORITY_META[priority];
  return <Badge label={m.label} tone={m.tone} />;
}

export function RunStatusBadge({ status }: { status: AgentRunStatus }) {
  const m = RUN_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const m = APPROVAL_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const m = DEPLOYMENT_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export function TestStatusBadge({ status }: { status: TestStatus }) {
  const m = TEST_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export function SecurityVerdictBadge({ verdict }: { verdict: SecurityVerdict }) {
  const m = SECURITY_VERDICT_META[verdict];
  return <Badge label={m.label} tone={m.tone} />;
}

export function ReviewVerdictBadge({ verdict }: { verdict: ReviewVerdict }) {
  const m = REVIEW_VERDICT_META[verdict];
  return <Badge label={m.label} tone={m.tone} />;
}
