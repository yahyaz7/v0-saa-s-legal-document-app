import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFromTemplate } from "@/lib/docxtemplater-engine";
import { err, badRequest, unauthorized } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/generate-docx
// Any authenticated user. Rate limited: 20 generations per minute per user.
// Body: { templateId: string; formData: Record<string, unknown>; versionId?: string; draftId?: string }
// Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  // Rate limit: 20 generations per user per minute
  if (!rateLimit("generate-docx", user.id, 20, 60_000)) {
    return err("Too many requests. Please wait before generating another document.", 429);
  }

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const { templateId, formData, versionId, draftId } = body as {
    templateId?: string;
    formData?: Record<string, unknown>;
    versionId?: string;
    draftId?: string;
  };

  if (!templateId || !formData) return badRequest("templateId and formData are required");
  if (typeof formData !== "object" || Array.isArray(formData)) {
    return badRequest("formData must be a key-value object");
  }

  const db = createAdminClient();

  // ── 1. Fetch the active template version ───────────────────────────────────
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

  // ── 2. Download the DOCX template from storage ────────────────────────────
  const { data: blob, error: downloadError } = await db.storage
    .from("docx-templates")
    .download(version.docx_template_path);

  if (downloadError || !blob) {
    return err(`Failed to download template: ${downloadError?.message ?? "unknown"}`);
  }

  // ── 3. Generate the populated DOCX ────────────────────────────────────────
  let generatedBuffer: Buffer;
  let unmatchedPlaceholders: string[] = [];
  try {
    const templateBuffer = await blob.arrayBuffer();
    const result = await generateFromTemplate(
      templateBuffer,
      formData as Record<string, string>
    );
    generatedBuffer = result.buffer;
    unmatchedPlaceholders = result.unmatched;
  } catch (genErr: any) {
    return err(genErr.message ?? "Document generation failed");
  }

  // ── 4. Build a meaningful filename ────────────────────────────────────────
  const clientName = (
    (formData.client as string) ||
    (formData.client_name as string) ||
    (formData.name as string) ||
    ""
  ).trim();

  const datePart = new Date().toISOString().slice(0, 10);
  const clientSlug = clientName
    ? clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)
    : "document";

  const filename = `${clientSlug}-${datePart}.docx`;

  // ── 5. Record the generation event (non-blocking) ─────────────────────────
  db.from("document_generations")
    .insert({
      user_id: user.id,
      template_id: templateId,
      file_name: filename,
      ...(draftId ? { draft_id: draftId } : {}),
    })
    .then(({ error: recErr }) => {
      if (recErr) console.error("[generate-docx] Failed to record generation:", recErr.message);
    });

  // ── 6. Return the binary file ─────────────────────────────────────────────
  const responseHeaders: Record<string, string> = {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
  // Let the frontend know if any template placeholders were unfilled
  if (unmatchedPlaceholders.length > 0) {
    responseHeaders["X-Unmatched-Placeholders"] = unmatchedPlaceholders.join(",");
  }

  return new NextResponse(new Uint8Array(generatedBuffer), {
    status: 200,
    headers: responseHeaders,
  });
}
