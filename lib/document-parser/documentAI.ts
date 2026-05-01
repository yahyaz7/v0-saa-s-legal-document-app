/**
 * Google Document AI — Form Parser integration.
 *
 * Processor: projects/863704950626/locations/us/processors/76aed22c4a840df4
 * Auth:      Service account JSON stored in GOOGLE_CREDENTIALS_JSON env var
 *            as a single-line JSON string.
 *
 * Supported inputs: PDF, PNG, JPEG, TIFF, BMP, WEBP
 */

const PROJECT_ID     = "863704950626";
const LOCATION       = "us";
const PROCESSOR_ID   = "76aed22c4a840df4";
const PROCESSOR_NAME = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

// ── Public types ──────────────────────────────────────────────────────────────

export interface DocAIField {
  label: string;
  value: string;
  confidence: number;
}

export interface DocAIResult {
  fields: DocAIField[];
  /** Full document text as extracted by Document AI — used for regex fallback parsing. */
  rawText: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveMimeType(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith(".pdf"))                      return "application/pdf";
  if (n.endsWith(".png"))                      return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".tiff") || n.endsWith(".tif")) return "image/tiff";
  if (n.endsWith(".bmp"))                      return "image/bmp";
  if (n.endsWith(".webp"))                     return "image/webp";
  return "application/pdf";
}

function cleanFieldText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[:*]+$/, "")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveTextAnchor(anchor: any, fullText: string): string {
  if (!anchor?.textSegments?.length) return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (anchor.textSegments as any[])
    .map((seg: any) => {
      const start = Number(seg.startIndex ?? 0);
      const end   = Number(seg.endIndex   ?? 0);
      if (!end || end <= start) return "";
      return fullText.slice(start, end);
    })
    .join("")
    .trim();
}

// ── Credentials ───────────────────────────────────────────────────────────────

function loadCredentials(): object {
  let raw = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!raw || raw === "PASTE_YOUR_SERVICE_ACCOUNT_JSON_HERE") {
    throw new Error(
      "[documentAI] GOOGLE_CREDENTIALS_JSON is not configured. " +
      "Add your service account JSON to your environment variables."
    );
  }

  // Handle common env var issues: literal newlines, escaped newlines, or whitespace
  raw = raw.trim();

  try {
    return JSON.parse(raw);
  } catch (firstErr) {
    try {
      // Try resolving escaped newlines (e.g. \n) if they were double-escaped or literal
      const cleaned = raw
        .replace(/\\n/g, "\n") // Convert escaped \n to actual newline
        .replace(/\n\s*/g, ""); // Remove all newlines and following space for valid JSON
      return JSON.parse(cleaned);
    } catch (secondErr) {
      console.error("[documentAI] Failed to parse GOOGLE_CREDENTIALS_JSON.", {
        rawLength: raw.length,
        error: secondErr instanceof Error ? secondErr.message : String(secondErr)
      });
      throw new Error(
        "[documentAI] GOOGLE_CREDENTIALS_JSON is not valid JSON. " +
        "Ensure the service account key is correctly pasted into your environment variables."
      );
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Send a document buffer to Document AI Form Parser and return structured
 * form fields plus the full raw document text for regex fallback parsing.
 *
 * Throws on credential misconfiguration or API errors — callers are
 * responsible for catching and handling.
 */
export async function extractFieldsWithDocumentAI(
  buffer: ArrayBuffer,
  filename: string
): Promise<DocAIResult> {
  const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");

  const credentials = loadCredentials() as Record<string, string>;

  console.log(`[documentAI] processing "${filename}" (${buffer.byteLength} bytes) via ${credentials.client_email}`);

  const client = new DocumentProcessorServiceClient({
    credentials,
    apiEndpoint: `${LOCATION}-documentai.googleapis.com`,
  });

  let result;
  try {
    const mimeType = resolveMimeType(filename);
    console.log(`[documentAI] sending to API: ${filename} (mime: ${mimeType}, size: ${buffer.byteLength})`);
    
    [result] = await client.processDocument({
      name: PROCESSOR_NAME,
      rawDocument: {
        content: Buffer.from(buffer),
        mimeType,
      },
    });
  } catch (apiErr: any) {
    console.error("[documentAI] API call failed:", {
      message: apiErr.message,
      code: apiErr.code,
      details: apiErr.details,
      stack: apiErr.stack,
    });
    throw apiErr;
  }

  const doc = result.document;
  if (!doc) {
    console.warn("[documentAI] API returned no document object.");
    return { fields: [], rawText: "" };
  }

  const fullText = doc.text ?? "";
  const fields: DocAIField[] = [];

  // Labels that legitimately repeat across multiple arrest blocks in one document.
  // For these we collect ALL values and join with " | " rather than first-wins.
  const REPEATABLE = new Set([
    "reason", "arrest time", "as number",
    "arresting officer", "investigating officer",
    "authorising det officer", "authorising det. officer", "authorising",
    "escorting officer", "circumstances of arrest",
    "offence date", "offence/charge summary", "offence status",
  ]);

  // first-wins for non-repeatable; multi-collect for repeatable
  const seenOnce = new Set<string>();
  const multiValues = new Map<string, { originalLabel: string; values: string[]; confidence: number }>();

  for (const page of doc.pages ?? []) {
    for (const field of page.formFields ?? []) {
      const label = cleanFieldText(resolveTextAnchor(field.fieldName?.textAnchor, fullText));
      const value = cleanFieldText(resolveTextAnchor(field.fieldValue?.textAnchor, fullText));

      if (!label || !value) continue;

      const labelConf = field.fieldName?.confidence  ?? 0.85;
      const valueConf = field.fieldValue?.confidence ?? 0.85;
      const conf = (labelConf + valueConf) / 2;

      const key = label.toLowerCase().replace(/\s+/g, " ");

      if (REPEATABLE.has(key)) {
        const existing = multiValues.get(key);
        if (existing) {
          if (!existing.values.includes(value)) existing.values.push(value);
        } else {
          multiValues.set(key, { originalLabel: label, values: [value], confidence: conf });
        }
      } else {
        if (seenOnce.has(key)) continue;
        seenOnce.add(key);
        fields.push({ label, value, confidence: conf });
      }
    }
  }

  // Flush repeatable labels — join multiple values with " | "
  for (const { originalLabel, values, confidence } of multiValues.values()) {
    fields.push({ label: originalLabel, value: values.join(" | "), confidence });
  }

  console.log(`[documentAI] extracted ${fields.length} form fields + ${fullText.length} chars raw text from "${filename}"`);
  return { fields, rawText: fullText };
}

/**
 * Convert DocAIField[] to the generic label/value pair format used by
 * the matching pipeline.
 */
export function docAIFieldsToPairs(
  fields: DocAIField[]
): Array<{ label: string; value: string }> {
  return fields.map(({ label, value }) => ({ label, value }));
}

