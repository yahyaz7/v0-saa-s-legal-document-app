import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { ok, created, err, badRequest, unauthorized, forbidden } from "@/lib/api/response";

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

// GET /api/super-admin/firms
// Returns { data: Firm[] } — each firm includes a userCount
export async function GET(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const db = makeAdminClient();

  const { data: firms, error: firmsError } = await db
    .from("firms")
    .select("id, name, slug, logo_url, created_at")
    .order("created_at", { ascending: false });

  if (firmsError) return err(firmsError.message);

  const { data: userRows, error: countError } = await db
    .from("users")
    .select("firm_id")
    .not("firm_id", "is", null);

  if (countError) return err(countError.message);

  const countMap: Record<string, number> = {};
  for (const row of userRows ?? []) {
    if (row.firm_id) countMap[row.firm_id] = (countMap[row.firm_id] ?? 0) + 1;
  }

  const data = (firms ?? []).map((f) => ({ ...f, userCount: countMap[f.id] ?? 0 }));
  return ok(data);
}

// POST /api/super-admin/firms
// Body: { name: string; slug: string }
// Returns { data: Firm }
export async function POST(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  const slug = (body.slug as string)?.trim();

  if (!name || !slug) return badRequest("name and slug are required");

  const { data, error } = await makeAdminClient()
    .from("firms")
    .insert({ name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (error) return err(error.message);
  return created({ ...data, userCount: 0 });
}

// PATCH /api/super-admin/firms?firmId=xxx
// Body: { name?: string; slug?: string }
export async function PATCH(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const firmId = request.nextUrl.searchParams.get("firmId");
  if (!firmId) return badRequest("firmId is required");

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, string | null> = {};
  if ((body.name as string)?.trim()) updates.name = (body.name as string).trim();
  if ((body.slug as string)?.trim()) updates.slug = (body.slug as string).trim();
  if ("logo_url" in body) updates.logo_url = typeof body.logo_url === "string" ? body.logo_url : null;

  if (Object.keys(updates).length === 0) return badRequest("Nothing to update");

  const { data, error } = await makeAdminClient()
    .from("firms")
    .update(updates)
    .eq("id", firmId)
    .select("id, name, slug, logo_url, created_at")
    .single();

  if (error) return err(error.message);
  return ok(data);
}

// DELETE /api/super-admin/firms?firmId=xxx
// Deletes a firm and all its users
export async function DELETE(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied === "unauthorized") return unauthorized();
  if (denied === "forbidden") return forbidden();

  const firmId = request.nextUrl.searchParams.get("firmId");
  if (!firmId) return badRequest("firmId is required");

  const db = makeAdminClient();

  // 1. Load all users in this firm so we can delete them from auth
  const { data: firmUsers, error: usersError } = await db
    .from("users")
    .select("id")
    .eq("firm_id", firmId);

  if (usersError) return err(usersError.message);

  // 2. Delete each user from Supabase Auth
  for (const u of firmUsers ?? []) {
    await db.auth.admin.deleteUser(u.id);
  }

  // 3. Delete the firm record (users rows cascade via FK or were already removed)
  const { error: firmError } = await db
    .from("firms")
    .delete()
    .eq("id", firmId);

  if (firmError) return err(firmError.message);
  return ok({ deleted: true });
}

