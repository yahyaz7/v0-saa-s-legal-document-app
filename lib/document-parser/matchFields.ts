/**
 * Document text extraction utilities.
 *
 * This module provides:
 *   - extractKeyValuePairs()  — regex-based "Label: Value" extraction from raw OCR text
 *   - coerceValue()           — type-aware value normalisation (dates, addresses, etc.)
 *
 * Field matching is handled by the LLM via /api/llm-map.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export interface TemplateField {
  field_key: string;
  field_label: string;
  field_type: string;
}

// ── Text normalisation helpers ────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Lines that are pure decoration or all-caps section headings — skip them.
const SECTION_HEADER = /^[=\-*#]{3,}$|^\*{2,}|^[A-Z][A-Z\s\/\(\)]{8,}[^:]$/;

// ── Layout artifact correction ────────────────────────────────────────────────
// Known WY custody record section headings — used as stop markers.
const WY_SECTION_HEADINGS =
  /^(Solicitor info|Solicitor call|Offence disposals|Detentions|Rights|Property|Custody record|Detained Person|Arrest details|Arrest details\/offences|Official)\s*$/i;

/**
 * Fix layout artifacts produced when Document AI reads a multi-column
 * custody record table left-to-right.
 *
 * Handles three artifact classes:
 *   1. Split officer lines  (prefix / value / suffix on separate lines)
 *   2. Inverted ethnicity block (column headers then values then label suffixes)
 *   3. Split multi-word labels ("Time of\nauthorised\ndet.: value")
 *   4. WY offence table (Offence date | Status | Offence/Charge Summary)
 */
