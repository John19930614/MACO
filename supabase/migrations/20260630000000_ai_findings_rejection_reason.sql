-- Add rejection_reason column to ai_findings for audit trail on dismissed findings
alter table ai_findings add column if not exists rejection_reason text;
