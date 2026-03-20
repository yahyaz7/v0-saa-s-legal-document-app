import { createClient } from "@/lib/supabase/server";
import { ok, unauthorized, badRequest, err } from "@/lib/api/response";

async function getFirmId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("firm_id")
    .eq("id", userId)
    .single();
  return data?.firm_id;
}

// GET /api/phrases
// Returns phrase categories with their phrases for the caller's firm.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const firmId = await getFirmId(supabase, user.id);
  if (!firmId) return badRequest("Could not determine your firm");

  const { data, error } = await supabase
    .from("phrase_categories")
    .select(`
      id,
      name,
      phrases (
        id,
        label,
        phrase_text,
        created_at
      )
    `)
    .eq("firm_id", firmId)
    .order("name", { ascending: true });

  if (error) return err(error.message);

  return ok(data ?? []);
}

// POST /api/phrases
// Create or Update a phrase (firm-scoped).
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return unauthorized();

    const firmId = await getFirmId(supabase, user.id);
    if (!firmId) return badRequest("Could not determine your firm");

    const body = await req.json();
    const { id, category_id, phrase_text, label } = body;

    if (!category_id || !phrase_text || !label) {
      return badRequest("Missing required fields: category_id, label, phrase_text");
    }

    // Verify category belongs to user's firm
    const { data: category } = await supabase
      .from("phrase_categories")
      .select("id")
      .eq("id", category_id)
      .eq("firm_id", firmId)
      .single();

    if (!category) return badRequest("Invalid category or unauthorized access");

    if (id) {
      const { data, error } = await supabase
        .from("phrases")
        .update({ category_id, label, phrase_text, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } else {
      const { data, error } = await supabase
        .from("phrases")
        .insert({ category_id, label, phrase_text, created_by: user.id })
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    }
  } catch (error: any) {
    return err(error.message || "Failed to save phrase");
  }
}