function fixDocumentAILayoutArtifacts(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    // ── Pattern 1: Split officer lines ───────────────────────────────────────
    if (/^(Arresting|Investigating|Escorting|Authorising det\.?|Authorising)\s*$/i.test(trimmed)) {
      const prefix = trimmed.replace(/[.:\s]+$/, "");
      let j = i + 1;
      while (j < lines.length && (!lines[j].trim() || /^[a-zA-Z]{1,4}$/.test(lines[j].trim()))) j++;

      const peek1 = lines[j]?.trim() ?? "";
      const peek2 = lines[j + 1]?.trim() ?? "";

      if (/^(officer|det)[.:\s]*$/i.test(peek1)) {
        const value = peek2;
        if (value) {
          out.push(`${prefix} ${peek1.replace(/[.:\s]+$/, "")}.: ${value}`);
          i = j + 2;
          continue;
        }
      } else if (peek1 && !/^(officer|det)[.:\s]*$/i.test(peek1)) {
        const suffix = peek2;
        if (/^(officer|det)[.:\s]*$/i.test(suffix)) {
          out.push(`${prefix} ${suffix.replace(/[.:\s]+$/, "")}.: ${peek1}`);
          i = j + 2;
          continue;
        }
      }
    }

    // ── Pattern 2: Inverted ethnicity block ───────────────────────────────────
    if (/^Officer.defined\s*$/i.test(trimmed)) {
      const j = i + 1;
      const selfDefined = lines[j]?.trim() ?? "";
      const val1 = lines[j + 1]?.trim() ?? "";
      const val2 = lines[j + 2]?.trim() ?? "";
      const suf1 = lines[j + 3]?.trim() ?? "";
      const suf2 = lines[j + 4]?.trim() ?? "";

      if (/^Self.defined\s*$/i.test(selfDefined) && suf1.toLowerCase().includes("ethnicity")) {
        out.push(`Officer-defined ethnicity: ${val1}`);
        out.push(`Self-defined ethnicity: ${val2}`);
        i = j + 5;
        if (/^ethnicity[.:\s]*$/i.test(suf2)) i++;
        continue;
      }
    }

    // ── Pattern 3: Split multi-word labels ────────────────────────────────────
    const SPLIT_LABEL_PREFIXES = [
      /^Time of\s*$/i, /^Circumstances\s*$/i, /^Date of\s*$/i,
      /^Place of\s*$/i, /^Time of authorised\s*$/i,
    ];
    if (SPLIT_LABEL_PREFIXES.some((re) => re.test(trimmed))) {
      let combined = trimmed;
      let j = i + 1;
      let joined = false;
      while (j < lines.length && j < i + 4) {
        const next = lines[j].trim();
        if (!next) { j++; continue; }
        combined = `${combined} ${next}`;
        j++;
        if (combined.includes(":")) { joined = true; break; }
      }
      if (joined) { out.push(combined); i = j; continue; }
    }

    // ── Pattern 4: WY offence table ──────────────────────────────────────────
    if (/^Offences?\s*$/i.test(trimmed)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;

      const h1 = lines[j]?.trim() ?? "";
      const h2 = lines[j + 1]?.trim() ?? "";
      const h3 = lines[j + 2]?.trim() ?? "";

      if (
        /^Offence\s+date\s*$/i.test(h1) &&
        /^Status\s*$/i.test(h2) &&
        /^Offence[\s\/]Charge\s+Summary\s*$/i.test(h3)
      ) {
        out.push(line);
        j += 3;

        while (j < lines.length) {
          while (j < lines.length && !lines[j].trim()) j++;
          const dateLine = lines[j]?.trim() ?? "";
          if (!dateLine || !/^\d{2}\/\d{2}\/\d{4}/.test(dateLine)) break;
          j++;

          while (j < lines.length && !lines[j].trim()) j++;
          const statusLine = lines[j]?.trim() ?? "";
          if (!statusLine || /^\d{2}\/\d{2}\/\d{4}/.test(statusLine) || WY_SECTION_HEADINGS.test(statusLine)) break;
          j++;

          while (j < lines.length && !lines[j].trim()) j++;
          let descLine = lines[j]?.trim() ?? "";
          if (!descLine || WY_SECTION_HEADINGS.test(descLine)) break;
          j++;

          while (j < lines.length) {
            const cont = lines[j]?.trim() ?? "";
            if (!cont) break;
            if (/^\d{2}\/\d{2}\/\d{4}/.test(cont) || WY_SECTION_HEADINGS.test(cont)) break;
            const colonIdx = cont.indexOf(":");
            if (colonIdx > 0 && colonIdx <= 40 && cont.slice(0, colonIdx).split(" ").length <= 6) break;
            descLine += " " + cont;
            j++;
          }

          out.push(`Offence date: ${dateLine}`);
          if (statusLine) out.push(`Offence status: ${statusLine}`);
          out.push(`Offence/Charge Summary: ${descLine.trim()}`);
        }

        i = j;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  return out.join("\n");
}

// ── Noise label filter ────────────────────────────────────────────────────────
// Document labels with no useful template mapping — discarded before LLM processing.
const NOISE_LABELS = new Set([
  "printed by", "print date", "computer", "page", "official", "date printed", "restricted",
  "loc auth", "force", "district", "npt code", "ward", "ward code", "loc", "auth", "npt", "yard",
  "sex", "gender", "self defined gender", "height", "weight", "build",
  "hair color", "eye color", "hair colour", "eye colour",
  "officer defined ethnicity", "self defined ethnicity",
  "nationality", "immigration status if foreign nat", "occupation",
  "school attending", "place of birth",
  "rights given", "rights given at", "codes of practice",
  "property", "signed time", "total cash held by police", "protection on",
  "status", "offence status",
  "occurrence #", "occurrence",
  "dp wants solicitor",
  "solicitor name", "solicitor",
  "escorting", "escorting officer",
  "title", "type of special group", "where arrested",
  "arresting force", "dp comment made when arrest account given",
  "dp comment made when authorised",
  "detention authorised", "detention authorised by",
  "nominated person", "email address",
]);

function isNewPair(line: string): boolean {
  const colonIdx = line.indexOf(":");
  if (colonIdx <= 0) return false;
  const before = line.slice(0, colonIdx).trim();
  if (colonIdx > 60 || before.length === 0 || /^\d/.test(before) || before.split(" ").length > 8) return false;
  if (/\(/.test(before)) return false;
  return true;
}

function isBareValue(line: string): boolean {
  const ci = line.indexOf(":");
  if (ci === -1) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(line.trim())) return true;
  if (/\([^)]*:/.test(line)) return true;
  return false;
}

// Labels that repeat across multiple arrest blocks — all values collected and joined with " | ".
const REPEATABLE_LABELS = new Set([
  "arrest time", "arrest date time", "reason", "circumstances of arrest",
  "arresting officer", "investigating officer", "authorising det officer",
  "authorising", "escorting officer", "as number",
]);

/**
 * Extract "Label: Value" pairs from raw OCR text.
 * Handles multi-line values, repeated labels, and OCR noise.
 */
export function extractKeyValuePairs(
  text: string
): Array<{ label: string; value: string }> {
  const fixed = fixDocumentAILayoutArtifacts(text);
  const lines = fixed.split("\n").map((l) => l.trim()).filter(Boolean);
  const pairs: Array<{ label: string; value: string }> = [];
  const seenOnce = new Set<string>();
  const repeatableValues = new Map<string, string[]>();
  const OCR_GARBAGE = /^(CS CamScanner|CamScanner|_+|-+|DA|RO|ale\s+cop|VAL|things|[a-zA-Z]{1,3})$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_HEADER.test(line)) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0 && OCR_GARBAGE.test(line.trim())) continue;
    if (colonIdx <= 0) continue;

    const rawLabel = line.slice(0, colonIdx).trim();
    let rawValue = line.slice(colonIdx + 1).trim();

    if (rawLabel.length > 80 || /^\d/.test(rawLabel)) continue;
    if (rawLabel.split(" ").length > 10) continue;

    let j = i + 1;

    if (!rawValue) {
      while (j < lines.length && (!lines[j].trim() || OCR_GARBAGE.test(lines[j].trim()))) j++;
      if (j < lines.length) {
        const firstVal = lines[j].trim();
        if (isNewPair(firstVal)) continue;
        rawValue = firstVal.replace(/\s*\([A-Z]\)\s*$/, "").trim();
        j++;
        while (j < lines.length) {
          const next = lines[j].trim();
          if (!next || SECTION_HEADER.test(next) || OCR_GARBAGE.test(next)) break;
          if (isNewPair(next)) break;
          if (rawValue && isBareValue(next) && next.split(" ").length <= 5) break;
          rawValue += " " + next;
          j++;
        }
      }
    } else {
      rawValue = rawValue.replace(/\s*\([A-Z]\)\s*$/, "").trim();
      while (j < lines.length) {
        const next = lines[j].trim();
        if (!next || SECTION_HEADER.test(next) || OCR_GARBAGE.test(next)) break;
        if (isNewPair(next)) break;
        if (isBareValue(next) && next.split(" ").length <= 5) break;
        rawValue += " " + next;
        j++;
      }
    }

    rawValue = rawValue.trim();
    if (!rawValue) continue;

    const labelNorm = norm(rawLabel);
    if (NOISE_LABELS.has(labelNorm)) continue;

    const alphaRatio = (rawLabel.match(/[a-zA-Z]/g)?.length ?? 0) / rawLabel.length;
    if (rawLabel.length > 3 && alphaRatio < 0.5) continue;

    rawValue = rawValue.replace(/^[\s~\-|@#*©]+/, "").trim();
    if (!rawValue || /^[|\-~©\s]{0,3}$/.test(rawValue)) continue;

    if (REPEATABLE_LABELS.has(labelNorm)) {
      const existing = repeatableValues.get(labelNorm) ?? [];
      if (!existing.includes(rawValue)) {
        existing.push(rawValue);
        repeatableValues.set(labelNorm, existing);
      }
      i = j - 1;
      continue;
    }

    if (seenOnce.has(labelNorm)) { i = j - 1; continue; }
    seenOnce.add(labelNorm);
    pairs.push({ label: rawLabel, value: rawValue });
    i = j - 1;
  }

  for (const [labelNorm, values] of repeatableValues) {
    const humanLabel = labelNorm.replace(/(^|\s)(\w)/g, (_, sp, c) => sp + c.toUpperCase());
    pairs.push({ label: humanLabel, value: values.join(" | ") });
  }

  return pairs;
}

// ── Value coercion ────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
  january:"01", february:"02", march:"03", april:"04", june:"06",
  july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
};

