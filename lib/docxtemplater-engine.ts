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
// Also covers digit-leading names like {2nd_tel_no}
const PLACEHOLDER_RE = /\{[#/]?[a-zA-Z0-9][a-zA-Z0-9_]*\}/g;

function fixParagraph(para: string): string {
  // Strip proofErr elements before processing — they sit between runs but carry no text
  // and can prevent the run-merger from seeing adjacent runs as contiguous
  para = para.replace(/<w:proofErr[^>]*\/>/g, "").replace(/<w:proofErr[^>]*>[\s\S]*?<\/w:proofErr>/g, "");
  // Strip bookmarkStart/bookmarkEnd — they also interrupt run sequences
  para = para.replace(/<w:bookmarkStart[^>]*\/>/g, "").replace(/<w:bookmarkEnd[^>]*\/>/g, "");

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

/**
 * Fix placeholders that are split across table cell (<w:tc>) boundaries.
 * This can happen when Word wraps a placeholder across adjacent cells in the same row.
 * Strategy: scan every <w:tr> row; concatenate text from all cells; detect cross-cell tokens;
 * find which cells the token spans and merge those cells' text into a single run in the first cell.
 * This is a best-effort scan — we only rewrite if we find a clear split.
 */
function fixCrossCellPlaceholders(xml: string): string {
  // Find every table row
  return xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
    // Collect cells with their text
    const cellRe = /(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g;
    const cells: Array<{ prefix: string; content: string; suffix: string; text: string }> = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(row)) !== null) {
      let text = "";
      const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRe.exec(cm[2])) !== null) text += tm[1];
      cells.push({ prefix: cm[1], content: cm[2], suffix: cm[3], text });
    }
    if (cells.length < 2) return row;

    const fullText = cells.map((c) => c.text).join("");
    const phRe = new RegExp(PLACEHOLDER_RE.source, "g");
    let phMatch: RegExpExecArray | null;
    let modified = false;

    while ((phMatch = phRe.exec(fullText)) !== null) {
      const token = phMatch[0];
      const phStart = phMatch.index;
      const phEnd = phStart + token.length;

      // Determine which cells the token spans
      let charPos = 0;
      let startCell = -1;
      let endCell = -1;
      for (let i = 0; i < cells.length; i++) {
        const cStart = charPos;
        const cEnd = charPos + cells[i].text.length;
        if (startCell === -1 && cStart <= phStart && phStart < cEnd) startCell = i;
        if (cStart < phEnd && phEnd <= cEnd) endCell = i;
        charPos = cEnd;
      }

      if (startCell !== -1 && endCell !== -1 && startCell < endCell) {
        // The token spans multiple cells — inject the full token into the first cell's content
        // and clear the partial text from subsequent cells
        const tokenInFirst = cells[startCell].text.includes(token.slice(0, 1));
        // Replace all w:t in startCell content with a version that has the full token appended
        // Strategy: append a new merged run with just the full token into cell[startCell]
        // and strip the partial token text from cells[startCell+1..endCell]
        const partInFirst = cells[startCell].text.slice(cells[startCell].text.length - (phEnd - cells[startCell].text.length - phStart));
        // Simpler: add a standalone run `{token}` to first cell; remove partial from other cells
        if (!tokenInFirst) {
          cells[startCell].content += `<w:r><w:t xml:space="preserve">${token}</w:t></w:r>`;
        } else {
          cells[startCell].content = cells[startCell].content.replace(
            /<w:t[^>]*>([\s\S]*?)<\/w:t>/g,
            (wt, inner) => {
              if (inner.includes(token[0])) {
                // Replace the partial placeholder text with the full token
                const idx = inner.indexOf(token[0]);
                return wt.replace(inner, inner.slice(0, idx) + token + inner.slice(idx + inner.length - idx));
              }
              return wt;
            }
          );
        }
        // Remove partial token text from subsequent cells (cells startCell+1 to endCell)
        for (let i = startCell + 1; i <= endCell; i++) {
          cells[i].content = cells[i].content.replace(
            /<w:t[^>]*>([\s\S]*?)<\/w:t>/g,
            (wt, inner) => {
              // Strip any substring that looks like a partial placeholder fragment
              const cleaned = inner.replace(/[{}#/a-zA-Z0-9_]+/, "");
              return wt.replace(inner, cleaned);
            }
          );
        }
        modified = true;
      }
    }

    if (!modified) return row;

    // Reconstruct the row with modified cells
    let newRow = row;
    let idx = 0;
    newRow = newRow.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, () => {
      const c = cells[idx++];
      return c ? `${c.prefix}${c.content}${c.suffix}` : "";
    });
    return newRow;
  });
}

