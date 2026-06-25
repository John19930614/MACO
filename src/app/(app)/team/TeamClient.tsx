"use client";

import { useState } from "react";
import { Users, Mail, Check, Loader2, UserPlus, CircleUser, Copy } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { inviteTeamMembers, type EmployeeInvite, type InviteLink } from "@/lib/actions/team";

interface Member {
  id: string;
  display_name: string;
  role: string;
  job_title: string | null;
  department: string | null;
  active: boolean;
}
interface RosterEmployee {
  display_name: string;
  email?: string | null;
  job_title?: string | null;
  department?: string | null;
}
interface Props {
  members: Member[];
  roster: RosterEmployee[];
  invitedEmails: string[];
}

const ROLE_STYLE: Record<string, string> = {
  owner:   "bg-violet-100 text-violet-700",
  admin:   "bg-blue-100 text-blue-700",
  manager: "bg-teal-100 text-teal-700",
  member:  "bg-slate-100 text-slate-600",
  viewer:  "bg-slate-100 text-slate-500",
};

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InviteLinks({ links }: { links: InviteLink[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  function copyAll(inv: InviteLink) {
    const text = `SafetyIQ login details for ${inv.name}\nURL: ${inv.loginUrl}\nEmail: ${inv.email}\nTemp password: ${inv.tempPassword}\n\nPlease log in and change your password in Settings.`;
    copy(`all-${inv.email}`, text);
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        Accounts created — share these login details with each person
      </div>
      <div className="space-y-2">
        {links.map((inv) => (
          <div key={inv.email} className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">{inv.name}</div>
                <div className="text-[10px] text-slate-500">{inv.email}</div>
              </div>
              <button
                type="button"
                onClick={() => copyAll(inv)}
                className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
              >
                {copied === `all-${inv.email}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === `all-${inv.email}` ? "Copied!" : "Copy all"}
              </button>
            </div>
            <div className="space-y-1 rounded-lg bg-slate-50 p-2 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">URL</span>
                <span className="truncate text-slate-700">{inv.loginUrl}</span>
                <button type="button" onClick={() => copy(`url-${inv.email}`, inv.loginUrl)} className="shrink-0 text-blue-500 hover:text-blue-700"><Copy className="h-3 w-3" /></button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Email</span>
                <span className="truncate text-slate-700">{inv.email}</span>
                <button type="button" onClick={() => copy(`em-${inv.email}`, inv.email)} className="shrink-0 text-blue-500 hover:text-blue-700"><Copy className="h-3 w-3" /></button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Temp pw</span>
                <span className="text-slate-700">{inv.tempPassword}</span>
                <button type="button" onClick={() => copy(`pw-${inv.email}`, inv.tempPassword)} className="shrink-0 text-blue-500 hover:text-blue-700"><Copy className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-emerald-600">Share these details securely. They can update their password in Settings after signing in.</p>
    </div>
  );
}

export function TeamClient({ members, roster, invitedEmails }: Props) {
  const [invited, setInvited] = useState<Set<string>>(
    new Set(invitedEmails.map((e) => e.toLowerCase())),
  );

  const withEmail = roster.filter((e) => e.email?.trim());
  const noEmail   = roster.filter((e) => !e.email?.trim());

  function isInvited(email?: string | null) {
    return email ? invited.has(email.trim().toLowerCase()) : false;
  }

  const [selected, setSelected] = useState<Set<string>>(
    new Set(withEmail.filter((e) => !isInvited(e.email)).map((e) => e.email!.toLowerCase())),
  );
  const [sending, setSending]       = useState(false);
  const [feedback, setFeedback]     = useState<string>("");
  const [feedbackErr, setFeedbackErr] = useState(false);
  const [rosterLinks, setRosterLinks] = useState<InviteLink[]>([]);

  const [mEmail, setMEmail]     = useState("");
  const [mName, setMName]       = useState("");
  const [mTitle, setMTitle]     = useState("");
  const [mSending, setMSending] = useState(false);
  const [mFeedback, setMFeedback] = useState("");
  const [mLinks, setMLinks]     = useState<InviteLink[]>([]);

  function toggle(email: string) {
    const key = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function sendRosterInvites() {
    const toInvite: EmployeeInvite[] = withEmail
      .filter((e) => selected.has(e.email!.toLowerCase()))
      .map((e) => ({
        email:      e.email!,
        name:       e.display_name,
        jobTitle:   e.job_title ?? undefined,
        department: e.department ?? undefined,
      }));
    if (toInvite.length === 0) return;

    setSending(true);
    setFeedback("");
    setFeedbackErr(false);
    setRosterLinks([]);
    try {
      const res = await inviteTeamMembers(toInvite);
      if (res.ok) {
        setInvited((prev) => {
          const next = new Set(prev);
          toInvite.forEach((e) => next.add(e.email.toLowerCase()));
          return next;
        });
        setSelected(new Set());
        setFeedbackErr(false);
        setFeedback(
          `${res.sent} invite${res.sent !== 1 ? "s" : ""} ready.` +
          (res.errors.length ? ` ${res.errors.length} failed.` : ""),
        );
        if (res.links?.length) setRosterLinks(res.links);
      } else {
        setFeedbackErr(true);
        setFeedback(res.error ?? "Could not send invites — please try again.");
      }
    } catch {
      setFeedbackErr(true);
      setFeedback("Could not send invites — please try again.");
    } finally {
      setSending(false);
    }
  }

  async function sendManualInvite() {
    const email = mEmail.trim().toLowerCase();
    const name  = mName.trim();
    if (!email || !name) {
      setMFeedback("Enter both a name and an email.");
      return;
    }
    setMSending(true);
    setMFeedback("");
    setMLinks([]);

    try {
      const res = await inviteTeamMembers([{ email, name, jobTitle: mTitle.trim() || undefined }]);
      if (res.ok && res.sent > 0) {
        setInvited((prev) => new Set(prev).add(email));
        setMEmail(""); setMName(""); setMTitle("");
        setMFeedback("Invite ready! Copy the link below and send it to them.");
        if (res.links?.length) setMLinks(res.links);
      } else {
        setMFeedback(
          res.ok
            ? (res.errors[0] ?? "No invite generated.")
            : (res.error ?? "Could not generate invite."),
        );
      }
    } catch {
      setMFeedback("Could not generate invite — please try again.");
    } finally {
      setMSending(false);
    }
  }

  const pendingInviteCount = withEmail.filter((e) => isInvited(e.email)).length;

  return (
    <div className="space-y-5">
      {/* ── Team Members directory ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Team Members"
          subtitle={`${members.length} ${members.length === 1 ? "person has" : "people have"} an active account`}
        />
        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No team members yet"
            description="Invite people from your onboarding roster below, or invite someone by email. They'll get a link to set a password and join your workspace."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Role</th>
                  <th className="px-4 py-2.5 text-left">Job Title</th>
                  <th className="px-4 py-2.5 text-left">Department</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CircleUser className="h-4 w-4 text-slate-300" />
                        <span className="font-medium text-slate-800">{m.display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={`${ROLE_STYLE[m.role] ?? "bg-slate-100 text-slate-600"} text-xs`}>
                        {titleCase(m.role)}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.job_title ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.department ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Pill className={m.active ? "bg-emerald-100 text-emerald-700 text-xs" : "bg-slate-100 text-slate-500 text-xs"}>
                        {m.active ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Invite from onboarding roster ──────────────────────────────── */}
      {roster.length > 0 && (
        <Card>
          <CardHeader
            title="Onboarding Roster"
            subtitle={`${roster.length} extracted · ${pendingInviteCount} invited · ${withEmail.length - pendingInviteCount} not yet invited`}
          />
          <div className="space-y-3 p-4">
            {withEmail.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Select who to invite</p>
                  <div className="flex gap-3 text-xs text-blue-600">
                    <button type="button" className="hover:underline" onClick={() => setSelected(new Set(withEmail.filter((e) => !isInvited(e.email)).map((e) => e.email!.toLowerCase())))}>
                      Select all uninvited
                    </button>
                    <button type="button" className="hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
                  </div>
                </div>

                <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {withEmail.map((emp) => {
                    const already = isInvited(emp.email);
                    return (
                      <label
                        key={emp.email}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                          already
                            ? "border-slate-100 bg-slate-50 cursor-default"
                            : "border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={already}
                          checked={already || selected.has(emp.email!.toLowerCase())}
                          onChange={() => toggle(emp.email!)}
                          className="h-3.5 w-3.5 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-slate-800">{emp.display_name}</div>
                          <div className="truncate text-[10px] text-slate-500">
                            {emp.email}{emp.job_title ? ` · ${emp.job_title}` : ""}
                          </div>
                        </div>
                        {already && <Pill className="bg-emerald-100 text-emerald-700 text-[10px]">Invited</Pill>}
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={sendRosterInvites}
                    disabled={sending || selected.size === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    {sending ? "Generating…" : `Invite ${selected.size} person${selected.size !== 1 ? "s" : ""}`}
                  </button>
                  {feedback && (
                    <span className={`flex items-center gap-1 text-xs ${feedbackErr ? "text-red-600" : "text-emerald-700"}`}>
                      {!feedbackErr && <Check className="h-3.5 w-3.5" />} {feedback}
                    </span>
                  )}
                </div>
                {rosterLinks.length > 0 && <InviteLinks links={rosterLinks} />}
              </>
            )}

            {noEmail.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
                <span className="font-semibold">{noEmail.length}</span> roster {noEmail.length === 1 ? "person has" : "people have"} no email on file
                ({noEmail.map((e) => e.display_name).slice(0, 6).join(", ")}{noEmail.length > 6 ? "…" : ""}).
                Add their email using the invite box below.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Invite someone by email ────────────────────────────────────── */}
      <Card>
        <CardHeader title="Invite by Email" subtitle="Add anyone who isn't on the roster" right={<UserPlus className="h-4 w-4 text-slate-400" />} />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Full name</label>
            <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Jane Doe"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Work email</label>
            <input type="email" value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="jane@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Job title (optional)</label>
            <input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Lab Manager"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <button
            type="button"
            onClick={sendManualInvite}
            disabled={mSending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {mSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {mSending ? "Generating…" : "Invite"}
          </button>
        </div>
        {mFeedback && <div className="px-4 pb-3 text-xs text-slate-600">{mFeedback}</div>}
        {mLinks.length > 0 && <div className="px-4 pb-4"><InviteLinks links={mLinks} /></div>}
      </Card>
    </div>
  );
}
