import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";
import PizZip from "pizzip";

// POST /api/templates/[id]/detect-placeholders
// Admin / super_admin only.
// Downloads the template DOCX from storage, scans all XML files for
// {snake_case_placeholder} tokens, and returns a deduplicated sorted list.
// Body (optional): { versionId: string }
// Returns { data: string[] }
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
  const versionId: string | undefined = body.versionId;

  const db = createAdminClient();

  // Fetch version to get the storage path
  let query = db
    .from("template_versions")
    .select("id, docx_template_path")
    .eq("template_id", templateId);

  if (versionId) {
    query = query.eq("id", versionId);
  } else {
    query = query.order("version_number", { ascending: false }).limit(1);
  }

  const { data: version, error: vError } = await query.single();
  if (vError || !version) return notFound("Template version");

  // Download DOCX from storage
  const { data: blob, error: downloadError } = await db.storage
    .from("docx-templates")
    .download(version.docx_template_path);

  if (downloadError || !blob) {
    return err(`Failed to download template: ${downloadError?.message ?? "unknown"}`);
  }

  // Extract {snake_case} placeholders from every XML file in the zip
  const content = await blob.arrayBuffer();
  const zip = new PizZip(content);
  const regex = /\{[a-z0-9_]+\}/g;
  const placeholders = new Set<string>();

  Object.keys(zip.files)
    .filter((name) => name.endsWith(".xml"))
    .forEach((name) => {
      const xml = zip.files[name].asText();
      const matches = xml.match(regex) ?? [];
      matches.forEach((m) => placeholders.add(m.slice(1, -1)));
    });

  if (placeholders.size === 0) {
    return badRequest(
      "No valid placeholders found. Ensure your DOCX uses {snake_case} tokens."
    );
  }

  return ok(Array.from(placeholders).sort());
}
