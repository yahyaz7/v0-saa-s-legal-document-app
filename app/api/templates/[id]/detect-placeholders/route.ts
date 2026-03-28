import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/response";
import PizZip from "pizzip";

type DetectedItem =
  | { type: "heading"; value: string }
  | { type: "placeholder"; value: string }
  /** Repeater detected from {#loopName} tag. subFields = variables found inside the loop block. */
  | { type: "repeater"; value: string; subFields: string[] };

type DetectResult = {
  items: DetectedItem[];
  suggested_heading: string | null;
};

// POST /api/templates/[id]/detect-placeholders
// Admin / super_admin only.
// Downloads the template DOCX and extracts:
//   - Document title / form heading
//   - Section headings (Word Heading style)
//   - {scalar} placeholders
//   - {#loopName} repeater groups + their sub-field variables
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

  // ── Regex constants ──────────────────────────────────────────────────────────
  const PARA_RE          = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const TEXT_RE          = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const PH_RE            = /\{([a-z][a-z0-9_]*)\}/g;     // {scalar}
  const LOOP_OPEN_RE     = /\{#([a-z][a-z0-9_]*)\}/g;    // {#loop}
  const TITLE_STYLE_RE   = /<w:pStyle[^>]+w:val="Title"/;
  const HEADING_STYLE_RE = /<w:pStyle[^>]+w:val="[Hh]eading\d"/;

  /** Concatenate all <w:t> text runs within a paragraph element. */
  function paraText(paraXml: string): string {
    let text = "";
    const re = new RegExp(TEXT_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(paraXml)) !== null) text += m[1];
    return text;
  }

  /**
   * Concatenate ALL <w:t> text content from an XML file into one flat string.
   * Used for loop-region scanning where content is spread across table cells.
   */
  function fullDocText(xml: string): string {
    let text = "";
    const re = new RegExp(TEXT_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) text += m[1];
    return text;
  }

  /**
   * Scan full document text for {#loopName}…{/loopName} regions.
   * Returns a map of loopName → ordered list of unique sub-field variable names.
   */
  function extractLoopSubFields(xml: string): Map<string, string[]> {
    const text = fullDocText(xml);
    const result = new Map<string, string[]>();

    // Match {#loopName}(content){/loopName} — non-greedy
    const loopRe = /\{#([a-z][a-z0-9_]*)\}([\s\S]*?)\{\/\1\}/g;
    let loopMatch: RegExpExecArray | null;

    while ((loopMatch = loopRe.exec(text)) !== null) {
      const loopName = loopMatch[1];
      const loopContent = loopMatch[2];

      const subFields: string[] = [];
      const subRe = /\{([a-z][a-z0-9_]*)\}/g;
      let subMatch: RegExpExecArray | null;

      while ((subMatch = subRe.exec(loopContent)) !== null) {
        if (!subFields.includes(subMatch[1])) {
          subFields.push(subMatch[1]);
        }
      }

      // Merge if the same loop name appears multiple times (e.g. open/close across docs)
      if (result.has(loopName)) {
        const existing = result.get(loopName)!;
        for (const sf of subFields) {
          if (!existing.includes(sf)) existing.push(sf);
        }
      } else {
        result.set(loopName, subFields);
      }
    }

    return result;
  }

  /** Heuristic: all-caps non-empty text ≤ 120 chars with no placeholders. */
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

  // ── Step 1: Extract loop sub-field maps from all XML files ─────────────────
  // Do this first so we know which variables are "owned" by a loop
  const loopSubFieldMap = new Map<string, string[]>(); // loopName → [sub, field, ...]

  const mainDocName = Object.keys(zip.files).find((n) => n === "word/document.xml");
  if (mainDocName) {
    try {
      const xml = zip.files[mainDocName].asText();
      for (const [k, v] of extractLoopSubFields(xml)) {
        loopSubFieldMap.set(k, v);
      }
    } catch { /* ignore */ }
  }

  // Collect all loop sub-field names into a flat set for exclusion from scalar scan
  const allSubFieldNames = new Set<string>();
  for (const sfs of loopSubFieldMap.values()) {
    for (const sf of sfs) allSubFieldNames.add(sf);
  }

  // ── Step 2: Paragraph-level scan for headings, scalars, and loop open tags ──
  const items: DetectedItem[] = [];
  const seenScalars   = new Set<string>();
  const seenRepeaters = new Set<string>();
  let suggestedHeading: string | null = null;

  function scanXml(xml: string, includeHeadings: boolean) {
    const paragraphs = xml.match(PARA_RE) ?? [xml];
    for (const para of paragraphs) {
      const text = paraText(para).trim();
      if (!text) continue;

      // Document title detection
      if (!suggestedHeading) {
        if (TITLE_STYLE_RE.test(para) || (!HEADING_STYLE_RE.test(para) && looksLikeTitle(text))) {
          suggestedHeading = text;
          continue;
        }
      }

      // Section heading detection
      if (includeHeadings && HEADING_STYLE_RE.test(para)) {
        items.push({ type: "heading", value: text });
      }

      // Repeater loop open tag: {#loopName}
      const loopRe = new RegExp(LOOP_OPEN_RE.source, "g");
      let loopMatch: RegExpExecArray | null;
      while ((loopMatch = loopRe.exec(text)) !== null) {
        const loopName = loopMatch[1];
        if (!seenRepeaters.has(loopName)) {
          seenRepeaters.add(loopName);
          // Attach the pre-extracted sub-fields (may be [] if loop spans multiple cells)
          const subFields = loopSubFieldMap.get(loopName) ?? [];
          items.push({ type: "repeater", value: loopName, subFields });
        }
      }

      // Scalar placeholder detection — skip if it's a loop sub-field
      const phRe = new RegExp(PH_RE.source, "g");
      let phMatch: RegExpExecArray | null;
      while ((phMatch = phRe.exec(text)) !== null) {
        const name = phMatch[1];
        if (!seenScalars.has(name) && !seenRepeaters.has(name) && !allSubFieldNames.has(name)) {
          seenScalars.add(name);
          items.push({ type: "placeholder", value: name });
        }
      }
    }
  }

  // Scan main doc
  if (mainDocName) {
    try {
      scanXml(zip.files[mainDocName].asText(), true);
    } catch { /* fall through */ }
  }

  // Scan remaining XML (headers, footers, etc.)
  Object.keys(zip.files)
    .filter((n) => n.endsWith(".xml") && !n.includes("_rels") && n !== "word/document.xml")
    .forEach((name) => {
      try {
        scanXml(zip.files[name].asText(), false);
      } catch { /* skip */ }
    });

  const placeholderCount = items.filter(
    (i) => i.type === "placeholder" || i.type === "repeater"
  ).length;

  if (placeholderCount === 0) {
    return badRequest(
      "No placeholders detected. Make sure your DOCX uses {snake_case} tokens (e.g. {client_name}) " +
      "and {#loopName}/{/loopName} for repeating rows. " +
      "If placeholders are present, try re-typing them in Word to avoid hidden formatting splits."
    );
  }

  return ok<DetectResult>({ items, suggested_heading: suggestedHeading });
}
