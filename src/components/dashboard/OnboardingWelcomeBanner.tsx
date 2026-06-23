"use client";

import React, { useState } from "react";
import { CheckCircle2, Users, X, Mail, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { inviteTeamMembers } from "@/lib/actions/team";

interface ExtractedEmployee {
  display_name: string;
  email?: string | null;
  job_title?: string | null;
  department?: string | null;
}

interface Props {
  companyName: string;
  seededCounts: Record<string, number>;
  extractedEmployees: ExtractedEmployee[];
}

const STAT_LABELS: Record<string, string> = {
  chemicals:          "chemicals",
  training_courses:   "training courses",
  legal_requirements: "legal requirements",
  risk_assessments:   "risk assessments",
  incidents:          "historical incidents",
  equipment:          "equipment items",
  audits:             "past audits",
  audit_findings:     "audit findings",
  sop_documents:      "documents & SOPs",
  employees:          "employees extracted",
  biosafety_labs:     "biosafety labs",
  biohazard_agents:   "biohazard agents",
  waste_streams:      "waste streams",
};

export function OnboardingWelcomeBanner({ companyName, seededCounts, extractedEmployees }: Props) {
  const [dismissed,  setDismissed]  = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(
    new Set(extractedEmployees.filter(e => e.email).map(e => e.email!)),
  );
  const [inviting,   setInviting]   = useState(false);
  const [sentCount,  setSentCount]  = useState<number | null>(null);

  if (dismissed) return null;

  const invitable = extractedEmployees.filter(e => e.email?.trim());
  const total     = Object.values(seededCounts).reduce((a, b) => a + b, 0);
  const visibleStats = Object.entries(seededCounts)
    .filter(([k, v]) => v > 0 && STAT_LABELS[k])
    .slice(0, 8);

  function toggleEmployee(email: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function handleInvite() {
    setInviting(true);
    const toInvite = invitable
      .filter(e => selected.has(e.email!))
      .map(e => ({
        email:      e.email!,
        name:       e.display_name,
        jobTitle:   e.job_title   ?? undefined,
        department: e.department  ?? undefined,
      }));
    const result = await inviteTeamMembers(toInvite);
    setInviting(false);
    if (result.ok) {
      setSentCount(result.sent);
      setShowInvite(false);
    }
  }

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-900">
              {companyName ? `${companyName} is live on SafetyIQ!` : "Your workspace is live!"}
            </div>
            <div className="mt-0.5 text-xs text-emerald-700">
              {total > 0
                ? `AI imported ${total.toLocaleString()} records from your uploaded documents — your team can start working right away.`
                : "Your EHS modules are ready. Upload documents any time to auto-populate your data."}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-0.5 shrink-0 text-emerald-400 transition hover:text-emerald-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Seeded stat pills ────────────────────────────────────────── */}
      {visibleStats.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {visibleStats.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
            >
              <span className="font-bold">{value.toLocaleString()}</span>
              {STAT_LABELS[key]}
            </span>
          ))}
        </div>
      )}

      {/* ── Invite section ───────────────────────────────────────────── */}
      {sentCount !== null ? (
        <div className="flex items-center gap-2 border-t border-emerald-200 px-5 py-3 text-xs text-emerald-700">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            <span className="font-semibold">{sentCount} invite{sentCount !== 1 ? "s" : ""} sent</span> — your team will receive an email to create their account.
          </span>
        </div>
      ) : invitable.length > 0 && (
        <div className="border-t border-emerald-200 px-5 py-3">
          {!showInvite ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-emerald-700">
                <span className="font-semibold">{invitable.length} employee{invitable.length !== 1 ? "s" : ""}</span> extracted from your roster — invite them now.
              </p>
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                <Users className="h-3.5 w-3.5" />
                Invite Team
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-800">Select who to invite:</p>
                <div className="flex gap-3 text-xs text-emerald-600">
                  <button type="button" onClick={() => setSelected(new Set(invitable.map(e => e.email!)))} className="hover:underline">Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())} className="hover:underline">Clear</button>
                  <button type="button" onClick={() => setShowInvite(false)} className="hover:underline opacity-60">
                    <ChevronUp className="inline h-3 w-3" /> Collapse
                  </button>
                </div>
              </div>

              <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {invitable.map(emp => (
                  <label
                    key={emp.email}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 transition hover:bg-emerald-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(emp.email!)}
                      onChange={() => toggleEmployee(emp.email!)}
                      className="h-3.5 w-3.5 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-800">{emp.display_name}</div>
                      <div className="truncate text-[10px] text-slate-500">
                        {emp.email}
                        {emp.job_title ? ` · ${emp.job_title}` : ""}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviting || selected.size === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Mail className="h-3.5 w-3.5" />}
                  {inviting
                    ? "Sending…"
                    : `Send ${selected.size} invite${selected.size !== 1 ? "s" : ""}`}
                </button>
                <span className="text-xs text-emerald-600">Team members receive a magic-link email to set their password.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
