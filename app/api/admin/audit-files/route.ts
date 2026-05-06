import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, created, badRequest, unauthorized, forbidden, err } from "@/lib/api/response";

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

// ── GET /api/admin/audit-files ─────────────────────────────────────────────────
// Returns all audit files for the caller's firm, ordered newest first.

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId, role } = await getAdminContext(supabase, user.id);
  if (!firmId)          return badRequest("Could not determine your firm.");
  if (role !== "admin") return forbidden();

  const { data, error } = await supabase
    .from("audit_files")
    .select("id, display_name, mime_type, file_size, expires_at, created_at, storage_path")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);

  return ok(data ?? []);
}

// ── POST /api/admin/audit-files ────────────────────────────────────────────────
// Accepts multipart/form-data with fields:
//   file         — the binary file (required)
//   display_name — human-readable label (required)
//   expires_at   — ISO date string YYYY-MM-DD (optional)

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId, role } = await getAdminContext(supabase, user.id);
  if (!firmId)          return badRequest("Could not determine your firm.");
  if (role !== "admin") return forbidden();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Request must be multipart/form-data.");
  }

  const fileEntry  = formData.get("file");
  const displayName = (formData.get("display_name") as string | null)?.trim();
  const expiresAt   = (formData.get("expires_at")   as string | null)?.trim() || null;

  if (!fileEntry || typeof fileEntry === "string") return badRequest("No file provided.");
  if (!displayName)                                 return badRequest("display_name is required.");

  const file = fileEntry as File;

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_BYTES) return badRequest("File too large. Maximum size is 50 MB.");

  // Store under audit-files/{firm_id}/{display_name} — use the display name as
  // the object key so downloads preserve the user-chosen filename.
  const safeDisplayName = displayName.replace(/[^a-zA-Z0-9._\- ]/g, "_");
  const timestamp       = Date.now();
  const storagePath     = `${firmId}/${timestamp}-${safeDisplayName}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("audit-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) return err(`Storage upload failed: ${uploadErr.message}`);

  const { data, error: dbErr } = await supabase
    .from("audit_files")
    .insert({
      firm_id:      firmId,
      uploaded_by:  user.id,
      display_name: displayName,
      storage_path: storagePath,
      mime_type:    file.type || null,
      file_size:    file.size,
      expires_at:   expiresAt || null,
    })
    .select("id, display_name, mime_type, file_size, expires_at, created_at, storage_path")
    .single();

  if (dbErr) {
    // Best-effort: clean up orphaned storage object
    await supabase.storage.from("audit-files").remove([storagePath]);
    return err(dbErr.message);
  }

  return created(data);
}
