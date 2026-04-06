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
  // Allow uppercase letters and digit-leading names (e.g. {arrest_VA}, {2nd_tel_no})
  const PH_RE            = /\{([a-zA-Z0-9][a-zA-Z0-9_]*)\}/g;   // {scalar}
  const LOOP_OPEN_RE     = /\{#([a-zA-Z][a-zA-Z0-9_]*)\}/g;      // {#loop}
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
   * Normalize spaces inside {placeholder} tokens so that Word-inserted space runs
   * like "{ travel _time_2}" become "{travel_time_2}".
   */
  function normalizePlaceholders(text: string): string {
    return text.replace(/\{([^}]+)\}/g, (_, inner) => `{${inner.replace(/\s+/g, "")}}`);
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
    // Normalize spaces inside placeholders first
    const rawText = fullDocText(xml);
    const text = normalizePlaceholders(rawText);
    const result = new Map<string, string[]>();

    // Strategy: find every {#loopName} open tag, then scan forward for the matching
    // close tag {/loopName}. To handle typos in close tags (e.g. {/witnessees} instead
    // of {/witnesses}), we also accept a close tag whose name starts with the loop name
    // prefix OR shares ≥ 70% character similarity.
    const openRe = /\{#([a-zA-Z][a-zA-Z0-9_]*)\}/g;
    let openMatch: RegExpExecArray | null;

    while ((openMatch = openRe.exec(text)) !== null) {
      const loopName = openMatch[1];
      const contentStart = openMatch.index + openMatch[0].length;

      // Find close tag: exact match first, then fuzzy (typo-tolerant)
      const exactClose = new RegExp(`\\{\\/${loopName}\\}`, "g");
      exactClose.lastIndex = contentStart;
      let closeMatch = exactClose.exec(text);
      let contentEnd = closeMatch ? closeMatch.index : -1;

      if (contentEnd === -1) {
        // Fuzzy: find any {/xxx} where xxx starts with loopName[0..4] (common prefix)
        const prefix = loopName.slice(0, Math.max(4, Math.floor(loopName.length * 0.7)));
        const fuzzyClose = new RegExp(`\\{\\/([a-zA-Z][a-zA-Z0-9_]*)\\}`, "g");
        fuzzyClose.lastIndex = contentStart;
        let fm: RegExpExecArray | null;
        while ((fm = fuzzyClose.exec(text)) !== null) {
          const closeName = fm[1];
          // Accept if close name starts with the same prefix as loop name
          if (closeName.toLowerCase().startsWith(prefix.toLowerCase())) {
            contentEnd = fm.index;
            break;
          }
        }
      }

      // If still no close, take up to 2000 chars as the loop content (best-effort)
      const loopContent = contentEnd !== -1
        ? text.slice(contentStart, contentEnd)
        : text.slice(contentStart, contentStart + 2000);

      const subFields: string[] = [];
      const subRe = /\{([a-zA-Z0-9][a-zA-Z0-9_]*)\}/g;
      let subMatch: RegExpExecArray | null;
      while ((subMatch = subRe.exec(loopContent)) !== null) {
        const sf = subMatch[1];
        if (!sf.startsWith("#") && !sf.startsWith("/") && !subFields.includes(sf)) {
          subFields.push(sf);
        }
      }

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
      // Normalize spaces inside {placeholder} tokens before any matching
      const text = normalizePlaceholders(paraText(para).trim());
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
          const subFields = loopSubFieldMap.get(loopName) ?? [];
          items.push({ type: "repeater", value: loopName, subFields });
        }
      }

      // Scalar placeholder detection — skip loop control tags and loop sub-fields
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
