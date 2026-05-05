import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, created, badRequest, unauthorized, err } from "@/lib/api/response";

// ── Shared helper ─────────────────────────────────────────────────────────────

async function getFirmId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("firm_id")
    .eq("id", userId)
    .single();
  return data?.firm_id as string | undefined;
}

// ── GET /api/clients ──────────────────────────────────────────────────────────
// Returns all clients for the caller's firm, ordered by name.
// Supports ?search= for name/NI number filtering.

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const firmId = await getFirmId(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm.");

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  let query = supabase
    .from("clients")
    .select(`
      id, full_name, date_of_birth, address, ni_number,
      status, audit_trail, created_at, updated_at,
      client_attachments ( id, file_name, storage_path, mime_type, file_size, created_at )
    `)
    .eq("firm_id", firmId)
    .order("full_name", { ascending: true });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,ni_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return err(error.message);

  return ok(data ?? []);
}

// ── POST /api/clients ─────────────────────────────────────────────────────────
// Creates a new client record.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  const firmId = await getFirmId(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { full_name, date_of_birth, address, ni_number, status } = body as Record<string, string>;

  if (!full_name?.trim())     return badRequest("full_name is required.");
  if (!date_of_birth?.trim()) return badRequest("date_of_birth is required.");
  if (!address?.trim())       return badRequest("address is required.");
  if (!ni_number?.trim())     return badRequest("ni_number is required.");

  const { data, error } = await supabase
    .from("clients")
    .insert({
      firm_id:       firmId,
      created_by:    user.id,
      full_name:     full_name.trim(),
      date_of_birth: date_of_birth.trim(),
      address:       address.trim(),
      ni_number:     ni_number.trim().toUpperCase(),
      status:        status?.trim() || null,
      audit_trail:   [`Client record created by ${user.email} on ${new Date().toISOString()}`],
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("A client with this name, date of birth, and NI number already exists.");
    }
    return err(error.message);
  }

  return created(data);
}
