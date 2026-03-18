import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";

// POST /api/templates/[id]/fields/setup
// Admin / super_admin only.
// Replaces all field definitions for the template version (idempotent upsert).
// Also persists the optional form heading onto the version row.
// Body: { fields: FieldConfig[]; versionId?: string; formHeading?: string }
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
  const { fields, versionId, formHeading } = body as {
    fields?: Record<string, unknown>[];
    versionId?: string;
    formHeading?: string;
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

  // Persist form heading onto the version row when provided
  if (formHeading !== undefined) {
    await db
      .from("template_versions")
      .update({ form_heading: formHeading || null })
      .eq("id", version.id);
  }

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
      section_heading: (f.section_heading as string) ?? null,
    }));

    const { error: insertError } = await db.from("template_fields").insert(rows);
    if (insertError) return err(insertError.message);
  }

  return ok({ saved: fields.length });
}
