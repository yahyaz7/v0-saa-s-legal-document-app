import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { ok, created, deleted, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertSuperAdmin(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return "unauthorized";

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return "unauthorized";
  if (user.app_metadata?.role !== "super_admin") return "forbidden";
  return null;
}

// GET /api/super-admin/users?firmId=<uuid>
// Returns { data: FirmUser[] }
export async function GET(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const firmId = new URL(request.url).searchParams.get("firmId");
  if (!firmId) return badRequest("firmId is required");

  const { data, error } = await makeAdminClient()
    .from("users")
    .select("id, name, email, is_active, created_at, roles(name)")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);
  return ok(data ?? []);
}

// POST /api/super-admin/users
// Body: { email, password, fullName, firmId }
// Returns { data: { userId, email, firm, role } }
export async function POST(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const body = await request.json().catch(() => ({}));
  const { email, password, fullName, firmId } = body as Record<string, string>;

  if (!email || !password || !firmId) {
    return badRequest("email, password, and firmId are required");
  }
  if (password.length < 8) {
    return badRequest("password must be at least 8 characters");
  }

  const db = makeAdminClient();

  const { data: firm, error: firmError } = await db
    .from("firms").select("id, name").eq("id", firmId).single();
  if (firmError || !firm) return notFound("Firm");

  const { data: adminRole, error: roleError } = await db
    .from("roles").select("id").eq("name", "admin").single();
  if (roleError || !adminRole) return err("admin role not found in roles table");

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin", firm_id: firmId },
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });
  if (authError) return err(authError.message);

  // Guard against trigger's grays-defence fallback — explicitly set correct values
  await db.from("users")
    .update({ firm_id: firmId, role_id: adminRole.id })
    .eq("id", authData.user.id);

  return created({ userId: authData.user.id, email: authData.user.email, firm: firm.name, role: "admin" });
}

// DELETE /api/super-admin/users?userId=<uuid>
// Returns { success: true }
export async function DELETE(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return badRequest("userId is required");

  const db = makeAdminClient();

  // No FK cascade from auth → public, so delete public.users first
  const { error: publicError } = await db.from("users").delete().eq("id", userId);
  if (publicError) return err(publicError.message);

  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) return err(authError.message);

  return deleted();
}