/** Pre-process all XML files in the ZIP to merge split-run placeholders and loop tags. */
function fixSplitPlaceholders(zip: PizZip): void {
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".xml") || zip.files[filename].dir) continue;
    try {
      const original = zip.files[filename].asText();
      // First fix within-paragraph splits
      let fixed = original.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, fixParagraph);
      // Then fix cross-cell splits in tables
      fixed = fixCrossCellPlaceholders(fixed);
      if (fixed !== original) zip.file(filename, fixed);
    } catch {
      // Binary or unreadable entry — skip silently
    }
  }
}

/**
 * After rendering, find every <w:r> whose <w:t> contains a checkbox character (☑ or ☐)
 * and replace its font with "Segoe UI Symbol" which covers U+2610/U+2611.
 * Also bumps the font size to 14pt (28 half-points) so the box is clearly visible.
 */
function fixCheckboxFont(zip: PizZip): void {
  const CHECKBOX_RE = /[\u2610\u2611]/;
  const FONT = "Segoe UI Symbol";
  const SIZE = "28"; // 14pt in half-points

  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".xml") || zip.files[filename].dir) continue;
    try {
      const original = zip.files[filename].asText();
      if (!CHECKBOX_RE.test(original)) continue;

      // Replace every <w:r>…</w:r> whose text contains a checkbox char
      const fixed = original.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => {
        // Extract text content
        let text = "";
        const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        let tm: RegExpExecArray | null;
        while ((tm = tRe.exec(run)) !== null) text += tm[1];
        if (!CHECKBOX_RE.test(text)) return run;

        // Build a replacement rPr with Segoe UI Symbol font + size
        const existingRpr = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
        // Strip existing font and size declarations, inject ours
        let innerRpr = existingRpr
          ? existingRpr[1]
              .replace(/<w:rFonts[^\/]*\/>/g, "")
              .replace(/<w:sz[^\/]*\/>/g, "")
              .replace(/<w:szCs[^\/]*\/>/g, "")
          : "";
        const newRpr =
          `<w:rPr>` +
          `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>` +
          `<w:sz w:val="${SIZE}"/><w:szCs w:val="${SIZE}"/>` +
          innerRpr +
          `</w:rPr>`;

        // Replace rPr in the run (or prepend if missing)
        if (existingRpr) {
          return run.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, newRpr);
        } else {
          // Insert rPr right after <w:r ...>
          return run.replace(/^(<w:r(?:\s[^>]*)?>)/, `$1${newRpr}`);
        }
      });

      if (fixed !== original) zip.file(filename, fixed);
    } catch {
      // skip
    }
  }
}

/**
 * Fix structural loop tag problems in the document XML before docxtemplater parses it:
 *
 * 1. Mismatched close tags  — e.g. {/witnessees} where the open was {#witnesses}.
 *    Strategy: scan for every close tag; if its name doesn't match the current open
 *    stack top, check whether it's a typo of the open tag (shares ≥70% prefix) and
 *    rewrite it to the correct name.
 *
 * 2. Orphaned open tags — {#loop} that has no matching close tag at all.
 *    Strategy: after scanning, any open tag still on the stack is unclosed.
 *    Remove it from the XML entirely so docxtemplater doesn't choke.
 *
 * 3. Spaces inside {placeholder} tokens — e.g. { travel _time_2}.
 *    Normalised in ALL XML files (headers, footers, and main doc).
 */
