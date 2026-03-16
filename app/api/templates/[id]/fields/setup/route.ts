import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";

// POST /api/templates/[id]/fields/setup
// Admin / super_admin only.
// Replaces all field definitions for the template version (idempotent upsert).
// Body: { fields: FieldConfig[]; versionId?: string }
// Returns { data: { saved: number } }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  // Role from JWT
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return forbidden();

  const body = await request.json().catch(() => ({}));
  const { fields, versionId } = body as {
    fields?: Record<string, unknown>[];
    versionId?: string;
  };

  if (!Array.isArray(fields)) return badRequest("'fields' must be an array");

  const db = createAdminClient();

  // Resolve version
  let query = db
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId);

  if (versionId) {
    query = query.eq("id", versionId);
  } else {
    query = query.order("version_number", { ascending: false }).limit(1);
  }

  const { data: version, error: vError } = await query.single();
  if (vError || !version) return notFound("Template version");

  // Delete existing fields for this version then re-insert (idempotent)
  await db.from("template_fields").delete().eq("template_version_id", version.id);

  if (fields.length > 0) {
    const rows = fields.map((f, index) => ({
      template_version_id: version.id,
      field_key: (f.field_name ?? f.field_key) as string,
      field_label: f.field_label as string,
      field_type: f.field_type as string,
      is_required: (f.is_required as boolean) ?? false,
      field_order: (f.field_order as number) ?? index,
      field_options: (f.field_options as unknown[]) ?? [],
      supports_phrase_bank: (f.supports_phrase_bank as boolean) ?? false,
    }));

    const { error: insertError } = await db.from("template_fields").insert(rows);
    if (insertError) return err(insertError.message);
  }

  return ok({ saved: fields.length });
}
