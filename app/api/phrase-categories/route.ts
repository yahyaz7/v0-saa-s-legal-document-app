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

// POST /api/phrase-categories
// Create or Update a phrase category (firm-scoped).
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return unauthorized();

    const firmId = await getFirmId(supabase, user.id);
    if (!firmId) return badRequest("Could not determine your firm");

    const body = await req.json();
    const { id, name } = body;

    if (!name) return badRequest("Missing required field: name");

    if (id) {
      // Update
      const { data, error } = await supabase
        .from("phrase_categories")
        .update({ name })
        .eq("id", id)
        .eq("firm_id", firmId) // Security: Ensure it's their firm
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } else {
      // Create
      const { data, error } = await supabase
        .from("phrase_categories")
        .insert({ name, firm_id: firmId })
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    }
  } catch (error: any) {
    return err(error.message || "Failed to save category");
  }
}