function fixLoopTags(zip: PizZip): void {
  // ── 3. Strip spaces inside { … } tokens in ALL XML files ───────────────────
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith(".xml") || zip.files[filename].dir) continue;
    try {
      const original = zip.files[filename].asText();
      const normalised = original.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, (wt) =>
        wt.replace(/\{([^}]+)\}/g, (_, inner) => `{${inner.replace(/\s+/g, "")}}`)
      );
      if (normalised !== original) zip.file(filename, normalised);
    } catch { /* skip */ }
  }

  // ── 1 & 2. Fix loop open/close mismatches and remove orphans (main doc only) ─
  const mainDoc = Object.keys(zip.files).find((n) => n === "word/document.xml");
  if (!mainDoc) return;

  try {
    let xml = zip.files[mainDoc].asText();

    // ── 1 & 2. Fix loop open/close mismatches and remove orphans ──────────────
    // Collect all loop control tags with their positions in the XML
    const tagRe = /\{(#|\/)([a-zA-Z][a-zA-Z0-9_]*)\}/g;
    type TagInfo = { index: number; end: number; kind: "#" | "/"; name: string };
    const tags: TagInfo[] = [];
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(xml)) !== null) {
      tags.push({ index: m.index, end: m.index + m[0].length, kind: m[1] as "#" | "/", name: m[2] });
    }

    // Walk the tag list, maintaining an open-stack, collecting rewrites
    const rewrites: Array<{ index: number; end: number; replacement: string }> = [];
    const stack: TagInfo[] = [];
    const orphanOpens = new Set<number>(); // indices of open tags that are never closed

    for (const tag of tags) {
      if (tag.kind === "#") {
        stack.push(tag);
      } else {
        // Close tag
        if (stack.length === 0) {
          // Stray close with nothing open — remove it
          rewrites.push({ index: tag.index, end: tag.end, replacement: "" });
          continue;
        }
        const top = stack[stack.length - 1];
        if (top.name === tag.name) {
          // Perfect match
          stack.pop();
        } else {
          // Mismatch — check if it's a typo of the open tag
          const openName = top.name;
          const closeName = tag.name;
          const prefix = openName.slice(0, Math.max(4, Math.floor(openName.length * 0.7)));
          if (closeName.toLowerCase().startsWith(prefix.toLowerCase())) {
            // Typo — rewrite close tag to match open
            rewrites.push({ index: tag.index, end: tag.end, replacement: `{/${openName}}` });
            stack.pop();
          } else {
            // Unrelated close — remove it to avoid parse failure
            rewrites.push({ index: tag.index, end: tag.end, replacement: "" });
          }
        }
      }
    }

    // Everything still on the stack is an unclosed open tag — remove them
    for (const open of stack) {
      orphanOpens.add(open.index);
    }
    for (const tag of tags) {
      if (tag.kind === "#" && orphanOpens.has(tag.index)) {
        rewrites.push({ index: tag.index, end: tag.end, replacement: "" });
      }
    }

    // Apply rewrites right-to-left so offsets stay valid
    if (rewrites.length > 0) {
      rewrites.sort((a, b) => b.index - a.index);
      for (const { index, end, replacement } of rewrites) {
        xml = xml.slice(0, index) + replacement + xml.slice(end);
      }
    }

    zip.file(mainDoc, xml);
  } catch {
    // If anything goes wrong, leave the zip unchanged
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
  // Match plain placeholders (no # or /) — includes digit-leading names like {2nd_tel_no}
  const re = /\{([a-zA-Z0-9][a-zA-Z0-9_]*)\}/g;
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
  if (Array.isArray(val)) return val.map(String).join("\n");
  return String(val);
}

// Unicode checkbox characters — render correctly in Word without any special font
const CHECKED_BOX   = "\u2611"; // ☑
const UNCHECKED_BOX = "\u2610"; // ☐

/** Sanitise a scalar (non-array) form value to a safe string. */
function sanitiseScalar(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? CHECKED_BOX : UNCHECKED_BOX;
  // String "true"/"false" from JSON-serialised drafts
  if (val === "true")  return CHECKED_BOX;
  if (val === "false") return UNCHECKED_BOX;
  if (Array.isArray(val)) return val.map(String).join("\n");
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
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
      // object[] → repeater field
      arrays[key] = sanitiseRepeater(val);
    } else if (Array.isArray(val)) {
      // string[] (or empty []) → offence_search standalone field → join as scalar
      scalars[key] = sanitiseScalar(val);
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

  // ── 3. Merge split-run placeholders first, then fix loop tag typos/orphans ───
  fixSplitPlaceholders(zip);
  fixLoopTags(zip);

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
      // Broadened to include digit-leading sub-fields like {2nd_tel_no}
      const subRe = /\{([a-zA-Z0-9][a-zA-Z0-9_]*)\}/g;
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

  // ── 8. Fix font on checkbox character runs ──────────────────────────────────
  // ☑ (U+2611) and ☐ (U+2610) are not in Times New Roman / Calibri.
  // Find every <w:t> containing them and set the run's font to Segoe UI Symbol,
  // which ships with Windows and fully covers these code points.
  fixCheckboxFont(doc.getZip());

  // ── 9. Produce output buffer ────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch {
    throw new Error("Failed to produce the final DOCX file.");
  }

  return { buffer, unmatched };
}
