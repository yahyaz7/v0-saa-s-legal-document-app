import { NextResponse, type NextRequest } from "next/server";

// TODO: Re-enable Supabase auth middleware once users are set up
// For now, allow all routes for development/demo purposes

export async function middleware(request: NextRequest) {
  // Pass through all requests - auth disabled for demo
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon and public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
