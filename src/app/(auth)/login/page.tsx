"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/lib/context/demo-user";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_CREDENTIALS, DEMO_CREDENTIAL_HINTS } from "@/lib/auth/mockCredentials";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";

const LS_KEY       = "maco-demo-user";
const LOGGED_IN_KEY = "maco-logged-in";

export default function LoginPage() {
  const router = useRouter();

  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [authError, setAuthError] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [resetMsg,  setResetMsg]  = useState("");
  const [resetting, setResetting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (MOCK_MODE && localStorage.getItem(LOGGED_IN_KEY) === "1") {
        router.replace("/dashboard");
      } else if (!MOCK_MODE) {
        // In live mode check the real Supabase session, not localStorage
        const supabase = createClient();
        supabase?.auth.getSession().then(({ data }) => {
          if (data.session) router.replace("/dashboard");
        });
        // Clear any stale mock localStorage so it doesn't interfere
        localStorage.removeItem(LOGGED_IN_KEY);
      }
    }
  }, [router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    if (MOCK_MODE) {
      // Validate against hardcoded credentials map
      const key  = email.trim().toLowerCase();
      const cred = MOCK_CREDENTIALS[key];
      if (!cred || cred.password !== password) {
        setAuthError("Invalid email or password.");
        setLoading(false);
        return;
      }
      const profile = DEMO_USERS.find((u) => u.id === cred.profileId);
      if (!profile) {
        setAuthError("Profile not found — contact your administrator.");
        setLoading(false);
        return;
      }
      // Persist session to localStorage + cookie (cookie lets server read tenant)
      const tenantId = profile.tenant_id ?? "t-biostar-001";
      document.cookie = `maco-mock-tenant=${tenantId}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `maco-mock-profile=${profile.id}; path=/; max-age=86400; SameSite=Lax`;
      localStorage.setItem(LS_KEY, profile.id);
      localStorage.setItem(LOGGED_IN_KEY, "1");
      router.push("/dashboard");
    } else {
      // Live mode — Supabase
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setAuthError(error.message);
      } else {
        // Hard navigation so the auth cookie is committed before the middleware
        // checks the session on the next request (router.push races the cookie)
        window.location.href = "/dashboard";
      }
    }
  }

  // Live-mode password reset. Sends a recovery email; the link routes through
  // /auth/callback (type=recovery) → /auth/set-password, reusing the invite infra.
  async function handleForgotPassword() {
    setAuthError("");
    setResetMsg("");
    const target = email.trim().toLowerCase();
    if (!target) {
      setAuthError("Enter your work email above, then choose “Forgot password.”");
      return;
    }
    setResetting(true);
    const supabase = createClient();
    if (!supabase) { setResetting(false); return; }
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo });
    setResetting(false);
    // Always show a neutral confirmation — never reveal whether an account exists.
    setResetMsg(
      error
        ? "If an account exists for that email, a reset link is on its way."
        : "Check your inbox — we sent a password reset link to that email.",
    );
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
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome to SafetyIQ
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Sign in to your account to continue
            </p>
          </div>

          {/* Sign-in form */}
          <form onSubmit={handleSignIn} className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Work email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>

              {!MOCK_MODE && (
                <div className="-mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetting}
                    className="text-xs font-medium text-blue-300/80 hover:text-blue-200 disabled:opacity-50"
                  >
                    {resetting ? "Sending…" : "Forgot password?"}
                  </button>
                </div>
              )}

              {authError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                  {authError}
                </div>
              )}

              {resetMsg && (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-200">
                  {resetMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : "Sign in"}
              </button>
            </div>
          </form>

          {/* Demo credentials accordion — only in mock mode */}
          {MOCK_MODE && (
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
              <button
                onClick={() => setHintsOpen((o) => !o)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left"
              >
                <div>
                  <div className="text-xs font-semibold text-white/50">Demo access</div>
                  <div className="text-[11px] text-white/25 mt-0.5">Click to view demo account credentials</div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-white/30 transition-transform duration-200 ${hintsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {hintsOpen && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {DEMO_CREDENTIAL_HINTS.map((group) => (
                    <div key={group.company} className="px-5 py-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <div className="text-[11px] font-bold text-white/60">{group.company}</div>
                        <div className="text-[10px] text-white/25 italic">{group.note}</div>
                      </div>
                      <div className="space-y-2">
                        {group.users.map((u) => (
                          <button
                            key={u.email}
                            type="button"
                            onClick={() => {
                              setEmail(u.email);
                              setPassword(u.password);
                              setHintsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 px-3 py-2 text-left transition group"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600/50 text-[10px] font-bold text-white">
                              {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold text-white/70 group-hover:text-white transition">{u.name}</div>
                              <div className="text-[10px] text-white/30">{u.role}</div>
                            </div>
                            <div className="text-[10px] text-white/20 group-hover:text-white/40 transition font-mono">
                              {u.email.split("@")[0]}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="px-5 py-3 text-[10px] text-white/20">
                    Password for BioStar &amp; NovaBio: <span className="font-mono text-white/35">SafetyIQ2026!</span> ·
                    Reliance admin: <span className="font-mono text-white/35">Reliance@2026!</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/8 px-8 py-4 text-center text-xs text-white/25">
        © 2026 Reliance Predictive Safety Technologies · SafetyIQ Platform v0.7
      </div>
    </div>
  );
}
