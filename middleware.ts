import { NextResponse, type NextRequest } from "next/server";

// Temporarily bypass auth to allow access
// Will re-enable once admin user is created
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
