import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertSuperAdmin(request: NextRequest): Promise<{ error: string; status: number } | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return { error: "Unauthorized", status: 401 };
  if (user.app_metadata?.role !== "super_admin") return { error: "Forbidden", status: 403 };
  return null;
}

// GET /api/super-admin/users?firmId=<uuid>
// Lists all users belonging to a firm
export async function GET(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const firmId = new URL(request.url).searchParams.get("firmId");
  if (!firmId) return NextResponse.json({ error: "firmId is required" }, { status: 400 });

  const { data, error } = await makeAdminClient()
    .from("users")
    .select("id, name, email, is_active, created_at, roles(name)")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/super-admin/users
// Creates a firm admin. firmId must be in the request body.
// After auth user creation the trigger runs, but we also explicitly
// correct firm_id + role_id in public.users to guard against the
// trigger's grays-defence fallback.
export async function POST(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const body = await request.json().catch(() => ({}));
  const { email, password, fullName, firmId } = body;

  if (!email || !password || !firmId) {
    return NextResponse.json({ error: "email, password, and firmId are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const db = makeAdminClient();

  // Verify firm exists
  const { data: firm, error: firmError } = await db
    .from("firms")
    .select("id, name")
    .eq("id", firmId)
    .single();

  if (firmError || !firm) {
    return NextResponse.json({ error: "Firm not found" }, { status: 404 });
  }

  // Look up the admin role id upfront
  const { data: adminRole, error: roleError } = await db
    .from("roles")
    .select("id")
    .eq("name", "admin")
    .single();

  if (roleError || !adminRole) {
    return NextResponse.json({ error: "admin role not found in roles table" }, { status: 500 });
  }

  // Create auth user — app_metadata drives the trigger
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin", firm_id: firmId },
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userId = authData.user.id;

  // Explicitly correct public.users — guards against the trigger's
  // grays-defence fallback if app_metadata wasn't read correctly.
  const { error: updateError } = await db
    .from("users")
    .update({ firm_id: firmId, role_id: adminRole.id })
    .eq("id", userId);

  if (updateError) {
    // Non-fatal: auth user was created, public.users may just need a manual fix
    console.error("Failed to correct public.users for", userId, updateError.message);
  }

  return NextResponse.json(
    { success: true, userId, email: authData.user.email, firm: firm.name, role: "admin" },
    { status: 201 }
  );
}

// DELETE /api/super-admin/users?userId=<uuid>
// Removes a user from both public.users and auth.users
export async function DELETE(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const db = makeAdminClient();

  // Delete from public.users first (no FK cascade from auth → public)
  const { error: publicError } = await db
    .from("users")
    .delete()
    .eq("id", userId);

  if (publicError) {
    return NextResponse.json({ error: publicError.message }, { status: 500 });
  }

  // Delete from auth.users
  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
