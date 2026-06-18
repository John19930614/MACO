"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LOGGED_IN_KEY = "maco-logged-in";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(LOGGED_IN_KEY)) {
      router.replace("/login");
    }
  }, [router]);

  return <>{children}</>;
}
