"use client";

import { Building2, Menu, Search, ShieldCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_MODE } from "@/lib/env";
import { useDemoUser } from "@/lib/context/demo-user";
import { createClient } from "@/lib/supabase/client";
import { NotificationsDropdown, type NotifItem } from "./NotificationsDropdown";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";
import type { ServerUser } from "@/lib/auth/types";

export function TopBar({
  siteName,
  notifCount = 0,
  notifItems = [],
  serverUser,
}: {
  siteName?: string;
  notifCount?: number;
  notifItems?: NotifItem[];
  serverUser?: ServerUser | null;
}) {
  const { user: demoUser } = useDemoUser();
  const router = useRouter();

  // In live mode use the server-resolved user; in mock mode fall back to demo context
  const displayName = serverUser?.display_name ?? demoUser.display_name;
  const jobTitle    = serverUser?.job_title    ?? demoUser.job_title;
  const companyName = siteName ?? serverUser?.company ?? demoUser.company;

  async function signOut() {
    if (!MOCK_MODE) {
      const supabase = createClient();
      await supabase?.auth.signOut();
    }
    // Clear mock tenant cookie + demo user localStorage
    document.cookie = "maco-mock-tenant=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "maco-mock-profile=; path=/; max-age=0; SameSite=Lax";
    localStorage.removeItem("maco-logged-in");
    localStorage.removeItem("maco-demo-user");
    router.push("/login");
  }

  function openSearch() {
    window.dispatchEvent(new Event("open-command-palette"));
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:hidden dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
      {/* Mobile menu (hamburger → opens mobile nav drawer) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-mobile-nav"))}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:hidden dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-blue-600 to-blue-400 shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
          <ShieldCheck className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <div className="text-[17px] font-extrabold leading-tight tracking-tight text-[#1a2d42]">SafetyIQ</div>
          <div className="hidden text-[10px] leading-none text-slate-400 sm:block">Reliance Predictive Safety Technologies</div>
        </div>
      </div>

      {/* Search — opens CommandPalette */}
      <button
        type="button"
        onClick={openSearch}
        className="relative flex max-w-xs flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-sm text-slate-400 transition hover:border-blue-300 hover:bg-white"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Search SafetyIQ…</span>
        <kbd className="hidden rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">⌘K</kbd>
      </button>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Company badge — hidden on mobile */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:flex">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {companyName}
        </div>

        {MOCK_MODE && (
          <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 sm:inline">
            Demo / mock data
          </span>
        )}

        {/* Sound mute toggle */}
        <SoundToggle />

        {/* Dark / light theme toggle */}
        <ThemeToggle />

        {/* Notification bell with live dropdown */}
        <NotificationsDropdown count={notifCount} items={notifItems} />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-400 text-xs font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            {initials}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold text-slate-800">{displayName}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              {jobTitle}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          title="Sign out"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
