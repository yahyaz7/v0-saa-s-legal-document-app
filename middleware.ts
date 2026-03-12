import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isSuperAdminRoute = pathname.startsWith("/super-admin");
  // API routes handle their own auth — never redirect them
  const isApiRoute = pathname.startsWith("/api/");

  // ── Not authenticated ────────────────────────────────────────────
  if (!user) {
    if (isPublicRoute || isApiRoute) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Authenticated — read role from JWT app_metadata ──────────────
  const role = (user.app_metadata?.role as string) ?? "";
  const isSuperAdmin = role === "super_admin";

  // Never apply role-based page redirects to API routes
  if (isApiRoute) return supabaseResponse;

  // Authenticated user hitting a public route → redirect to correct home
  if (isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isSuperAdmin ? "/super-admin" : "/";
    return NextResponse.redirect(url);
  }

  // Super admin trying to access the regular app → redirect to their portal
  if (isSuperAdmin && !isSuperAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/super-admin";
    return NextResponse.redirect(url);
  }

  // Regular user trying to access the super-admin portal → back to app
  if (!isSuperAdmin && isSuperAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
