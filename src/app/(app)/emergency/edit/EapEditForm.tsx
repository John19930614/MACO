"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Loader2, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { saveEap } from "@/lib/actions/eap";
import type { EapRecord, CallChainEntry, UtilityShutoff, AfterHoursContact, BackupContact } from "@/lib/actions/eap";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    />
  );
}

export function EapEditForm({ eap }: { eap: EapRecord | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Facility
  const [facilityName, setFacilityName] = useState(eap?.facility_name ?? "");
  const [facilityAddress, setFacilityAddress] = useState(eap?.facility_address ?? "");
  const [siteCommandPost, setSiteCommandPost] = useState(eap?.site_command_post ?? "");
  const [version, setVersion] = useState(eap?.version ?? "1.0");
  const [lastReviewed, setLastReviewed] = useState(eap?.last_reviewed_at ?? "");
  const [reviewedBy, setReviewedBy] = useState(eap?.reviewed_by ?? "");

  // Call chain
  const [chain, setChain] = useState<CallChainEntry[]>(
    eap?.call_chain?.length ? eap.call_chain : [{ role: "", name: "", phone: "", alt_name: "", alt_phone: "" }]
  );

  // Key contacts
  const [safetyCoordName, setSafetyCoordName] = useState(eap?.safety_coordinator?.name ?? "");
  const [safetyCoordPhone, setSafetyCoordPhone] = useState(eap?.safety_coordinator?.phone ?? "");
  const [ehsAdvisorName, setEhsAdvisorName] = useState(eap?.ehs_advisor?.name ?? "");
  const [ehsAdvisorPhone, setEhsAdvisorPhone] = useState(eap?.ehs_advisor?.phone ?? "");
  const [facilitiesMgrName, setFacilitiesMgrName] = useState(eap?.facilities_manager?.name ?? "");
  const [facilitiesMgrPhone, setFacilitiesMgrPhone] = useState(eap?.facilities_manager?.phone ?? "");

  // Equipment
  const [aedLoc, setAedLoc] = useState(eap?.aed_location ?? "");
  const [firstAidLoc, setFirstAidLoc] = useState(eap?.first_aid_location ?? "");
  const [fireExtLoc, setFireExtLoc] = useState(eap?.fire_extinguisher_location ?? "");
  const [spillKitLoc, setSpillKitLoc] = useState(eap?.spill_kit_location ?? "");
  const [eyewashLoc, setEyewashLoc] = useState(eap?.eyewash_location ?? "");

  // Assembly
  const [primaryMuster, setPrimaryMuster] = useState(eap?.primary_muster_point ?? "");
  const [secondaryMuster, setSecondaryMuster] = useState(eap?.secondary_muster_point ?? "");

  // Hospital
  const [hospitalName, setHospitalName] = useState(eap?.hospital_name ?? "");
  const [hospitalAddress, setHospitalAddress] = useState(eap?.hospital_address ?? "");
  const [hospitalPhone, setHospitalPhone] = useState(eap?.hospital_phone ?? "");
  const [hospitalRoute, setHospitalRoute] = useState(eap?.hospital_route ?? "");
  const [hospitalDistance, setHospitalDistance] = useState(eap?.hospital_distance ?? "");

  // Shelter
  const [severeWeather, setSevereWeather] = useState(eap?.severe_weather_shelter ?? "");
  const [tornadoShelter, setTornadoShelter] = useState(eap?.tornado_shelter ?? "");
  const [lightningPlan, setLightningPlan] = useState(eap?.lightning_plan ?? "");

  // Utility shutoffs
  const [utilities, setUtilities] = useState<UtilityShutoff[]>(
    eap?.utility_shutoffs?.length ? eap.utility_shutoffs : [{ utility: "", contact: "", phone: "" }]
  );

  // After-hours
  const [afterHours, setAfterHours] = useState<AfterHoursContact[]>(
    eap?.after_hours_contacts?.length ? eap.after_hours_contacts : [{ role: "", name: "", phone: "" }]
  );

  // Notification timeline
  const [notifyNow, setNotifyNow] = useState((eap?.notify_immediately ?? []).join("\n"));
  const [notify1hr, setNotify1hr] = useState((eap?.notify_within_1hr ?? []).join("\n"));
  const [notifyResume, setNotifyResume] = useState((eap?.notify_before_resuming ?? []).join("\n"));

  // Media / regulatory
  const [mediaNam, setMediaNam] = useState(eap?.media_spokesperson_name ?? "");
  const [mediaPhn, setMediaPhn] = useState(eap?.media_spokesperson_phone ?? "");
  const [oshaPhone, setOshaPhone] = useState(eap?.osha_phone ?? "(800) 321-6742");
  const [regName, setRegName] = useState(eap?.regulatory_contact_name ?? "");
  const [regPhone, setRegPhone] = useState(eap?.regulatory_contact_phone ?? "");

  // Backup contacts
  const [backupContacts, setBackupContacts] = useState<BackupContact[]>(
    eap?.backup_contacts?.length ? eap.backup_contacts : [{ role: "", primary_name: "", primary_phone: "", alt_name: "", alt_phone: "" }]
  );

  // Post-incident
  const [postSteps, setPostSteps] = useState<string[]>(
    eap?.post_incident_steps?.length ? eap.post_incident_steps : ["Ensure safety / stop work", "Secure the scene", "Provide first aid / medical care"]
  );

  // Additional
  const [additionalNotes, setAdditionalNotes] = useState(eap?.additional_notes ?? "");

  function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEap({
        facility_name: facilityName || null,
        facility_address: facilityAddress || null,
        site_command_post: siteCommandPost || null,
        version: version || "1.0",
        last_reviewed_at: lastReviewed || null,
        reviewed_by: reviewedBy || null,
        call_chain: chain.filter(c => c.name || c.role),
        safety_coordinator: { name: safetyCoordName, phone: safetyCoordPhone },
        ehs_advisor: { name: ehsAdvisorName, phone: ehsAdvisorPhone },
        facilities_manager: { name: facilitiesMgrName, phone: facilitiesMgrPhone },
        aed_location: aedLoc || null,
        first_aid_location: firstAidLoc || null,
        fire_extinguisher_location: fireExtLoc || null,
        spill_kit_location: spillKitLoc || null,
        eyewash_location: eyewashLoc || null,
        primary_muster_point: primaryMuster || null,
        secondary_muster_point: secondaryMuster || null,
        hospital_name: hospitalName || null,
        hospital_address: hospitalAddress || null,
        hospital_phone: hospitalPhone || null,
        hospital_route: hospitalRoute || null,
        hospital_distance: hospitalDistance || null,
        severe_weather_shelter: severeWeather || null,
        tornado_shelter: tornadoShelter || null,
        lightning_plan: lightningPlan || null,
        utility_shutoffs: utilities.filter(u => u.utility),
        after_hours_contacts: afterHours.filter(a => a.name || a.role),
        notify_immediately: notifyNow.split("\n").map(s => s.trim()).filter(Boolean),
        notify_within_1hr: notify1hr.split("\n").map(s => s.trim()).filter(Boolean),
        notify_before_resuming: notifyResume.split("\n").map(s => s.trim()).filter(Boolean),
        media_spokesperson_name: mediaNam || null,
        media_spokesperson_phone: mediaPhn || null,
        osha_phone: oshaPhone || "(800) 321-6742",
        regulatory_contact_name: regName || null,
        regulatory_contact_phone: regPhone || null,
        backup_contacts: backupContacts.filter(b => b.role || b.primary_name),
        post_incident_steps: postSteps.filter(Boolean),
        additional_notes: additionalNotes || null,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => router.push("/emergency"), 1200);
      } else {
        setError(result.error ?? "Save failed.");
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Facility Info */}
      <FormSection title="Facility Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Facility / Site Name">
            <Input value={facilityName} onChange={setFacilityName} placeholder="e.g. Main Research Campus" />
          </Field>
          <Field label="Address">
            <Input value={facilityAddress} onChange={setFacilityAddress} placeholder="123 Main St, City, State ZIP" />
          </Field>
        </div>
        <Field label="Site Command Post" hint="Where leadership meets during an emergency">
          <Input value={siteCommandPost} onChange={setSiteCommandPost} placeholder="e.g. Main Lobby — Conference Room A" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Plan Version"><Input value={version} onChange={setVersion} placeholder="1.0" /></Field>
          <Field label="Last Reviewed"><input type="date" value={lastReviewed} onChange={e => setLastReviewed(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></Field>
          <Field label="Reviewed By"><Input value={reviewedBy} onChange={setReviewedBy} placeholder="Name, Title" /></Field>
        </div>
      </FormSection>

      {/* Call Chain */}
      <FormSection title="Emergency Call Responsibility Chain">
        <p className="text-xs text-slate-500">List in order — if you can&apos;t reach #1, call #2, etc.</p>
        <div className="space-y-3">
          {chain.map((entry, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{i + 1}</span>
                <div className="flex gap-1">
                  {i > 0 && <button onClick={() => setChain(moveItem(chain, i, i - 1))} className="p-1 text-slate-400 hover:text-slate-600"><ChevronUp className="h-4 w-4" /></button>}
                  {i < chain.length - 1 && <button onClick={() => setChain(moveItem(chain, i, i + 1))} className="p-1 text-slate-400 hover:text-slate-600"><ChevronDown className="h-4 w-4" /></button>}
                  <button onClick={() => setChain(chain.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Role"><Input value={entry.role} onChange={v => setChain(chain.map((c, j) => j === i ? { ...c, role: v } : c))} placeholder="e.g. Facility Manager" /></Field>
                <Field label="Name"><Input value={entry.name} onChange={v => setChain(chain.map((c, j) => j === i ? { ...c, name: v } : c))} placeholder="Full name" /></Field>
                <Field label="Phone"><Input value={entry.phone} onChange={v => setChain(chain.map((c, j) => j === i ? { ...c, phone: v } : c))} placeholder="(555) 000-0000" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Alternate Name"><Input value={entry.alt_name ?? ""} onChange={v => setChain(chain.map((c, j) => j === i ? { ...c, alt_name: v } : c))} placeholder="Backup contact name" /></Field>
                <Field label="Alternate Phone"><Input value={entry.alt_phone ?? ""} onChange={v => setChain(chain.map((c, j) => j === i ? { ...c, alt_phone: v } : c))} placeholder="(555) 000-0000" /></Field>
              </div>
            </div>
          ))}
          <button onClick={() => setChain([...chain, { role: "", name: "", phone: "", alt_name: "", alt_phone: "" }])} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <Plus className="h-4 w-4" /> Add person
          </button>
        </div>
      </FormSection>

      {/* Key Contacts */}
      <FormSection title="Key Contacts">
        {[
          { label: "Safety Coordinator", name: safetyCoordName, setName: setSafetyCoordName, phone: safetyCoordPhone, setPhone: setSafetyCoordPhone },
          { label: "EHS Advisor", name: ehsAdvisorName, setName: setEhsAdvisorName, phone: ehsAdvisorPhone, setPhone: setEhsAdvisorPhone },
          { label: "Facilities Manager", name: facilitiesMgrName, setName: setFacilitiesMgrName, phone: facilitiesMgrPhone, setPhone: setFacilitiesMgrPhone },
        ].map(({ label, name, setName, phone, setPhone }) => (
          <div key={label} className="grid grid-cols-2 gap-4">
            <Field label={`${label} — Name`}><Input value={name} onChange={setName} placeholder="Full name" /></Field>
            <Field label={`${label} — Phone`}><Input value={phone} onChange={setPhone} placeholder="(555) 000-0000" /></Field>
          </div>
        ))}
      </FormSection>

      {/* Equipment Locations */}
      <FormSection title="Emergency Equipment Locations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="AED"><Input value={aedLoc} onChange={setAedLoc} placeholder="e.g. Main Lobby, Lab Wing B entrance" /></Field>
          <Field label="First Aid Kits"><Input value={firstAidLoc} onChange={setFirstAidLoc} placeholder="e.g. All break rooms, manager offices" /></Field>
          <Field label="Fire Extinguishers"><Input value={fireExtLoc} onChange={setFireExtLoc} placeholder="e.g. All corridors, chemical storage" /></Field>
          <Field label="Spill Kits"><Input value={spillKitLoc} onChange={setSpillKitLoc} placeholder="e.g. Chemical storage room, Lab A & B" /></Field>
          <Field label="Eyewash Stations"><Input value={eyewashLoc} onChange={setEyewashLoc} placeholder="e.g. All lab sinks, chemical storage" /></Field>
        </div>
      </FormSection>

      {/* Assembly Areas */}
      <FormSection title="Emergency Assembly / Muster Points">
        <Field label="Primary Muster Point"><Input value={primaryMuster} onChange={setPrimaryMuster} placeholder="e.g. North Parking Lot (Gate 1)" /></Field>
        <Field label="Secondary Muster Point"><Input value={secondaryMuster} onChange={setSecondaryMuster} placeholder="e.g. South Lawn near Building C" /></Field>
      </FormSection>

      {/* Hospital */}
      <FormSection title="Nearest Hospital / Clinic">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Hospital Name"><Input value={hospitalName} onChange={setHospitalName} placeholder="Name of hospital or urgent care" /></Field>
          <Field label="Phone"><Input value={hospitalPhone} onChange={setHospitalPhone} placeholder="(555) 000-0000" /></Field>
          <Field label="Address" ><Input value={hospitalAddress} onChange={setHospitalAddress} placeholder="Full address" /></Field>
          <Field label="Distance / Drive Time"><Input value={hospitalDistance} onChange={setHospitalDistance} placeholder="e.g. 2.1 miles (6 min drive)" /></Field>
        </div>
        <Field label="Route Instructions"><Textarea value={hospitalRoute} onChange={setHospitalRoute} placeholder="e.g. Head south on Main St, right on Hospital Ave..." rows={2} /></Field>
      </FormSection>

      {/* Shelter Plans */}
      <FormSection title="Weather & Shelter Plans">
        <Field label="Severe Weather Shelter Location"><Input value={severeWeather} onChange={setSevereWeather} placeholder="e.g. Interior rooms away from windows — Conference Rooms B and C" /></Field>
        <Field label="Tornado / High Wind Shelter"><Input value={tornadoShelter} onChange={setTornadoShelter} placeholder="e.g. Basement level, interior hallways" /></Field>
        <Field label="Lightning Plan"><Textarea value={lightningPlan} onChange={setLightningPlan} placeholder="e.g. Monitor weather, stop outdoor work, shelter in place, stay inside 30 min after last strike" rows={2} /></Field>
      </FormSection>

      {/* Utility Shutoffs */}
      <FormSection title="Utility Shutoff Contacts">
        <div className="space-y-3">
          {utilities.map((u, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <Field label="Utility"><Input value={u.utility} onChange={v => setUtilities(utilities.map((x, j) => j === i ? { ...x, utility: v } : x))} placeholder="e.g. Electric" /></Field>
              <Field label="Contact"><Input value={u.contact} onChange={v => setUtilities(utilities.map((x, j) => j === i ? { ...x, contact: v } : x))} placeholder="e.g. PG&E" /></Field>
              <div className="flex gap-2">
                <Field label="Phone"><Input value={u.phone} onChange={v => setUtilities(utilities.map((x, j) => j === i ? { ...x, phone: v } : x))} placeholder="(800) 000-0000" /></Field>
                <button onClick={() => setUtilities(utilities.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          <button onClick={() => setUtilities([...utilities, { utility: "", contact: "", phone: "" }])} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <Plus className="h-4 w-4" /> Add utility
          </button>
        </div>
      </FormSection>

      {/* After-Hours */}
      <FormSection title="After-Hours Emergency Contacts">
        <div className="space-y-3">
          {afterHours.map((a, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <Field label="Role"><Input value={a.role} onChange={v => setAfterHours(afterHours.map((x, j) => j === i ? { ...x, role: v } : x))} placeholder="e.g. On-Call EHS" /></Field>
              <Field label="Name"><Input value={a.name} onChange={v => setAfterHours(afterHours.map((x, j) => j === i ? { ...x, name: v } : x))} placeholder="Name" /></Field>
              <div className="flex gap-2">
                <Field label="Phone"><Input value={a.phone} onChange={v => setAfterHours(afterHours.map((x, j) => j === i ? { ...x, phone: v } : x))} placeholder="(555) 000-0000" /></Field>
                <button onClick={() => setAfterHours(afterHours.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          <button onClick={() => setAfterHours([...afterHours, { role: "", name: "", phone: "" }])} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <Plus className="h-4 w-4" /> Add contact
          </button>
        </div>
      </FormSection>

      {/* Notification Timeline */}
      <FormSection title="Incident Notification Timeline">
        <p className="text-xs text-slate-500">One item per line in each column.</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Notify Immediately"><Textarea value={notifyNow} onChange={setNotifyNow} placeholder={"911 (if needed)\nFacility Manager\nEHS Manager"} rows={5} /></Field>
          <Field label="Within 1 Hour"><Textarea value={notify1hr} onChange={setNotify1hr} placeholder={"Operations Director\nHR Manager\nLegal / Risk"} rows={5} /></Field>
          <Field label="Before Work Resumes"><Textarea value={notifyResume} onChange={setNotifyResume} placeholder={"All affected staff\nDepartment Heads\nSafety briefing"} rows={5} /></Field>
        </div>
      </FormSection>

      {/* Media & Regulatory */}
      <FormSection title="Media & Regulatory Reporting">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Authorized Media Spokesperson — Name"><Input value={mediaNam} onChange={setMediaNam} placeholder="Name, Title" /></Field>
          <Field label="Spokesperson Phone"><Input value={mediaPhn} onChange={setMediaPhn} placeholder="(555) 000-0000" /></Field>
          <Field label="OSHA 24/7 Phone"><Input value={oshaPhone} onChange={setOshaPhone} placeholder="(800) 321-6742" /></Field>
          <Field label="Regulatory Contact Name"><Input value={regName} onChange={setRegName} placeholder="Name, Title" /></Field>
          <Field label="Regulatory Contact Phone"><Input value={regPhone} onChange={setRegPhone} placeholder="(555) 000-0000" /></Field>
        </div>
      </FormSection>

      {/* Backup Contacts */}
      <FormSection title="Backup Contacts Table">
        <p className="text-xs text-slate-500">At least one alternate for every key person.</p>
        <div className="space-y-3">
          {backupContacts.map((b, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Contact {i + 1}</span>
                <button onClick={() => setBackupContacts(backupContacts.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "Role", key: "role" as const, ph: "e.g. EHS Manager" },
                  { label: "Primary Name", key: "primary_name" as const, ph: "Name" },
                  { label: "Primary Phone", key: "primary_phone" as const, ph: "(555) 000-0000" },
                  { label: "Alt Name", key: "alt_name" as const, ph: "Backup name" },
                  { label: "Alt Phone", key: "alt_phone" as const, ph: "(555) 000-0000" },
                ].map(({ label, key, ph }) => (
                  <Field key={key} label={label}>
                    <Input value={b[key]} onChange={v => setBackupContacts(backupContacts.map((x, j) => j === i ? { ...x, [key]: v } : x))} placeholder={ph} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setBackupContacts([...backupContacts, { role: "", primary_name: "", primary_phone: "", alt_name: "", alt_phone: "" }])} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <Plus className="h-4 w-4" /> Add backup contact
          </button>
        </div>
      </FormSection>

      {/* Post-Incident Steps */}
      <FormSection title="Post-Incident Requirements">
        <p className="text-xs text-slate-500">Ordered checklist — drag or use arrows to reorder.</p>
        <div className="space-y-2">
          {postSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{i + 1}</span>
              <input value={step} onChange={e => setPostSteps(postSteps.map((s, j) => j === i ? e.target.value : s))} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-0.5">
                {i > 0 && <button onClick={() => setPostSteps(moveItem(postSteps, i, i - 1))} className="p-1 text-slate-400 hover:text-slate-600"><ChevronUp className="h-4 w-4" /></button>}
                {i < postSteps.length - 1 && <button onClick={() => setPostSteps(moveItem(postSteps, i, i + 1))} className="p-1 text-slate-400 hover:text-slate-600"><ChevronDown className="h-4 w-4" /></button>}
                <button onClick={() => setPostSteps(postSteps.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          <button onClick={() => setPostSteps([...postSteps, ""])} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1">
            <Plus className="h-4 w-4" /> Add step
          </button>
        </div>
      </FormSection>

      {/* Additional Notes */}
      <FormSection title="Additional Notes">
        <Textarea value={additionalNotes} onChange={setAdditionalNotes} placeholder="e.g. Keep radios charged. Maintain clear site access for emergency vehicles. Review during safety orientations." rows={4} />
      </FormSection>

      {/* Save */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={isPending || saved}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved! Redirecting…" : isPending ? "Saving…" : "Save Emergency Action Plan"}
        </button>
      </div>
    </div>
  );
}
