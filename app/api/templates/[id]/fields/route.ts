import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";

// GET /api/templates/[id]/fields
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const db = createAdminClient();

  // Fetch latest active version
  const { data: version, error: vError } = await db
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (vError || !version) return notFound("Template version");

  // Fetch fields — return DB column names directly (field_key is canonical)
  const { data: fields, error: fError } = await db
    .from("template_fields")
    .select(
      "field_key, field_label, field_type, is_required, field_order, field_options, supports_phrase_bank"
    )
    .eq("template_version_id", version.id)
    .order("field_order", { ascending: true });

  if (fError) return err(fError.message);

  return ok(fields ?? []);
}

// PATCH /api/templates/[id]/fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return forbidden();

  const body = await request.json().catch(() => null);
  if (!body?.fields || !Array.isArray(body.fields)) return badRequest("fields array is required");

  type FieldUpdate = {
    field_key: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    field_order: number;
    field_options: string[] | null;
    supports_phrase_bank: boolean;
  };

  const db = createAdminClient();

  // 1. Get current active version (need version_number and docx_template_path)
  const { data: currentVersion, error: vError } = await db
    .from("template_versions")
    .select("id, version_number, docx_template_path")
    .eq("template_id", templateId)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (vError || !currentVersion) return notFound("Template version");

  // 2. Create the new version row (same DOCX file, incremented number)
  const newVersionNumber = currentVersion.version_number + 1;
  const { data: newVersion, error: nvError } = await db
    .from("template_versions")
    .insert({
      template_id: templateId,
      version_number: newVersionNumber,
      docx_template_path: currentVersion.docx_template_path,
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (nvError || !newVersion) return err(nvError?.message ?? "Failed to create new version");

  // 3. Insert updated fields into the new version
  const fieldRows = (body.fields as FieldUpdate[]).map((f, index) => ({
    template_version_id: newVersion.id,
    field_key: f.field_key,
    field_label: f.field_label?.trim(),
    field_type: f.field_type,
    is_required: f.is_required,
    field_order: f.field_order ?? index,
    field_options: f.field_options ?? null,
    supports_phrase_bank: f.supports_phrase_bank,
  }));

  const { error: insertError } = await db.from("template_fields").insert(fieldRows);

  if (insertError) {
    // Rollback new version
    await db.from("template_versions").delete().eq("id", newVersion.id);
    return err(insertError.message);
  }

  // 4. Deactivate the old version
  await db
    .from("template_versions")
    .update({ is_active: false })
    .eq("id", currentVersion.id);

  return ok({ version: newVersionNumber, fields: fieldRows.length });
}
