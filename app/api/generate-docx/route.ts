import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFromTemplate } from "@/lib/docxtemplater-engine";
import { err, badRequest, unauthorized } from "@/lib/api/response";

// POST /api/generate-docx
// Any authenticated user.
// Body: { templateId: string; formData: Record<string, unknown>; versionId?: string }
// Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
export async function POST(request: NextRequest) {
  // Auth — user client validates the session cookie
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const { templateId, formData, versionId } = body as {
    templateId?: string;
    formData?: Record<string, unknown>;
    versionId?: string;
  };

  if (!templateId || !formData) return badRequest("templateId and formData are required");

  const db = createAdminClient();

  // Fetch the active template version (or a specific version if pinned)
  let query = db
    .from("template_versions")
    .select("id, docx_template_path")
    .eq("template_id", templateId)
    .eq("is_active", true);

  if (versionId) {
    query = query.eq("id", versionId);
  } else {
    query = query.order("version_number", { ascending: false }).limit(1);
  }

  const { data: version, error: vError } = await query.single();
  if (vError || !version) return err("Template version not found or not published", 404);

  // Download the DOCX template from storage
  const { data: blob, error: downloadError } = await db.storage
    .from("docx-templates")
    .download(version.docx_template_path);

  if (downloadError || !blob) {
    return err(`Failed to download template: ${downloadError?.message ?? "unknown"}`);
  }

  // Generate the populated DOCX
  const templateBuffer = await blob.arrayBuffer();
  const generatedBuffer = await generateFromTemplate(
    templateBuffer,
    formData as Record<string, string>
  );

  const filename = `document-${templateId.slice(0, 8)}-${Date.now()}.docx`;

  // Return binary — cannot use ok() helper here as it wraps in JSON
  return new NextResponse(new Uint8Array(generatedBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
