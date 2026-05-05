import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, deleted, badRequest, unauthorized, notFound, err } from "@/lib/api/response";

// ── Shared helper ─────────────────────────────────────────────────────────────

async function getFirmIdAndRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("firm_id, roles(name)")
    .eq("id", userId)
    .single();
  return {
    firmId: data?.firm_id as string | undefined,
    role:   (data?.roles as unknown as { name: string } | null)?.name ?? "staff",
  };
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/clients/[id] ─────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId } = await getFirmIdAndRole(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm.");

  const { data, error } = await supabase
    .from("clients")
    .select(`
      id, full_name, date_of_birth, address, ni_number,
      status, audit_trail, created_at, updated_at,
      client_attachments ( id, file_name, storage_path, mime_type, file_size, created_at )
    `)
    .eq("id", id)
    .eq("firm_id", firmId)
    .single();

  if (error || !data) return notFound("Client");

  return ok(data);
}

// ── PUT /api/clients/[id] ─────────────────────────────────────────────────────
// Updates editable fields. audit_trail entries are appended, not replaced.

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId } = await getFirmIdAndRole(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { full_name, date_of_birth, address, ni_number, status, audit_entry } = body as Record<string, string>;

  if (!full_name?.trim())     return badRequest("full_name is required.");
  if (!date_of_birth?.trim()) return badRequest("date_of_birth is required.");
  if (!address?.trim())       return badRequest("address is required.");
  if (!ni_number?.trim())     return badRequest("ni_number is required.");

  // Verify client belongs to caller's firm before updating
  const { data: existing } = await supabase
    .from("clients")
    .select("id, audit_trail")
    .eq("id", id)
    .eq("firm_id", firmId)
    .single();

  if (!existing) return notFound("Client");

  const currentTrail: string[] = existing.audit_trail ?? [];
  const newTrail = audit_entry?.trim()
    ? [...currentTrail, `${audit_entry.trim()} — ${user.email} at ${new Date().toISOString()}`]
    : currentTrail;

  const { data, error } = await supabase
    .from("clients")
    .update({
      full_name:     full_name.trim(),
      date_of_birth: date_of_birth.trim(),
      address:       address.trim(),
      ni_number:     ni_number.trim().toUpperCase(),
      status:        status?.trim() || null,
      audit_trail:   newTrail,
    })
    .eq("id", id)
    .eq("firm_id", firmId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("A client with this name, date of birth, and NI number already exists.");
    }
    return err(error.message);
  }

  return ok(data);
}

// ── DELETE /api/clients/[id] ──────────────────────────────────────────────────
// Any firm member can delete a client. Also removes all storage objects.

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const { firmId } = await getFirmIdAndRole(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm.");

  // Fetch attachments so we can clean up storage
  const { data: attachments } = await supabase
    .from("client_attachments")
    .select("storage_path")
    .eq("client_id", id);

  if (attachments?.length) {
    await supabase.storage
      .from("client-attachments")
      .remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("firm_id", firmId);

  if (error) return err(error.message);

  return deleted();
}
