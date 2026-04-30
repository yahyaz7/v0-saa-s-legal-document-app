import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, badRequest, unauthorized, err } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export interface LLMMapping {
  field_key: string;
  value: string;
  confidence: number;
  reasoning: string;
}

export interface LLMMapResponse {
  mappings: LLMMapping[];
  unmapped_field_keys: string[];
}

interface TemplateField {
  field_key: string;
  field_label: string;
  field_type: string;
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "OPENAI_API_KEY",
});

function buildPrompt(rawText: string, fields: TemplateField[]): string {
  const fieldsBlock = fields
    .map((f) => `- key="${f.field_key}" label="${f.field_label}" type="${f.field_type}"`)
    .join("\n");

  return `You are a legal document data extraction assistant for UK criminal defence law firms.

You are given:
1. RAW TEXT — raw OCR text from a police custody record or attendance note.
2. TEMPLATE FIELDS — the target fields we need to extract from this text.

Your job is to find the information in the RAW TEXT that corresponds to each TEMPLATE FIELD and extract the value.

Context for this domain:
- Documents are UK police custody records (PACE forms) or court attendance notes.
- Common mappings:
    - "Arrest time" or "Time of arrest" -> "arrest_time"
    - "Custody number" or "Ref" -> "custody_number"
    - "Name" or "DP Name" -> client name fields
    - "Offence" or "Offence/Charge Summary" -> "offence" or "offence_description"
    - "National Insurance" or "NI NO" -> "ni_number"
- **NI Number Detection**: Look for UK National Insurance numbers (format: 2 letters, 6 digits, 1 letter, e.g., TH68026C). These are often found near "NI", "NINO", or even inside "Reason" strings like "POCA TRIGGER - TH68026C".
- Repeater fields: You MUST extract values for the sub-fields.
- Multi-row data: If there are multiple offences or multiple blocks of data, join them with " | " (e.g., "Theft | Assault").

RULES:
1. Extract values exactly as they appear, but normalize formats for dates (YYYY-MM-DD) and times (HH:MM) if possible.
2. For NI numbers, extract just the 9-character code if found inside a larger string.
3. Only provide a mapping if you are confident the information exists in the text.
4. Confidence: 0.9–1.0=explicitly found, 0.7–0.8=inferred from context.
5. Omit any field with confidence below 0.7.
6. Return ONLY valid JSON.

RAW TEXT:
---
${rawText}
---

TEMPLATE FIELDS:
${fieldsBlock}

Respond with this exact JSON structure:
{
  "mappings": [
    {
      "field_key": "<field_key from template fields>",
      "value": "<extracted value>",
      "confidence": <number 0.7–1.0>,
      "reasoning": "<one short sentence explaining where it was found>"
    }
  ],
  "unmapped_field_keys": ["<field_keys that were not found in the text>"]
}`;
}

async function callOpenAI(
  rawText: string,
  fields: TemplateField[]
): Promise<LLMMapResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "OPENAI_API_KEY") {
    throw new Error("OPENAI_API_KEY is not configured in .env.local.");
  }

  const prompt = buildPrompt(rawText, fields);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert at extracting structured data from legal documents." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "";
  let parsed: LLMMapResponse;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON response.");
  }

  if (!Array.isArray(parsed.mappings)) {
    throw new Error("OpenAI response missing mappings array.");
  }

  const validFieldKeys = new Set(fields.map((f) => f.field_key));
  const cleanMappings: LLMMapping[] = [];
  const usedFields = new Set<string>();

  for (const m of parsed.mappings) {
    if (
      typeof m.field_key !== "string" ||
      typeof m.value !== "string" ||
      typeof m.confidence !== "number"
    ) continue;

    if (!validFieldKeys.has(m.field_key)) continue;
    if (m.confidence < 0.7) continue;
    if (usedFields.has(m.field_key)) continue;

    usedFields.add(m.field_key);
    cleanMappings.push({
      field_key: m.field_key,
      value: m.value.trim(),
      confidence: Math.min(1, Math.max(0.7, m.confidence)),
      reasoning: typeof m.reasoning === "string" ? m.reasoning : "",
    });
  }

  return {
    mappings: cleanMappings,
    unmapped_field_keys: fields
      .filter((f) => f.field_type !== "repeater" && !usedFields.has(f.field_key))
      .map((f) => f.field_key),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return unauthorized();

  if (!rateLimit("llm-map", user.id, 20, 60_000)) {
    return err("Too many requests. Please wait a moment.", 429);
  }

  let body: { raw_text: string; template_fields: TemplateField[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { raw_text, template_fields } = body;

  if (!raw_text) {
    return badRequest("raw_text is required.");
  }
  if (!Array.isArray(template_fields) || template_fields.length === 0) {
    return badRequest("template_fields must be a non-empty array.");
  }

  try {
    const result = await callOpenAI(raw_text, template_fields);
    return ok(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "OpenAI extraction failed.";
    console.error("[llm-map]", msg);
    return err(msg, 502);
  }
}


