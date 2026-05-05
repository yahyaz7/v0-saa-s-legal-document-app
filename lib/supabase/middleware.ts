import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password", "/api/seed-admin"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
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
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && pathname === "/login") {
    const role = user.app_metadata?.role as string | undefined;
    const url = request.nextUrl.clone();
    url.pathname = role === "super_admin" ? "/super-admin" : role === "admin" ? "/admin" : "/";
    return NextResponse.redirect(url);
  }

  // Redirect admins who land on the staff dashboard to the admin dashboard
  if (user && pathname === "/") {
    const role = user.app_metadata?.role as string | undefined;
    if (role === "admin" || role === "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = role === "super_admin" ? "/super-admin" : "/admin";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
