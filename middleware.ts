import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/super-admin/login"];

// ── CSRF: allowed mutation methods ─────────────────────────────────────────
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Returns true when the request can be assumed to be same-origin.
 * Allows:
 *  - Non-mutation methods (GET, HEAD, OPTIONS)
 *  - The Origin header matches the request host
 *  - The X-Requested-With header is present (set by our fetch calls)
 */
function isSafeRequest(request: NextRequest): boolean {
  if (!MUTATION_METHODS.has(request.method)) return true;

  // X-Requested-With is set by all our fetch() calls in the frontend
  if (request.headers.get("x-requested-with")) return true;

  const origin = request.headers.get("origin");
  if (!origin) return true; // server-to-server calls have no Origin — allow

  const host = request.headers.get("host") ?? "";
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
  } catch {
    // malformed origin — block
  }
  return false;
}

function roleHome(role: string): string {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return "/";
}

function portalOf(pathname: string): "super-admin" | "admin" | "app" {
  if (pathname.startsWith("/super-admin")) return "super-admin";
  if (pathname.startsWith("/admin")) return "admin";
  return "app";
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  // API routes handle their own auth — never redirect them
  const isApiRoute = pathname.startsWith("/api/");

  if (!user) {
    if (isPublicRoute || isApiRoute) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string) ?? "staff";
  const home = roleHome(role);

  if (isApiRoute) {
    // CSRF check: block cross-origin mutation requests
    if (!isSafeRequest(request)) {
      return new NextResponse(
        JSON.stringify({ error: "CSRF: Cross-origin request rejected" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return supabaseResponse;
  }

  // Authenticated user hitting a public/login route → send to correct home
  if (isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  const targetPortal = portalOf(pathname);
  const allowedPortal = portalOf(home);

  // Admins and super-admins can also access app routes (to create documents)
  const canAccessApp = role === "admin" || role === "super_admin";

  if (targetPortal !== allowedPortal && !(canAccessApp && targetPortal === "app")) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
