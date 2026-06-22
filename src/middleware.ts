import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that do NOT require authentication
const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // MOCK_MODE: no Supabase creds configured → skip all checks, AuthGuard handles client-side
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isMock =
    process.env.NEXT_PUBLIC_SAFETYIQ_MOCK === "true" ||
    !supabaseUrl ||
    !supabaseKey;

  if (isMock) return NextResponse.next();

  // Always allow public paths
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublic) return NextResponse.next();

  // Build response object so Supabase can refresh the session cookie
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        // request.cookies.set only accepts (name, value) — options go on the response
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response.cookies.set(name, value, options as any),
        );
      },
    },
  });

  // getUser() is the safe session validator (verifies JWT with Supabase server)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // SA routes (/sa/*) require a Reliance admin (tenant_id IS NULL in profiles)
  const isSaRoute = pathname === "/sa" || pathname.startsWith("/sa/");
  if (isSaRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    // If profile has a tenant_id they are a client user, not a Reliance admin
    if (!profile || profile.tenant_id !== null) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
