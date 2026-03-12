import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getCallerMeta(
  request: NextRequest
): Promise<{ role: string | null; firmId: string | null }> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { role: null, firmId: null };

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return { role: null, firmId: null };

  return {
    role: (user.app_metadata?.role as string) ?? null,
    firmId: (user.app_metadata?.firm_id as string) ?? null,
  };
}

// POST /api/admin/users
// Firm admins only — creates a staff member for their own firm.
// firmId is taken from the caller's JWT, not the request body.
export async function POST(request: NextRequest) {
  const { role: callerRole, firmId: callerFirmId } = await getCallerMeta(request);

  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!callerFirmId) {
    return NextResponse.json({ error: "Could not determine your firm" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, password, fullName } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const db = makeAdminClient();

  const { data: firm, error: firmError } = await db
    .from("firms")
    .select("id, name")
    .eq("id", callerFirmId)
    .single();

  if (firmError || !firm) {
    return NextResponse.json({ error: "Firm not found" }, { status: 404 });
  }

  const { data: staffRole, error: roleError } = await db
    .from("roles")
    .select("id")
    .eq("name", "staff")
    .single();

  if (roleError || !staffRole) {
    return NextResponse.json({ error: "staff role not found" }, { status: 500 });
  }

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "staff", firm_id: callerFirmId },
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Explicitly correct public.users to guard against trigger fallback
  await db
    .from("users")
    .update({ firm_id: callerFirmId, role_id: staffRole.id })
    .eq("id", authData.user.id);

  return NextResponse.json(
    { success: true, userId: authData.user.id, email: authData.user.email, firm: firm.name, role: "staff" },
    { status: 201 }
  );
}

// GET /api/admin/users
// Firm admins only — lists all users in their own firm.
export async function GET(request: NextRequest) {
  const { role: callerRole, firmId: callerFirmId } = await getCallerMeta(request);

  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!callerFirmId) {
    return NextResponse.json({ error: "Could not determine your firm" }, { status: 400 });
  }

  const { data, error } = await makeAdminClient()
    .from("users")
    .select("id, name, email, is_active, created_at, roles(name)")
    .eq("firm_id", callerFirmId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
