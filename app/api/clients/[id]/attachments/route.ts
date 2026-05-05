import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, created, badRequest, unauthorized, notFound, err } from "@/lib/api/response";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/clients/[id]/attachments ────────────────────────────────────────
// Accepts multipart/form-data with a "file" field.
// Uploads to storage under {firm_id}/{client_id}/{timestamp}-{filename}
// and records the metadata in client_attachments.

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { data: userData } = await supabase
    .from("users")
    .select("firm_id")
    .eq("id", user.id)
    .single();

  const firmId = userData?.firm_id as string | undefined;
  if (!firmId) return badRequest("Could not determine your firm.");

  // Verify client belongs to caller's firm
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("firm_id", firmId)
    .single();

  if (!client) return notFound("Client");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Request must be multipart/form-data.");
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") return badRequest("No file provided.");

  const file = fileEntry as File;

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per attachment
  if (file.size > MAX_BYTES) return badRequest("File too large. Maximum attachment size is 20 MB.");

  const timestamp   = Date.now();
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${firmId}/${clientId}/${timestamp}-${safeName}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("client-attachments")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) return err(`Storage upload failed: ${uploadErr.message}`);

  // Record metadata in client_attachments table
  const { data, error: dbErr } = await supabase
    .from("client_attachments")
    .insert({
      client_id:    clientId,
      firm_id:      firmId,
      uploaded_by:  user.id,
      file_name:    file.name,
      storage_path: storagePath,
      mime_type:    file.type || null,
      file_size:    file.size,
    })
    .select()
    .single();

  if (dbErr) {
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from("client-attachments").remove([storagePath]);
    return err(dbErr.message);
  }

  // Append audit trail entry
  // Non-critical — proceed even if audit append fails
  try {
    await supabase.rpc("array_append_audit", {
      client_id_input: clientId,
      entry: `Attachment "${file.name}" uploaded by ${user.email} at ${new Date().toISOString()}`,
    });
  } catch { /* ignore */ }

  return created(data);
}

// ── DELETE /api/clients/[id]/attachments?attachment_id= ───────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id: clientId } = await params;
  const attachmentId = req.nextUrl.searchParams.get("attachment_id");
  if (!attachmentId) return badRequest("attachment_id query param is required.");

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { data: userData } = await supabase
    .from("users")
    .select("firm_id")
    .eq("id", user.id)
    .single();

  const firmId = userData?.firm_id as string | undefined;
  if (!firmId) return badRequest("Could not determine your firm.");

  const { data: attachment } = await supabase
    .from("client_attachments")
    .select("id, storage_path, file_name")
    .eq("id", attachmentId)
    .eq("client_id", clientId)
    .eq("firm_id", firmId)
    .single();

  if (!attachment) return notFound("Attachment");

  await supabase.storage.from("client-attachments").remove([attachment.storage_path]);

  const { error } = await supabase
    .from("client_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return err(error.message);

  return ok({ deleted: true, attachment_id: attachmentId });
}
