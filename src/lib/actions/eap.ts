"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";

export interface CallChainEntry {
  role: string;
  name: string;
  phone: string;
  alt_name?: string;
  alt_phone?: string;
}

export interface KeyContact {
  name: string;
  phone: string;
}

export interface UtilityShutoff {
  utility: string;
  contact: string;
  phone: string;
}

export interface AfterHoursContact {
  role: string;
  name: string;
  phone: string;
}

export interface BackupContact {
  role: string;
  primary_name: string;
  primary_phone: string;
  alt_name: string;
  alt_phone: string;
}

export interface EapRecord {
  id?: string;
  tenant_id?: string;
  site_id?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;
  site_command_post?: string | null;
  call_chain?: CallChainEntry[];
  safety_coordinator?: KeyContact;
  ehs_advisor?: KeyContact;
  facilities_manager?: KeyContact;
  aed_location?: string | null;
  first_aid_location?: string | null;
  fire_extinguisher_location?: string | null;
  spill_kit_location?: string | null;
  eyewash_location?: string | null;
  primary_muster_point?: string | null;
  secondary_muster_point?: string | null;
  hospital_name?: string | null;
  hospital_address?: string | null;
  hospital_phone?: string | null;
  hospital_route?: string | null;
  hospital_distance?: string | null;
  severe_weather_shelter?: string | null;
  tornado_shelter?: string | null;
  lightning_plan?: string | null;
  utility_shutoffs?: UtilityShutoff[];
  after_hours_contacts?: AfterHoursContact[];
  notify_immediately?: string[];
  notify_within_1hr?: string[];
  notify_before_resuming?: string[];
  media_spokesperson_name?: string | null;
  media_spokesperson_phone?: string | null;
  osha_phone?: string | null;
  regulatory_contact_name?: string | null;
  regulatory_contact_phone?: string | null;
  backup_contacts?: BackupContact[];
  post_incident_steps?: string[];
  additional_notes?: string | null;
  last_reviewed_at?: string | null;
  reviewed_by?: string | null;
  version?: string | null;
  created_at?: string;
  updated_at?: string;
}

const MOCK_EAP: EapRecord = {
  id: "mock-eap-1",
  facility_name: "BioStar Research Facility",
  facility_address: "1234 Science Blvd, San Francisco, CA 94105",
  site_command_post: "Main Lobby — Conference Room A",
  call_chain: [
    { role: "Facility Manager", name: "Sarah Chen", phone: "(415) 555-0100", alt_name: "James Park", alt_phone: "(415) 555-0101" },
    { role: "EHS Manager", name: "Marcus Johnson", phone: "(415) 555-0102" },
    { role: "Operations Director", name: "Lisa Wang", phone: "(415) 555-0103" },
  ],
  safety_coordinator: { name: "Marcus Johnson", phone: "(415) 555-0102" },
  ehs_advisor: { name: "Dr. Sarah Chen", phone: "(415) 555-0100" },
  facilities_manager: { name: "Robert Torres", phone: "(415) 555-0104" },
  aed_location: "Main Lobby, Lab Wing B Entrance",
  first_aid_location: "All break rooms, Lab manager offices",
  fire_extinguisher_location: "All corridors, Chemical storage rooms",
  spill_kit_location: "Chemical storage room, Lab Wing A & B",
  eyewash_location: "All lab sinks, Chemical storage rooms",
  primary_muster_point: "North Parking Lot (Gate 1)",
  secondary_muster_point: "South Lawn near Building C",
  hospital_name: "SF General Hospital",
  hospital_address: "1001 Potrero Ave, San Francisco, CA 94110",
  hospital_phone: "(415) 206-8000",
  hospital_route: "Head south on Science Blvd, turn right on Potrero Ave",
  hospital_distance: "2.1 miles (6 min drive)",
  severe_weather_shelter: "Interior rooms away from windows — Conference Rooms B and C",
  tornado_shelter: "Basement level, interior hallways",
  lightning_plan: "Monitor weather, stop outdoor work, stay inside 30 min after last strike",
  utility_shutoffs: [
    { utility: "Electric", contact: "PG&E", phone: "(800) 743-5000" },
    { utility: "Gas", contact: "PG&E", phone: "(800) 743-5002" },
    { utility: "Water", contact: "SF Public Utilities", phone: "(415) 551-3000" },
  ],
  after_hours_contacts: [
    { role: "Facility Emergency", name: "Security Desk", phone: "(415) 555-0199" },
    { role: "On-Call EHS", name: "Marcus Johnson", phone: "(415) 555-0102" },
  ],
  notify_immediately: ["911 (if needed)", "Facility Manager", "EHS Manager", "Safety Coordinator"],
  notify_within_1hr: ["Operations Director", "HR Manager", "Legal / Risk Management"],
  notify_before_resuming: ["All affected personnel", "Department Heads", "Team safety briefing"],
  media_spokesperson_name: "Lisa Wang, Operations Director",
  media_spokesperson_phone: "(415) 555-0103",
  osha_phone: "(800) 321-6742",
  regulatory_contact_name: "Marcus Johnson, EHS Manager",
  regulatory_contact_phone: "(415) 555-0102",
  backup_contacts: [
    { role: "Facility Manager", primary_name: "Sarah Chen", primary_phone: "(415) 555-0100", alt_name: "James Park", alt_phone: "(415) 555-0101" },
    { role: "EHS Manager", primary_name: "Marcus Johnson", primary_phone: "(415) 555-0102", alt_name: "TBD", alt_phone: "N/A" },
  ],
  post_incident_steps: [
    "Ensure safety / stop work",
    "Secure the scene",
    "Provide first aid / medical care",
    "Call 911 if serious injury or fatality",
    "Notify management per notification timeline",
    "Preserve evidence / do not disturb scene",
    "Take photos and document conditions",
    "Collect witness statements",
    "Begin incident investigation",
    "Obtain approval to restart work",
  ],
  additional_notes: "Keep radios charged. Maintain clear site access for emergency vehicles. Review this plan during safety orientations.",
  last_reviewed_at: "2026-06-30",
  reviewed_by: "Marcus Johnson",
  version: "1.0",
};

export async function getEap(): Promise<EapRecord | null> {
  if (MOCK_MODE) return MOCK_EAP;
  const db = createServiceRoleClient();
  if (!db) return null;
  const tenantId = await getServerTenantId();
  if (!tenantId) return null;
  const { data } = await db
    .from("emergency_action_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data as EapRecord) ?? null;
}

export async function saveEap(
  input: Partial<EapRecord>,
): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: true };
  const db = createServiceRoleClient();
  if (!db) return { ok: false, error: "Database not available." };
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Session expired." };

  const existing = await getEap();
  const payload = { ...input, tenant_id: tenantId, updated_at: new Date().toISOString() };

  if (existing?.id) {
    const { error } = await db.from("emergency_action_plans").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db.from("emergency_action_plans").insert({ ...payload, created_at: new Date().toISOString() });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/emergency");
  return { ok: true };
}
