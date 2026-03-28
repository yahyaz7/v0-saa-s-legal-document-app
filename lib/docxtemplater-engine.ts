import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// ── Split-placeholder fixer ────────────────────────────────────────────────────
//
// Microsoft Word frequently splits a {placeholder} token across multiple <w:r>
// (run) elements within the same paragraph.  For example {client_name} might be
// stored as three consecutive runs: `{client` | `_name` | `}`.
// docxtemplater works on raw XML and silently skips any placeholder whose opening
// { and closing } live in different runs.
//
// Strategy (per paragraph):
//   1. Extract every <w:r> run with its text and its position in the XML string.
//   2. Build the concatenated paragraph text and search for {placeholder} tokens
//      (case-insensitive so {Venue} and {venue} are both caught).
//   3. For every token that spans more than one run, replace those runs in the
//      XML with a single merged <w:r> (first run's <w:rPr> + combined text).
//   4. Apply merges right-to-left so earlier string positions stay valid.

/** Concatenate all <w:t> text content from a single <w:r> XML string. */
function getRunText(runXml: string): string {
  let text = "";
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runXml)) !== null) text += m[1];
  return text;
}

type Run = {
  xml: string;        // full <w:r>…</w:r> source
  rPr: string;        // <w:rPr>…</w:rPr> or ""
  text: string;       // XML-escaped text content (safe to re-embed as-is)
  start: number;      // byte offset in the paragraph string
  end: number;        // byte offset after the last char of this run in para
  charStart: number;  // offset in the concatenated paragraph text
};

