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
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!raw || raw === "PASTE_YOUR_SERVICE_ACCOUNT_JSON_HERE") {
    throw new Error(
      "[documentAI] GOOGLE_CREDENTIALS_JSON is not configured. " +
      "Add your service account JSON to .env.local."
    );
  }

  // Try parsing as-is first; fall back to collapsing injected newlines.
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(raw.replace(/\n\s*/g, " ").trim());
    } catch {
      throw new Error(
        "[documentAI] GOOGLE_CREDENTIALS_JSON is not valid JSON. " +
        "Ensure the full service account key file is stored on a single line."
      );
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Send a document buffer to Document AI Form Parser and return all
 * detected key-value form fields with confidence scores.
 *
 * Throws on credential misconfiguration or API errors — callers are
 * responsible for catching and handling.
 */
export async function extractFieldsWithDocumentAI(
  buffer: ArrayBuffer,
  filename: string
): Promise<DocAIField[]> {
  const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");

  const credentials = loadCredentials() as Record<string, string>;

  console.log(`[documentAI] processing "${filename}" (${buffer.byteLength} bytes) via ${credentials.client_email}`);

  const client = new DocumentProcessorServiceClient({
    credentials,
    apiEndpoint: `${LOCATION}-documentai.googleapis.com`,
  });

  const [result] = await client.processDocument({
    name: PROCESSOR_NAME,
    rawDocument: {
      content: Buffer.from(buffer),
      mimeType: resolveMimeType(filename),
    },
  });

  const doc = result.document;
  if (!doc) {
    console.warn("[documentAI] API returned no document object.");
    return [];
  }

  const fullText = doc.text ?? "";
  const fields: DocAIField[] = [];
  const seen = new Set<string>();

  for (const page of doc.pages ?? []) {
    for (const field of page.formFields ?? []) {
      const label = cleanFieldText(resolveTextAnchor(field.fieldName?.textAnchor, fullText));
      const value = cleanFieldText(resolveTextAnchor(field.fieldValue?.textAnchor, fullText));

      if (!label || !value) continue;

      const dedupeKey = label.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const labelConf = field.fieldName?.confidence  ?? 0.85;
      const valueConf = field.fieldValue?.confidence ?? 0.85;

      fields.push({ label, value, confidence: (labelConf + valueConf) / 2 });
    }
  }

  console.log(`[documentAI] extracted ${fields.length} form fields from "${filename}"`);
  return fields;
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
