import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, badRequest, unauthorized, err } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";
import { extractTextFromBuffer } from "@/lib/document-parser/extractText";
import { extractKeyValuePairs, matchFieldsToTemplate } from "@/lib/document-parser/matchFields";
import { docAIFieldsToPairs } from "@/lib/document-parser/documentAI";
import type { TemplateField } from "@/lib/document-parser/matchFields";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  if (!rateLimit("parse-document", user.id, 15, 60_000)) {
    return err("Too many requests. Please wait a moment.", 429);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Request must be multipart/form-data");
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return badRequest("No file provided");
  }
  const file = fileEntry as File;

  const fieldsRaw = formData.get("templateFields");
  if (!fieldsRaw || typeof fieldsRaw !== "string") {
    return badRequest("templateFields JSON is required");
  }

  let templateFields: TemplateField[];
  try {
    templateFields = JSON.parse(fieldsRaw);
    if (!Array.isArray(templateFields)) throw new Error("not an array");
  } catch {
    return badRequest("templateFields must be a valid JSON array");
  }

  // ── File size guard (10 MB) ────────────────────────────────────────────────
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return badRequest("File too large. Maximum size is 10 MB.");
  }

  // ── Extract text / fields ──────────────────────────────────────────────────
  const buffer = await file.arrayBuffer();
  let extractResult: Awaited<ReturnType<typeof extractTextFromBuffer>>;
  try {
    extractResult = await extractTextFromBuffer(buffer, file.name);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Text extraction failed", 500);
  }

  if (!extractResult.text.trim() && !extractResult.docAIFields?.length) {
    return ok({
      matched: [],
      unmatched_template_keys: templateFields.map((f) => f.field_key),
      raw_pairs: [],
      raw_text: "",
      extraction_method: extractResult.method,
      warning: extractResult.warning ?? "No text could be extracted from this file.",
    });
  }
  const pairs = extractResult.docAIFields && extractResult.docAIFields.length > 0
    ? docAIFieldsToPairs(extractResult.docAIFields)
    : extractKeyValuePairs(extractResult.text);

  const { matched: finalMatched, unmatched_template_keys: finalUnmatched } =
    matchFieldsToTemplate(pairs, templateFields);

  const orderMap = new Map(templateFields.map((f, i) => [f.field_key, i]));
  finalMatched.sort(
    (a, b) => (orderMap.get(a.field_key) ?? 999) - (orderMap.get(b.field_key) ?? 999)
  );

  return ok({
    matched: finalMatched,
    unmatched_template_keys: finalUnmatched,
    raw_pairs: pairs,
    extraction_method: extractResult.method,
    raw_text: extractResult.text,
    ...(extractResult.warning ? { warning: extractResult.warning } : {}),
  });
}
