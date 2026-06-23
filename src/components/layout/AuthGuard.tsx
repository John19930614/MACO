"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MOCK_MODE } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

const LOGGED_IN_KEY = "maco-logged-in";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (MOCK_MODE) {
      // Mock mode: rely on localStorage flag set at mock login
      if (!localStorage.getItem(LOGGED_IN_KEY)) {
        router.replace("/login");
      }
    } else {
      // Live mode: middleware already verified the JWT server-side before this
      // component mounts — no client-side check needed. Only redirect if
      // Supabase confirms there is genuinely no session.
      const supabase = createClient();
      supabase?.auth.getSession().then(({ data }) => {
        if (!data.session) router.replace("/login");
      });
    }
  }, [router]);

  return <>{children}</>;
}
