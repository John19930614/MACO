"use client";

import { Building2, Bell, Search, ShieldCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_MODE } from "@/lib/env";
import { useDemoUser } from "@/lib/context/demo-user";

export function TopBar({ siteName }: { siteName?: string }) {
  const { user } = useDemoUser();
  const router = useRouter();

  function signOut() {
    localStorage.removeItem("maco-logged-in");
    router.push("/login");
  }

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:hidden">
      {/* Brand */}
      <div className="flex w-56 shrink-0 items-center gap-2.5">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-blue-600 to-blue-400 shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
          <ShieldCheck className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <div className="text-[17px] font-extrabold leading-tight tracking-tight text-[#1a2d42]">SafetyIQ</div>
          <div className="text-[10px] leading-none text-slate-400">Reliance Predictive Safety Technologies</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search..."
          suppressHydrationWarning
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
        />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Company badge */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {siteName ?? user.company}
        </div>

        {MOCK_MODE && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Demo / mock data
          </span>
        )}

        {/* Notification bell */}
        <button className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white">3</span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-400 text-xs font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            {initials}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold text-slate-800">{user.display_name}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              {user.job_title}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          title="Sign out"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-red-50 hover:border-red-200 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
