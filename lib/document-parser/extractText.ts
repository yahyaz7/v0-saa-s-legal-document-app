/**
 * Server-side document text and field extraction.
 *
 * Routing by file type:
 *   PDF / image  → Google Document AI Form Parser
 *                  Returns both structured DocAIField[] AND the full raw text.
 *                  The route uses both: structured fields for high-confidence
 *                  key-value matching, raw text for regex fallback parsing.
 *   DOCX         → PizZip XML paragraph extraction
 *   TXT          → TextDecoder (UTF-8)
 *
 * Unsupported formats and credential errors are surfaced as warning strings
 * rather than thrown exceptions so the route can return a graceful response.
 */

import type { DocAIField } from "./documentAI";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExtractResult {
  /** Plain text representation — used by raw-text viewer and regex fallback parser. */
  text: string;
  /** Identifies which extraction path was taken. */
  method: string;
  /** Non-fatal advisory message shown to the user. */
  warning?: string;
  /**
   * Structured key-value pairs from Document AI Form Parser.
   * Present when method === "documentai" or "documentai-empty".
   * The route merges these with regex pairs extracted from `text`
   * so that nothing is missed even if Document AI misses a field.
   */
  docAIFields?: DocAIField[];
}

// ── Supported MIME types ──────────────────────────────────────────────────────

const PDF_EXT    = ".pdf";
const DOCX_EXT   = ".docx";
const TXT_EXT    = ".txt";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"]);

// ── DOCX extraction via PizZip ────────────────────────────────────────────────

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const PizZip = (await import("pizzip")).default;
  const zip    = new PizZip(buffer);
  const docXml = zip.files["word/document.xml"]?.asText() ?? "";

  const paragraphs: string[] = [];
  const paraRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;

  while ((pm = paraRe.exec(docXml)) !== null) {
    let text = "";
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(pm[0])) !== null) text += tm[1];
    if (text.trim()) paragraphs.push(text.trim());
  }

  return paragraphs.join("\n");
}

// ── Document AI extraction (PDF + images) ─────────────────────────────────────

async function processWithDocumentAI(
  buffer: ArrayBuffer,
  filename: string
): Promise<ExtractResult> {
  const { extractFieldsWithDocumentAI } = await import("./documentAI");

  const { fields, rawText } = await extractFieldsWithDocumentAI(buffer, filename);

  if (fields.length === 0 && !rawText.trim()) {
    return {
      text: "",
      method: "documentai-empty",
      warning:
        "Document AI processed the file but found no content. " +
        "The document may be blank, scanned without text layer, or unreadable.",
      docAIFields: [],
    };
  }

  // Build a human-readable text from structured fields for the debug viewer.
  // The actual raw OCR text is stored separately in `text` for regex parsing.
  const structuredText = fields.map(({ label, value }) => `${label}: ${value}`).join("\n");
  const displayText = rawText.trim() || structuredText;

  return {
    text: displayText,
    method: "documentai",
    docAIFields: fields,
  };
}

function hasCredentials(): boolean {
  const v = process.env.GOOGLE_CREDENTIALS_JSON;
  return Boolean(v) && v !== "PASTE_YOUR_SERVICE_ACCOUNT_JSON_HERE";
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function extractTextFromBuffer(
  buffer: ArrayBuffer,
  filename: string
): Promise<ExtractResult> {
  const name = filename.toLowerCase();

  // ── DOCX ─────────────────────────────────────────────────────────────────
  if (name.endsWith(DOCX_EXT)) {
    try {
      const text = await extractDocxText(buffer);
      return { text, method: "pizzip" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[extract-text] DOCX extraction failed:", msg);
      return {
        text: "",
        method: "docx-failed",
        warning: "This DOCX file could not be read. It may be corrupted.",
      };
    }
  }

  // ── Plain text ────────────────────────────────────────────────────────────
  if (name.endsWith(TXT_EXT)) {
    return { text: new TextDecoder("utf-8").decode(buffer), method: "textdecoder" };
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (name.endsWith(PDF_EXT)) {
    if (!hasCredentials()) {
      return {
        text: "",
        method: "no-credentials",
        warning:
          "PDF extraction requires Google Document AI. " +
          "Please configure GOOGLE_CREDENTIALS_JSON in your environment.",
      };
    }

    try {
      return await processWithDocumentAI(buffer, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[extract-text] Document AI failed for PDF:", msg);
      return {
        text: "",
        method: "documentai-failed",
        warning: `Document AI could not process this PDF: ${msg}`,
      };
    }
  }

  // ── Images ────────────────────────────────────────────────────────────────
  const ext = "." + (name.split(".").pop() ?? "");
  if (IMAGE_EXTS.has(ext)) {
    if (!hasCredentials()) {
      return {
        text: "",
        method: "no-credentials",
        warning:
          "Image extraction requires Google Document AI. " +
          "Please configure GOOGLE_CREDENTIALS_JSON in your environment.",
      };
    }

    try {
      return await processWithDocumentAI(buffer, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[extract-text] Document AI failed for image:", msg);
      return {
        text: "",
        method: "documentai-failed",
        warning: `Document AI could not process this image: ${msg}`,
      };
    }
  }

  // ── Unsupported ───────────────────────────────────────────────────────────
  return {
    text: "",
    method: "unsupported",
    warning: `File type "${ext}" is not supported. Please upload a PDF, DOCX, TXT, JPG, or PNG.`,
  };
}
