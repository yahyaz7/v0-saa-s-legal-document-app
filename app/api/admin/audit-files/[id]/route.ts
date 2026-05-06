import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, deleted, badRequest, unauthorized, forbidden, notFound, err } from "@/lib/api/response";

type RouteContext = { params: Promise<{ id: string }> };

// ── Shared: resolve caller's firm and assert admin role ───────────────────────

async function getAdminContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("firm_id, roles(name)")
    .eq("id", userId)
    .single();

  const firmId = data?.firm_id as string | undefined;
  const role   = (data?.roles as unknown as { name: string } | null)?.name ?? "staff";
  return { firmId, role };
}

// ── GET /api/admin/audit-files/[id] ──────────────────────────────────────────
// Returns a short-lived signed download URL (60 s) for the requested file.
// The Content-Disposition filename is set to the display_name so the browser
// saves the file with the user-chosen name.

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId, role } = await getAdminContext(supabase, user.id);
  if (!firmId)          return badRequest("Could not determine your firm.");
  if (role !== "admin") return forbidden();

  const { data: record } = await supabase
    .from("audit_files")
    .select("id, display_name, storage_path")
    .eq("id", id)
    .eq("firm_id", firmId)
    .single();

  if (!record) return notFound("Audit file");

  // 300 second signed URL — enough time to start the download
  const { data: signedData, error: signedErr } = await supabase.storage
    .from("audit-files")
    .createSignedUrl(record.storage_path, 300, {
      download: record.display_name, // sets Content-Disposition filename
    });

  if (signedErr || !signedData?.signedUrl) {
    return err("Could not generate download URL. Please try again.");
  }

  return ok({ url: signedData.signedUrl, display_name: record.display_name });
}

// ── DELETE /api/admin/audit-files/[id] ───────────────────────────────────────
// Removes the storage object and the metadata row.

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId, role } = await getAdminContext(supabase, user.id);
  if (!firmId)          return badRequest("Could not determine your firm.");
  if (role !== "admin") return forbidden();

  const { data: record } = await supabase
    .from("audit_files")
    .select("id, storage_path")
    .eq("id", id)
    .eq("firm_id", firmId)
    .single();

  if (!record) return notFound("Audit file");

  // Remove storage object first; tolerate missing objects (already deleted)
  await supabase.storage.from("audit-files").remove([record.storage_path]);

  const { error } = await supabase
    .from("audit_files")
    .delete()
    .eq("id", id);

  if (error) return err(error.message);

  return deleted();
}
