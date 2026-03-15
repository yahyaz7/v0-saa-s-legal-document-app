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

async function getCallerMeta(request: NextRequest): Promise<{ role: string | null; firmId: string | null }> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { role: null, firmId: null };

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return { role: null, firmId: null };

  return {
    role: (user.app_metadata?.role as string) ?? null,
    firmId: (user.app_metadata?.firm_id as string) ?? null,
  };
}

// GET /api/admin/users
// Firm admins only — lists all staff in the caller's own firm
// Returns { data: User[] }
export async function GET(request: NextRequest) {
  const { role, firmId } = await getCallerMeta(request);

  if (!role) return unauthorized();
  if (role !== "admin") return forbidden();
  if (!firmId) return badRequest("Could not determine your firm");

  const { data, error } = await makeAdminClient()
    .from("users")
    .select("id, name, email, is_active, created_at, roles(name)")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);
  return ok(data ?? []);
}

// POST /api/admin/users
// Firm admins only — creates a staff member scoped to the caller's firm
// Body: { email, password, fullName? }
// Returns { data: { userId, email, firm, role } }
export async function POST(request: NextRequest) {
  const { role, firmId } = await getCallerMeta(request);

  if (!role) return unauthorized();
  if (role !== "admin") return forbidden();
  if (!firmId) return badRequest("Could not determine your firm");

  const body = await request.json().catch(() => ({}));
  const { email, password, fullName } = body as Record<string, string>;

  if (!email || !password) return badRequest("email and password are required");
  if (password.length < 8) return badRequest("password must be at least 8 characters");

  const db = makeAdminClient();

  const { data: firm, error: firmError } = await db
    .from("firms").select("id, name").eq("id", firmId).single();
  if (firmError || !firm) return notFound("Firm");

  const { data: staffRole, error: roleError } = await db
    .from("roles").select("id").eq("name", "staff").single();
  if (roleError || !staffRole) return err("staff role not found");

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "staff", firm_id: firmId },
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });
  if (authError) return err(authError.message);

  // Guard against trigger's grays-defence fallback — explicitly set correct values
  await db.from("users")
    .update({ firm_id: firmId, role_id: staffRole.id })
    .eq("id", authData.user.id);

  return created({ userId: authData.user.id, email: authData.user.email, firm: firm.name, role: "staff" });
}

// DELETE /api/admin/users?userId=<uuid>
// Firm admins only — removes a staff member from auth + public.users
// Returns { success: true }
export async function DELETE(request: NextRequest) {
  const { role, firmId } = await getCallerMeta(request);

  if (!role) return unauthorized();
  if (role !== "admin") return forbidden();
  if (!firmId) return badRequest("Could not determine your firm");

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return badRequest("userId is required");

  const db = makeAdminClient();

  // Verify the user belongs to this admin's firm before deleting
  const { data: targetUser, error: lookupError } = await db
    .from("users")
    .select("id, firm_id")
    .eq("id", userId)
    .eq("firm_id", firmId)
    .single();

  if (lookupError || !targetUser) return notFound("User");

  // Delete from public.users first (no FK cascade from auth → public)
  const { error: publicError } = await db.from("users").delete().eq("id", userId);
  if (publicError) return err(publicError.message);

  // Delete from auth.users
  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) return err(authError.message);

  return deleted();
}
