import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { ok, deleted, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getCallerFirmAdmin(
  request: NextRequest
): Promise<{ firmId: string } | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  if (user.app_metadata?.role !== "admin") return null;

  const firmId = user.app_metadata?.firm_id as string | undefined;
  if (!firmId) return null;

  return { firmId };
}

// GET /api/admin/firm
export async function GET(request: NextRequest) {
  const caller = await getCallerFirmAdmin(request);
  if (!caller) {
    const auth = request.headers.get("Authorization");
    return auth ? forbidden() : unauthorized();
  }

  const db = makeAdminClient();

  const { data: firm, error: firmError } = await db
    .from("firms")
    .select("id, name, slug, created_at")
    .eq("id", caller.firmId)
    .single();

  if (firmError || !firm) return notFound("Firm");

  const { count, error: countError } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", caller.firmId);

  if (countError) return err(countError.message);

  return ok({ ...firm, userCount: count ?? 0 });
}

// PATCH /api/admin/firm
export async function PATCH(request: NextRequest) {
  const caller = await getCallerFirmAdmin(request);
  if (!caller) {
    const auth = request.headers.get("Authorization");
    return auth ? forbidden() : unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, string> = {};

  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.slug?.trim()) updates.slug = body.slug.trim();

  if (Object.keys(updates).length === 0) {
    return badRequest("Provide at least one field to update: name or slug");
  }

  const { data, error } = await makeAdminClient()
    .from("firms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", caller.firmId)
    .select("id, name, slug, created_at")
    .single();

  if (error) return err(error.message);
  return ok(data);
}

// DELETE /api/admin/firm
// Deletes the firm and all its users (auth + public).
// The cascade on public.users.firm_id handles public row cleanup
// automatically when the firm row is deleted; we handle auth cleanup manually.
export async function DELETE(request: NextRequest) {
  const caller = await getCallerFirmAdmin(request);
  if (!caller) {
    const auth = request.headers.get("Authorization");
    return auth ? forbidden() : unauthorized();
  }

  const db = makeAdminClient();

  // 1. Collect all auth user IDs in this firm
  const { data: firmUsers, error: listError } = await db
    .from("users")
    .select("id")
    .eq("firm_id", caller.firmId);

  if (listError) return err(listError.message);

  // 2. Delete each auth user — public.users will cascade via FK
  const authDeletions = await Promise.allSettled(
    (firmUsers ?? []).map((u) => db.auth.admin.deleteUser(u.id))
  );
  const failed = authDeletions.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    return err(`Failed to remove ${failed.length} auth user(s). Aborting firm deletion.`, 409);
  }

  // 3. Delete the firm — ON DELETE CASCADE removes remaining public.users rows
  const { error: firmDeleteError } = await db
    .from("firms")
    .delete()
    .eq("id", caller.firmId);

  if (firmDeleteError) return err(firmDeleteError.message);

  return deleted();
}
