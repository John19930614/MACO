"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type DemoRole =
  | "viewer"
  | "field_officer"
  | "ehs_coordinator"
  | "ehs_manager"
  | "admin";

export interface DemoProfile {
  id: string;
  display_name: string;
  role: DemoRole;
  tenant_id: string | null;
  job_title: string;
  is_reliance: boolean;
  company: string;
  email: string;
}

export const DEMO_USERS: DemoProfile[] = [
  // ── BioStar Research Inc. ────────────────────────────────────────────────────
  {
    id: "p-sarah-chen-001",
    display_name: "Sarah Chen",
    role: "ehs_manager",
    tenant_id: "t-biostar-001",
    job_title: "EHS Manager",
    is_reliance: false,
    company: "BioStar Research Inc.",
    email: "sarah.chen@biostarresearch.com",
  },
  {
    id: "p-kim-park-001",
    display_name: "Dr. Kim Park",
    role: "ehs_coordinator",
    tenant_id: "t-biostar-001",
    job_title: "EHS Coordinator",
    is_reliance: false,
    company: "BioStar Research Inc.",
    email: "kim.park@biostarresearch.com",
  },
  {
    id: "p-james-wu-001",
    display_name: "James Wu",
    role: "field_officer",
    tenant_id: "t-biostar-001",
    job_title: "Lab Safety Officer",
    is_reliance: false,
    company: "BioStar Research Inc.",
    email: "james.wu@biostarresearch.com",
  },
  {
    id: "p-tom-reed-001",
    display_name: "Tom Reed",
    role: "viewer",
    tenant_id: "t-biostar-001",
    job_title: "Research Director",
    is_reliance: false,
    company: "BioStar Research Inc.",
    email: "tom.reed@biostarresearch.com",
  },
  // ── NovaBio Sciences (onboarding demo) ──────────────────────────────────────
  {
    id: "p-david-kim-001",
    display_name: "David Kim",
    role: "ehs_manager",
    tenant_id: "t-novabio-001",
    job_title: "EHS Manager",
    is_reliance: false,
    company: "NovaBio Sciences",
    email: "david.kim@novabio.com",
  },
  {
    id: "p-lisa-tang-001",
    display_name: "Lisa Tang",
    role: "ehs_coordinator",
    tenant_id: "t-novabio-001",
    job_title: "Safety Coordinator",
    is_reliance: false,
    company: "NovaBio Sciences",
    email: "lisa.tang@novabio.com",
  },
  // ── Reliance platform admin ──────────────────────────────────────────────────
  {
    id: "p-reliance-admin-001",
    display_name: "Maria Lopez",
    role: "admin",
    tenant_id: null,
    job_title: "Platform Administrator",
    is_reliance: true,
    company: "Reliance Predictive Safety Technologies",
    email: "maria.lopez@reliance.com",
  },
];

const LS_KEY      = "maco-demo-user";
const DEFAULT_USER = DEMO_USERS[0];

interface DemoUserCtx {
  user: DemoProfile;
  setUser: (u: DemoProfile) => void;
}

const Ctx = createContext<DemoUserCtx>({
  user: DEFAULT_USER,
  setUser: () => {},
});

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<DemoProfile>(DEFAULT_USER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const found = DEMO_USERS.find((u) => u.id === saved);
        if (found) setUserState(found);
      }
    } catch {}
  }, []);

  function setUser(u: DemoProfile) {
    setUserState(u);
    try {
      localStorage.setItem(LS_KEY, u.id);
      document.cookie = `maco-mock-tenant=${u.tenant_id ?? "t-biostar-001"}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `maco-mock-profile=${u.id}; path=/; max-age=86400; SameSite=Lax`;
    } catch {}
  }

  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export function useDemoUser() {
  return useContext(Ctx);
}
