import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, badRequest, unauthorized, err } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";
import { extractTextFromBuffer } from "@/lib/document-parser/extractText";

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

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return badRequest("File too large. Maximum size is 10 MB.");
  }

  const buffer = await file.arrayBuffer();
  let extractResult: Awaited<ReturnType<typeof extractTextFromBuffer>>;
  try {
    extractResult = await extractTextFromBuffer(buffer, file.name);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Text extraction failed", 500);
  }

  // Surface credential / config failures as proper errors so the client can show a specific message
  if (extractResult.method === "no-credentials") {
    return err(extractResult.warning ?? "Image/PDF extraction is not configured on this server.", 422);
  }

  if (extractResult.method === "documentai-failed") {
    return err(extractResult.warning ?? "Document AI could not process this file.", 422);
  }

  if (!extractResult.text.trim() && !extractResult.docAIFields?.length) {
    return ok({
      raw_pairs: [],
      raw_text: "",
      extraction_method: extractResult.method,
      warning: extractResult.warning ?? "No text could be extracted from this file.",
    });
  }

  return ok({
    raw_text: extractResult.text,
    extraction_method: extractResult.method,
    ...(extractResult.warning ? { warning: extractResult.warning } : {}),
  });
}