// Matches any {Placeholder_Name} or {#loopName} or {/loopName} — captures loop tags too
const PLACEHOLDER_RE = /\{[#/]?[a-zA-Z][a-zA-Z0-9_]*\}/g;

function fixParagraph(para: string): string {
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  const runs: Run[] = [];
  let charPos = 0;
  let m: RegExpExecArray | null;

  runRegex.lastIndex = 0;
  while ((m = runRegex.exec(para)) !== null) {
    const xml = m[0];
    const text = getRunText(xml);
    const rPr = xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    runs.push({
      xml,
      rPr,
      text,
      start: m.index,
      end: m.index + xml.length,
      charStart: charPos,
    });
    charPos += text.length;
  }

  if (runs.length <= 1) return para;

  const fullText = runs.map((r) => r.text).join("");

  // Find placeholder/loop tokens that span more than one run
  const mergeRanges: Array<[number, number]> = [];
  const phRe = new RegExp(PLACEHOLDER_RE.source, "g");

  let phM: RegExpExecArray | null;
  while ((phM = phRe.exec(fullText)) !== null) {
    const phStart = phM.index;
    const phEnd = phStart + phM[0].length;

    let startRun = -1;
    let endRun = -1;
    for (let i = 0; i < runs.length; i++) {
      const rEnd = runs[i].charStart + runs[i].text.length;
      if (startRun === -1 && runs[i].charStart <= phStart && phStart < rEnd) startRun = i;
      if (runs[i].charStart < phEnd && phEnd <= rEnd) endRun = i;
    }

    if (startRun !== -1 && endRun !== -1 && startRun < endRun) {
      mergeRanges.push([startRun, endRun]);
    }
  }

  if (mergeRanges.length === 0) return para;

  // Merge overlapping/adjacent ranges
  mergeRanges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[mergeRanges[0][0], mergeRanges[0][1]]];
  for (let i = 1; i < mergeRanges.length; i++) {
    const last = merged[merged.length - 1];
    if (mergeRanges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], mergeRanges[i][1]);
    } else {
      merged.push([mergeRanges[i][0], mergeRanges[i][1]]);
    }
  }

  // Apply right-to-left so earlier string offsets stay valid
  let result = para;
  for (const [s, e] of [...merged].reverse()) {
    const combinedText = runs.slice(s, e + 1).map((r) => r.text).join("");
    const rPr = runs[s].rPr;
    const mergedRun = `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
    result = result.slice(0, runs[s].start) + mergedRun + result.slice(runs[e].end);
  }

  return result;
}

/** Pre-process all XML files in the ZIP to merge split-run placeholders and loop tags. */
function fixSplitPlaceholders(zip: PizZip): void {
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".xml") || zip.files[filename].dir) continue;
    try {
      const original = zip.files[filename].asText();
      const fixed = original.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, fixParagraph);
      if (fixed !== original) zip.file(filename, fixed);
    } catch {
      // Binary or unreadable entry — skip silently
    }
  }
}

// ── Normalised key matching ────────────────────────────────────────────────────

/** Strip non-alphanumeric characters and lowercase — used for fuzzy key matching. */
function normalise(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Scan all XML files in the fixed ZIP and return every {placeholder} name found.
 * Excludes loop control tags (#loopName / /loopName).
 */
function extractPlaceholders(zip: PizZip): Set<string> {
  const found = new Set<string>();
  // Only match plain placeholders (no # or /) — loop keys are not scalar placeholders
  const re = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".xml") || zip.files[filename].dir) continue;
    try {
      const xml = zip.files[filename].asText();
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(xml)) !== null) {
        found.add(m[1]); // capture group — without { and }
      }
    } catch {
      // skip
    }
  }
  return found;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type GenerateResult = {
  buffer: Buffer;
  /** Scalar placeholder names found in the template that had no matching form value. */
  unmatched: string[];
};

/** A single row inside a repeater field. Every column value must be a string. */
export type RepeaterRow = Record<string, string>;

/** Sanitise one cell value inside a repeater row. */
function sanitiseCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

/** Sanitise a scalar (non-array) form value to a safe string. */
function sanitiseScalar(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

/** Sanitise a repeater array — each element becomes a RepeaterRow. */
function sanitiseRepeater(arr: unknown[]): RepeaterRow[] {
  return arr.map((row) => {
    if (typeof row !== "object" || row === null) return {};
    const out: RepeaterRow = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = sanitiseCell(v);
    }
    return out;
  });
}

/**
 * Universal DOCX generator using docxtemplater.
 *
 * Handles:
 *  - null / undefined scalar values   → replaced with ""
 *  - boolean values                   → "Yes" / "No"
 *  - split-run {placeholders}         → XML runs merged before rendering
 *  - split-run {#loop}/{/loop} tags   → same merge fix applied
 *  - case / separator mismatches      → {FeeEarner} fills from key "fee_earner"
 *  - array (repeater) values          → passed as-is for {#key}…{/key} loop expansion
 *  - unknown scalar placeholders      → silently blanked (nullGetter)
 *  - malformed DOCX / render errors   → re-thrown with a clear message
 *
 * Returns { buffer, unmatched } so callers can surface diagnostic info to users.
 */
export async function generateFromTemplate(
  templateBuffer: ArrayBuffer | Buffer,
  data: Record<string, unknown>
): Promise<GenerateResult> {

  // ── 1. Separate arrays (repeater fields) from scalars ───────────────────────
  const scalars: Record<string, string> = {};
  const arrays: Record<string, RepeaterRow[]> = {};

  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      arrays[key] = sanitiseRepeater(val);
    } else {
      scalars[key] = sanitiseScalar(val);
    }
  }

  // ── 2. Parse ZIP ────────────────────────────────────────────────────────────
  let zip: PizZip;
  try {
    zip = new PizZip(templateBuffer);
  } catch {
    throw new Error("The template file is corrupted or not a valid DOCX.");
  }

  // ── 3. Fix split-run placeholders (scalars) and loop tags ──────────────────
  fixSplitPlaceholders(zip);

  // ── 4. Build scalar lookup with normalised key matching ────────────────────
  //       Allows {FeeEarner} to be filled by form key "fee_earner", etc.
  const normLookup: Record<string, string> = {};
  for (const [key, val] of Object.entries(scalars)) {
    normLookup[normalise(key)] = val;
  }

  const templatePlaceholders = extractPlaceholders(zip);
  const augmentedScalars: Record<string, string> = { ...scalars };

  // Build a set of all sub-field key names from every populated repeater array,
  // and also from {#loop}...{/loop} regions in the XML for empty arrays.
  // These are loop-scoped variables and must never be treated as top-level scalars.
  const repeaterSubFieldNames = new Set<string>();
  for (const rows of Object.values(arrays)) {
    for (const row of rows) {
      for (const key of Object.keys(row)) repeaterSubFieldNames.add(key);
    }
  }
  try {
    const docXml = zip.files["word/document.xml"]?.asText() ?? "";
    const loopRe = /\{#([a-zA-Z][a-zA-Z0-9_]*)\}([\s\S]*?)\{\/\1\}/g;
    let lm: RegExpExecArray | null;
    while ((lm = loopRe.exec(docXml)) !== null) {
      const subRe = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
      let sm: RegExpExecArray | null;
      while ((sm = subRe.exec(lm[2])) !== null) repeaterSubFieldNames.add(sm[1]);
    }
  } catch { /* ignore */ }

  for (const ph of templatePlaceholders) {
    if (ph in augmentedScalars) continue;
    if (ph in arrays) continue;
    if (repeaterSubFieldNames.has(ph)) continue; // loop sub-variable — skip
    const norm = normalise(ph);
    if (norm in normLookup) augmentedScalars[ph] = normLookup[norm];
  }

  // ── 5. Identify unmatched scalar placeholders ──────────────────────────────
  //       Loop sub-variables (offence, type, outcome inside {#offences}) are
  //       scoped to their row — exclude them from the top-level unmatched list.
  const unmatched = [...templatePlaceholders].filter(
    (ph) =>
      !(ph in augmentedScalars) &&
      !(ph in arrays) &&
      !repeaterSubFieldNames.has(ph)
  );
  if (unmatched.length > 0) {
    console.warn("[generate-docx] Unmatched placeholders:", unmatched);
  }

  // Blank out unmatched scalars so docxtemplater doesn't throw on missing keys
  for (const ph of unmatched) {
    augmentedScalars[ph] = "";
  }

  const unused = Object.keys(scalars).filter(
    (k) =>
      ![...templatePlaceholders].some(
        (ph) => ph === k || normalise(ph) === normalise(k)
      ) && !(k in arrays)
  );
  if (unused.length > 0) {
    console.info("[generate-docx] Unused form keys:", unused);
  }

  // ── 6. Merge scalars and arrays into one render data object ─────────────────
  //       docxtemplater receives: { scalar_key: "value", repeater_key: [{…}, …] }
  const renderData: Record<string, string | RepeaterRow[]> = {
    ...augmentedScalars,
    ...arrays,
  };

  // ── 7. Render ───────────────────────────────────────────────────────────────
  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // nullGetter returns "" for any tag that resolves to null/undefined,
      // including nested tags inside repeater rows.
      nullGetter(part: any) {
        if (!part.module) return ""; // plain scalar tag with no value
        if (part.module === "rawxml") return "";
        return ""; // loop-related or unknown module
      },
    });
  } catch {
    throw new Error("Failed to parse the DOCX template structure.");
  }

  try {
    doc.render(renderData);
  } catch (renderErr: any) {
    const message =
      renderErr?.properties?.errors?.map((e: any) => e.message).join("; ") ??
      renderErr?.message ??
      "Unknown render error";
    throw new Error(`DOCX generation failed: ${message}`);
  }

  // ── 8. Produce output buffer ────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch {
    throw new Error("Failed to produce the final DOCX file.");
  }

  return { buffer, unmatched };
}
