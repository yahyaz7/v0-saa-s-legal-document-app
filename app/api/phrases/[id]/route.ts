import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, unauthorized, forbidden, badRequest, err } from "@/lib/api/response";

async function getFirmId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("firm_id")
    .eq("id", userId)
    .single();
  return data?.firm_id;
}

// DELETE /api/phrases/[id]
// Staff/Admin deletion of a phrase (firm-scoped).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return unauthorized();

    const firmId = await getFirmId(supabase, user.id);
    if (!firmId) return badRequest("Could not determine your firm");

    // We MUST verify that this phrase belongs to a category in the user's firm
    const { data: phrase, error: fError } = await supabase
      .from("phrases")
      .select(`
        id,
        category_id,
        phrase_categories!inner(firm_id)
      `)
      .eq("id", id)
      .single();

    if (fError || !phrase) return badRequest("Phrase not found");
    if ((phrase.phrase_categories as any).firm_id !== firmId) {
      return forbidden();
    }

    const { error: dError } = await supabase
      .from("phrases")
      .delete()
      .eq("id", id);

    if (dError) return err(dError.message);

    return ok({ message: "Phrase deleted successfully" });
  } catch (error: any) {
    return err(error.message || "Failed to delete phrase");
  }
}