function parseDate(s: string): string | null {
  const t = s.trim();
  const m1 = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, "0");
    const month = m1[2].padStart(2, "0");
    const year = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    return `${year}-${month}-${day}`;
  }
  const m2 = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/);
  if (m2) {
    const day = m2[1].padStart(2, "0");
    const month = MONTH_MAP[m2[2].toLowerCase()] ?? MONTH_MAP[m2[2].toLowerCase().slice(0, 3)];
    if (month) {
      const year = m2[3].length === 2 ? "20" + m2[3] : m2[3];
      return `${year}-${month}-${day}`;
    }
  }
  const m3 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
  return null;
}

function parseTime(s: string): string | null {
  const m = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function stripGeoAnnotation(s: string): string {
  return s
    .replace(/\s*\(Loc\.?\s+auth\.?[^)]*\).*$/i, "")
    .replace(/\s*\(Force:[^)]*\).*$/i, "")
    .trim();
}

/**
 * Normalise a raw string value based on the target field type and key.
 * Handles date parsing, address cleaning, checkbox normalisation, etc.
 */
export function coerceValue(raw: string, fieldType: string, fieldKey = ""): string {
  const t = raw.trim();

  switch (fieldType) {
    case "date": {
      const d = parseDate(t);
      return d ?? t;
    }
    case "checkbox":
      return /yes|true|✓|☑|y\b/i.test(t) ? "true" : "false";
    case "number":
      return t.replace(/[^0-9.]/g, "");
    default: {
      if (/address/i.test(fieldKey)) return stripGeoAnnotation(t);
      const isDateTimeField =
        /date|time|dob|born|birth|arrest|arrival|concluded|hearing|bail|advice_call|call_received|detention/i.test(fieldKey);
      if (isDateTimeField) {
        const datePart = parseDate(t);
        const timePart = parseTime(t);
        if (datePart && timePart) return `${datePart} ${timePart}`;
        if (datePart) return datePart;
        if (timePart) return timePart;
      }
      return t;
    }
  }
}
