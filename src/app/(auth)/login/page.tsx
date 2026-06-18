"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS, type DemoProfile } from "@/lib/context/demo-user";

const LS_KEY = "maco-demo-user";
const LOGGED_IN_KEY = "maco-logged-in";

const ROLE_LABEL: Record<string, string> = {
  ehs_manager:    "EHS Manager",
  ehs_coordinator:"EHS Coordinator",
  field_officer:  "Field Officer",
  viewer:         "Viewer",
  admin:          "Administrator",
};

const ROLE_COLOR: Record<string, string> = {
  ehs_manager:    "bg-blue-100 text-blue-700",
  ehs_coordinator:"bg-teal-100 text-teal-700",
  field_officer:  "bg-amber-100 text-amber-700",
  viewer:         "bg-slate-100 text-slate-600",
  admin:          "bg-violet-100 text-violet-700",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_BG = [
  "bg-blue-600",
  "bg-teal-600",
  "bg-amber-600",
  "bg-slate-500",
  "bg-violet-700",
];

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem(LOGGED_IN_KEY) === "1") {
      router.replace("/dashboard");
    }
  }, [router]);

  function signIn(user: DemoProfile) {
    localStorage.setItem(LS_KEY, user.id);
    localStorage.setItem(LOGGED_IN_KEY, "1");
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top brand bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-sm select-none">
          IQ
        </div>
        <span className="text-sm font-semibold tracking-wide text-white">SafetyIQ</span>
        <span className="ml-1 text-xs text-white/30">by Reliance Predictive Safety Technologies</span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
          {/* Heading */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome to SafetyIQ
            </h1>
            <p className="mt-3 text-sm text-white/50">
              AI-powered EHS management — select a demo profile to explore the platform
            </p>
          </div>

          {/* Demo user cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DEMO_USERS.map((user, i) => (
              <button
                key={user.id}
                onClick={() => signIn(user)}
                className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  user.is_reliance
                    ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${AVATAR_BG[i]}`}
                >
                  {initials(user.display_name)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{user.display_name}</span>
                    {user.is_reliance && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                        Reliance
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">{user.job_title}</div>
                  <div className="mt-0.5 text-[11px] text-white/35">{user.company}</div>
                </div>

                {/* Role badge */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_COLOR[user.role]}`}
                >
                  {ROLE_LABEL[user.role]}
                </span>

                {/* Arrow */}
                <svg
                  className="ml-1 h-4 w-4 shrink-0 text-white/20 transition-colors group-hover:text-white/50"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* Divider + note */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/30">or sign in with your account</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Real sign-in placeholder */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Work email
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 placeholder:text-white/20 outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 placeholder:text-white/20 outline-none cursor-not-allowed"
                />
              </div>
              <button
                disabled
                className="w-full rounded-xl bg-blue-600/40 py-2.5 text-sm font-semibold text-white/40 cursor-not-allowed"
              >
                Sign in — coming in v0.8
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/8 px-8 py-4 text-center text-xs text-white/25">
        © 2026 Reliance Predictive Safety Technologies · SafetyIQ Platform v0.6.4
      </div>
    </div>
  );
}
