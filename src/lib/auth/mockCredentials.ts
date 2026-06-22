/**
 * Demo mode credentials — validated client-side on the login form.
 * Maps lowercase email → { password, profileId }.
 * Never used in live (Supabase) mode.
 */

export interface MockCredential {
  password: string;
  profileId: string;
}

export const MOCK_CREDENTIALS: Record<string, MockCredential> = {
  // BioStar Research Inc.
  "sarah.chen@biostarresearch.com": { password: "SafetyIQ2026!", profileId: "p-sarah-chen-001" },
  "kim.park@biostarresearch.com":   { password: "SafetyIQ2026!", profileId: "p-kim-park-001"   },
  "james.wu@biostarresearch.com":   { password: "SafetyIQ2026!", profileId: "p-james-wu-001"   },
  "tom.reed@biostarresearch.com":   { password: "SafetyIQ2026!", profileId: "p-tom-reed-001"   },
  // NovaBio Sciences (onboarding demo)
  "david.kim@novabio.com":          { password: "SafetyIQ2026!", profileId: "p-david-kim-001"  },
  "lisa.tang@novabio.com":          { password: "SafetyIQ2026!", profileId: "p-lisa-tang-001"  },
  // Reliance platform admin
  "maria.lopez@reliance.com":       { password: "Reliance@2026!", profileId: "p-reliance-admin-001" },
};

export interface CredentialHintUser {
  email: string;
  name: string;
  role: string;
  password: string;
}

export interface CredentialHintGroup {
  company: string;
  note: string;
  users: CredentialHintUser[];
}

export const DEMO_CREDENTIAL_HINTS: CredentialHintGroup[] = [
  {
    company: "BioStar Research Inc.",
    note: "Full data — established company",
    users: [
      { email: "sarah.chen@biostarresearch.com", name: "Sarah Chen",   role: "EHS Manager",       password: "SafetyIQ2026!" },
      { email: "kim.park@biostarresearch.com",   name: "Dr. Kim Park", role: "EHS Coordinator",   password: "SafetyIQ2026!" },
      { email: "james.wu@biostarresearch.com",   name: "James Wu",     role: "Lab Safety Officer", password: "SafetyIQ2026!" },
      { email: "tom.reed@biostarresearch.com",   name: "Tom Reed",     role: "Research Director", password: "SafetyIQ2026!" },
    ],
  },
  {
    company: "NovaBio Sciences",
    note: "Onboarding in progress — week 2",
    users: [
      { email: "david.kim@novabio.com", name: "David Kim", role: "EHS Manager",        password: "SafetyIQ2026!" },
      { email: "lisa.tang@novabio.com", name: "Lisa Tang", role: "Safety Coordinator", password: "SafetyIQ2026!" },
    ],
  },
  {
    company: "Reliance (Platform Admin)",
    note: "Internal — sees all companies",
    users: [
      { email: "maria.lopez@reliance.com", name: "Maria Lopez", role: "Platform Administrator", password: "Reliance@2026!" },
    ],
  },
];
