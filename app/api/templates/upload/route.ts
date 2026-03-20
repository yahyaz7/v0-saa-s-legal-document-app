import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { created, err, badRequest, unauthorized, forbidden } from "@/lib/api/response";

// POST /api/templates/upload
// Admin / super_admin only.
// Always creates a brand-new template record + version 1.
// Returns { data: { template_id, version_id, docx_template_path } }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return forbidden();

  const firmId = user.app_metadata?.firm_id as string | undefined;
  if (!firmId) return badRequest("Could not determine your firm");

  const formData = await request.formData().catch(() => null);
  if (!formData) return badRequest("Invalid form data");

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const description = ((formData.get("description") as string | null) ?? "").trim();

  if (!file || !name) return badRequest("file and name are required");
  if (!file.name.endsWith(".docx")) return badRequest("Only .docx files are allowed");
  if (file.size > 10 * 1024 * 1024) return badRequest("File must be under 10 MB");

  const db = createAdminClient();

  // 1. Create template record (draft — not yet active)
  const { data: template, error: tError } = await db
    .from("templates")
    .insert({ firm_id: firmId, name, description, is_active: false })
    .select("id")
    .single();

  if (tError) return err(tError.message);

  // 2. Generate version ID upfront so it can be used in the storage path
  const versionId = crypto.randomUUID();
  const filePath = `templates/${versionId}.docx`;

  // 3. Create version record
  const { data: version, error: vError } = await db
    .from("template_versions")
    .insert({
      id: versionId,
      template_id: template.id,
      version_number: 1,
      docx_template_path: filePath,
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (vError) {
    await db.from("templates").delete().eq("id", template.id);
    return err(vError.message);
  }

  // 4. Upload to storage
  const { error: uploadError } = await db.storage
    .from("docx-templates")
    .upload(filePath, file, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadError) {
    await db.from("template_versions").delete().eq("id", version.id);
    await db.from("templates").delete().eq("id", template.id);
    return err(`Storage upload failed: ${uploadError.message}`);
  }

  return created({
    template_id: template.id,
    version_id: version.id,
    docx_template_path: filePath,
  });
}
