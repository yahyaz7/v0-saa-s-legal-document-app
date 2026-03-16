import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, created, err, badRequest, unauthorized } from "@/lib/api/response";

// ── Auth helper ────────────────────────────────────────────────────────────────
// Reads role from the JWT app_metadata — no extra DB round-trip needed.
async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return null;

  return { user, role };
}

// GET /api/admin/templates
// Returns all templates for the caller's firm.
export async function GET() {
  const caller = await getAdminUser();
  if (!caller) return unauthorized();

  const firmId = caller.user.app_metadata?.firm_id as string | undefined;
  if (!firmId) return badRequest("Could not determine your firm");

  const db = createAdminClient();

  const { data, error } = await db
    .from("templates")
    .select("id, name, description, is_active, created_at, template_versions(count)")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);

  return ok(
    (data ?? []).map((t) => ({
      ...t,
      versionCount: (t.template_versions as { count: number }[])[0]?.count ?? 0,
    }))
  );
}

// POST /api/admin/templates
// Legacy single-shot endpoint: upload DOCX + insert fields in one request.
// The stepper flow in /admin/templates/manage uses the dedicated upload /
// detect-placeholders / fields/setup / publish endpoints instead.
export async function POST(request: NextRequest) {
  const caller = await getAdminUser();
  if (!caller) return unauthorized();

  const firmId = caller.user.app_metadata?.firm_id as string | undefined;
  if (!firmId) return badRequest("Could not determine your firm");

  const formData = await request.formData().catch(() => null);
  if (!formData) return badRequest("Invalid form data");

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const description = ((formData.get("description") as string | null) ?? "").trim();
  const fieldsRaw = formData.get("fields") as string | null;

  if (!file || !name) return badRequest("file and name are required");
  if (!file.name.endsWith(".docx")) return badRequest("Only .docx files are allowed");

  const fields: Record<string, unknown>[] = fieldsRaw
    ? JSON.parse(fieldsRaw)
    : [];

  const db = createAdminClient();

  // 1. Create template record (published immediately via this legacy flow)
  const { data: template, error: tError } = await db
    .from("templates")
    .insert({ firm_id: firmId, name, description, is_active: true })
    .select("id")
    .single();

  if (tError) return err(tError.message);

  // 2. Create version record — generate ID first so we can use it in the path
  const versionId = crypto.randomUUID();
  const filePath = `templates/${versionId}.docx`;

  const { data: version, error: vError } = await db
    .from("template_versions")
    .insert({
      id: versionId,
      template_id: template.id,
      version_number: 1,
      docx_template_path: filePath,
      is_active: true,
      created_by: caller.user.id,
    })
    .select("id")
    .single();

  if (vError) {
    await db.from("templates").delete().eq("id", template.id);
    return err(vError.message);
  }

  // 3. Upload DOCX to the correct storage bucket
  const { error: uploadError } = await db.storage
    .from("docx-templates")   // ← fixed: was "templates"
    .upload(filePath, file, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    await db.from("template_versions").delete().eq("id", version.id);
    await db.from("templates").delete().eq("id", template.id);
    return err(`Storage upload failed: ${uploadError.message}`);
  }

  // 4. Insert field definitions (if provided)
  if (fields.length > 0) {
    const fieldRows = fields.map((f, index) => ({
      template_version_id: version.id,
      field_key: f.field_key ?? f.field_name,
      field_label: f.field_label,
      field_type: f.field_type,
      is_required: f.is_required ?? false,
      field_order: index,
      field_options: f.field_options ?? [],
      supports_phrase_bank: f.supports_phrase_bank ?? false,
    }));

    const { error: fError } = await db.from("template_fields").insert(fieldRows);

    if (fError) {
      // Rollback everything
      await db.storage.from("docx-templates").remove([filePath]);
      await db.from("template_versions").delete().eq("id", version.id);
      await db.from("templates").delete().eq("id", template.id);
      return err(fError.message);
    }
  }

  return created({ templateId: template.id, versionId: version.id });
}
