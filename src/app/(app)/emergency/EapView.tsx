"use client";

import { Phone, MapPin, Heart, ShieldAlert, Flame, Droplets, Eye, Building2, Users, Clock, AlertTriangle, Megaphone, ClipboardCheck, Zap, Droplet, Flame as FlameIcon } from "lucide-react";
import type { EapRecord } from "@/lib/actions/eap";

function Missing({ label }: { label: string }) {
  return <span className="text-slate-400 italic text-sm">Not configured — edit to add {label}</span>;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function EapView({ eap }: { eap: EapRecord }) {
  const chain = eap.call_chain ?? [];
  const utilityShutoffs = eap.utility_shutoffs ?? [];
  const afterHours = eap.after_hours_contacts ?? [];
  const backupContacts = eap.backup_contacts ?? [];
  const postSteps = eap.post_incident_steps ?? [];

  return (
    <div className="space-y-5 print:space-y-4">

      {/* ── Header ── */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center print:border-red-400">
        <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-1">In Case of Emergency</p>
        <h1 className="text-3xl font-black text-red-600 mb-1">CALL 911 FIRST</h1>
        <p className="text-sm text-red-700">Then follow the call responsibility structure below</p>
        {(eap.facility_name || eap.facility_address) && (
          <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap justify-center gap-4 text-sm text-red-800">
            {eap.facility_name && <span className="font-semibold">{eap.facility_name}</span>}
            {eap.facility_address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{eap.facility_address}</span>}
          </div>
        )}
        {eap.site_command_post && (
          <p className="mt-2 text-xs text-red-700"><strong>Site Command Post:</strong> {eap.site_command_post} — Leadership meets here during emergencies</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ── Left column: call chain ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Call Chain */}
          <Section title="Emergency Call Responsibility" icon={<Phone className="h-4 w-4" />}>
            {chain.length === 0 ? <Missing label="call chain contacts" /> : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-3">If unable to reach someone, leave a message and call the next person.</p>
                {chain.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{i + 1}</div>
                    <div className="flex-1 rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.role}</p>
                      <p className="font-semibold text-slate-900">{entry.name}</p>
                      <p className="text-sm text-blue-700 font-medium">{entry.phone}</p>
                      {entry.alt_name && (
                        <p className="mt-1 text-xs text-slate-500">Alt: {entry.alt_name} — {entry.alt_phone}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Incident Notification Timeline */}
          <Section title="Incident Notification Timeline" icon={<Clock className="h-4 w-4" />}>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Immediately", color: "red", items: eap.notify_immediately ?? [] },
                { label: "Within 1 Hour", color: "amber", items: eap.notify_within_1hr ?? [] },
                { label: "Before Work Resumes", color: "blue", items: eap.notify_before_resuming ?? [] },
              ].map(({ label, color, items }) => (
                <div key={label} className={`rounded-lg border p-3 border-${color}-200 bg-${color}-50`}>
                  <p className={`text-xs font-bold uppercase tracking-wide text-${color}-700 mb-2`}>{label}</p>
                  {items.length === 0 ? <p className="text-xs text-slate-400 italic">Not set</p> : (
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className={`text-xs text-${color}-800 flex items-start gap-1`}>
                          <span className="mt-0.5">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Post-Incident Requirements */}
          <Section title="Post-Incident Requirements" icon={<ClipboardCheck className="h-4 w-4" />}>
            {postSteps.length === 0 ? <Missing label="post-incident steps" /> : (
              <ol className="space-y-2">
                {postSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">{i + 1}</span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Backup Contacts */}
          {backupContacts.length > 0 && (
            <Section title="Backup Contacts" icon={<Users className="h-4 w-4" />}>
              <p className="text-xs text-slate-500 mb-3">At least one alternate for every key person.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Role</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Primary</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Phone</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Alternate</th>
                      <th className="pb-2 text-left text-xs font-semibold text-slate-500">Alt Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupContacts.map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 font-medium text-slate-700">{c.role}</td>
                        <td className="py-2 text-slate-600">{c.primary_name}</td>
                        <td className="py-2 text-blue-700 font-medium">{c.primary_phone}</td>
                        <td className="py-2 text-slate-500">{c.alt_name || "—"}</td>
                        <td className="py-2 text-slate-500">{c.alt_phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>

        {/* ── Right column: quick-ref panels ── */}
        <div className="space-y-5">

          {/* Key Contacts */}
          <Section title="Key Contacts" icon={<Users className="h-4 w-4" />}>
            <div className="space-y-3">
              {[
                { label: "Safety Coordinator", data: eap.safety_coordinator },
                { label: "EHS Advisor", data: eap.ehs_advisor },
                { label: "Facilities Manager", data: eap.facilities_manager },
              ].map(({ label, data }) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="font-medium text-slate-800">{data?.name || <span className="text-slate-400 italic text-sm">Not set</span>}</p>
                  {data?.phone && <p className="text-sm text-blue-700 font-medium">{data.phone}</p>}
                </div>
              ))}
            </div>
          </Section>

          {/* Emergency Equipment */}
          <Section title="Emergency Equipment" icon={<ShieldAlert className="h-4 w-4" />}>
            <div className="space-y-2">
              {[
                { icon: <Heart className="h-4 w-4 text-red-500" />, label: "AED", value: eap.aed_location },
                { icon: <ShieldAlert className="h-4 w-4 text-red-400" />, label: "First Aid", value: eap.first_aid_location },
                { icon: <Flame className="h-4 w-4 text-orange-500" />, label: "Fire Extinguisher", value: eap.fire_extinguisher_location },
                { icon: <Droplets className="h-4 w-4 text-blue-500" />, label: "Spill Kit", value: eap.spill_kit_location },
                { icon: <Eye className="h-4 w-4 text-cyan-500" />, label: "Eyewash", value: eap.eyewash_location },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">{label}</p>
                    <p className="text-xs text-slate-500">{value || <span className="italic">Not set</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Assembly Areas */}
          <Section title="Assembly / Muster Points" icon={<Users className="h-4 w-4" />}>
            <div className="space-y-2">
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">Primary</p>
                <p className="text-sm font-medium text-green-800">{eap.primary_muster_point || <span className="italic text-slate-400">Not set</span>}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Secondary</p>
                <p className="text-sm font-medium text-blue-800">{eap.secondary_muster_point || <span className="italic text-slate-400">Not set</span>}</p>
              </div>
              <p className="text-xs text-slate-400">All personnel report to muster point for accountability.</p>
            </div>
          </Section>

          {/* Nearest Hospital */}
          <Section title="Nearest Hospital / Clinic" icon={<Heart className="h-4 w-4" />}>
            {!eap.hospital_name ? <Missing label="hospital info" /> : (
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">{eap.hospital_name}</p>
                {eap.hospital_address && <p className="text-sm text-slate-600">{eap.hospital_address}</p>}
                {eap.hospital_phone && <p className="text-sm text-blue-700 font-medium">{eap.hospital_phone}</p>}
                {eap.hospital_distance && <p className="text-xs text-slate-500">{eap.hospital_distance}</p>}
                {eap.hospital_route && (
                  <div className="mt-2 rounded bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Route</p>
                    <p className="text-xs text-slate-600">{eap.hospital_route}</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Weather/Shelter */}
          <Section title="Weather & Shelter Plans" icon={<AlertTriangle className="h-4 w-4" />}>
            <div className="space-y-3">
              {[
                { label: "Severe Weather Shelter", value: eap.severe_weather_shelter },
                { label: "Tornado / High Wind", value: eap.tornado_shelter },
                { label: "Lightning Plan", value: eap.lightning_plan },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="text-sm text-slate-700">{value}</p>
                </div>
              ) : null)}
              {!eap.severe_weather_shelter && !eap.tornado_shelter && !eap.lightning_plan && <Missing label="shelter plans" />}
            </div>
          </Section>

          {/* Utility Shutoffs */}
          <Section title="Utility Shutoff Contacts" icon={<Zap className="h-4 w-4" />}>
            {utilityShutoffs.length === 0 ? <Missing label="utility contacts" /> : (
              <div className="space-y-2">
                {utilityShutoffs.map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="font-medium text-slate-700">{u.utility}</span>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{u.contact}</p>
                      <p className="text-blue-700 font-medium">{u.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* After-Hours */}
          {afterHours.length > 0 && (
            <Section title="After-Hours Emergency" icon={<Phone className="h-4 w-4" />}>
              <div className="space-y-2">
                {afterHours.map((c, i) => (
                  <div key={i} className="rounded-lg bg-slate-800 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.role}</p>
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <p className="text-sm text-blue-300 font-medium">{c.phone}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Media & Regulatory */}
          <Section title="Media & Regulatory" icon={<Megaphone className="h-4 w-4" />}>
            <div className="space-y-3">
              {eap.media_spokesperson_name && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Only Authorized Spokesperson</p>
                  <p className="font-medium text-amber-900">{eap.media_spokesperson_name}</p>
                  {eap.media_spokesperson_phone && <p className="text-sm text-amber-700">{eap.media_spokesperson_phone}</p>}
                  <p className="text-xs text-amber-600 mt-1">No one else is authorized to speak to media or public.</p>
                </div>
              )}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">OSHA 24/7</span><span className="font-medium text-blue-700">{eap.osha_phone || "(800) 321-6742"}</span></div>
                {eap.regulatory_contact_name && (
                  <div className="flex justify-between"><span className="text-slate-500">{eap.regulatory_contact_name}</span><span className="font-medium text-blue-700">{eap.regulatory_contact_phone}</span></div>
                )}
              </div>
            </div>
          </Section>

          {/* Additional Notes */}
          {eap.additional_notes && (
            <Section title="Additional Notes" icon={<ClipboardCheck className="h-4 w-4" />}>
              <p className="text-sm text-slate-700 whitespace-pre-line">{eap.additional_notes}</p>
            </Section>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-xs text-slate-500">
        {eap.last_reviewed_at && <>Last reviewed: <strong>{eap.last_reviewed_at}</strong>{eap.reviewed_by && <> by {eap.reviewed_by}</>} · </>}
        Version {eap.version || "1.0"} · Post at all emergency stations and review during safety orientations.
      </div>
    </div>
  );
}
