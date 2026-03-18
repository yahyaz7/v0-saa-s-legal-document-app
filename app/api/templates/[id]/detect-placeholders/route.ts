import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";
import PizZip from "pizzip";

type DetectedItem =
  | { type: "heading"; value: string }
  | { type: "placeholder"; value: string };

type DetectResult = {
  items: DetectedItem[];
  suggested_heading: string | null;
};

// POST /api/templates/[id]/detect-placeholders
// Admin / super_admin only.
// Downloads the template DOCX, extracts the document title / form heading,
// section headings, and {snake_case} placeholders in document order.
// Body (optional): { versionId: string }
// Returns { data: DetectResult }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return forbidden();

  const body = await request.json().catch(() => ({}));
  const versionId: string | undefined = body.versionId;

  const db = createAdminClient();

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

  const { data: blob, error: downloadError } = await db.storage
    .from("docx-templates")
    .download(version.docx_template_path);

  if (downloadError || !blob) {
    return err(`Failed to download template: ${downloadError?.message ?? "unknown"}`);
  }

  const content = await blob.arrayBuffer();
  const zip = new PizZip(content);

  // Regex constants
  const PARA_RE = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const TEXT_RE = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const PH_RE = /\{[a-z][a-z0-9_]*\}/g;
  // Matches Word paragraph styles used for document title or section headings
  const TITLE_STYLE_RE = /<w:pStyle[^>]+w:val="Title"/;
  const HEADING_STYLE_RE = /<w:pStyle[^>]+w:val="[Hh]eading\d"/;

  /** Concatenate all text runs within a paragraph element. */
  function paraText(para: string): string {
    let text = "";
    const re = new RegExp(TEXT_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(para)) !== null) text += m[1];
    return text;
  }

  /**
   * Heuristic: a paragraph looks like a document title if it has no placeholders,
   * its trimmed text is non-empty, entirely uppercase, and at most 120 characters.
   */
  function looksLikeTitle(text: string): boolean {
    const t = text.trim();
    return (
      t.length > 0 &&
      t.length <= 120 &&
      t === t.toUpperCase() &&
      /[A-Z]/.test(t) &&
      !PH_RE.test(t)
    );
  }

  const items: DetectedItem[] = [];
  const seen = new Set<string>();
  let suggestedHeading: string | null = null;

  function scanXml(xml: string, includeHeadings: boolean) {
    const paragraphs = xml.match(PARA_RE) ?? [xml];
    for (const para of paragraphs) {
      const text = paraText(para).trim();
      if (!text) continue;

      // Document title detection (Title style or all-caps heuristic)
      if (!suggestedHeading) {
        if (TITLE_STYLE_RE.test(para) || (!HEADING_STYLE_RE.test(para) && looksLikeTitle(text))) {
          suggestedHeading = text;
          continue; // title is not rendered as a section heading — skip to next para
        }
      }

      // Section heading detection
      if (includeHeadings && HEADING_STYLE_RE.test(para)) {
        items.push({ type: "heading", value: text });
      }

      // Placeholder detection
      const phs = text.match(PH_RE) ?? [];
      for (const token of phs) {
        const name = token.slice(1, -1);
        if (!seen.has(name)) {
          seen.add(name);
          items.push({ type: "placeholder", value: name });
        }
      }
    }
  }

  // Process main document body first (preserves reading order + includes headings)
  const mainDocName = Object.keys(zip.files).find((n) => n === "word/document.xml");
  if (mainDocName) {
    try {
      scanXml(zip.files[mainDocName].asText(), true);
    } catch {
      // fall through to general scan
    }
  }

  // Process remaining XML for any additional placeholders (headers, footers, tables)
  Object.keys(zip.files)
    .filter((n) => n.endsWith(".xml") && !n.includes("_rels") && n !== "word/document.xml")
    .forEach((name) => {
      let xml: string;
      try {
        xml = zip.files[name].asText();
      } catch {
        return;
      }
      scanXml(xml, false);
    });

  const placeholderCount = items.filter((i) => i.type === "placeholder").length;

  if (placeholderCount === 0) {
    return badRequest(
      "No placeholders detected. Make sure your DOCX uses {snake_case} tokens (e.g. {client_name}). " +
      "If placeholders are present, try re-typing them in Word to avoid hidden formatting splits."
    );
  }

  return ok<DetectResult>({ items, suggested_heading: suggestedHeading });
}
