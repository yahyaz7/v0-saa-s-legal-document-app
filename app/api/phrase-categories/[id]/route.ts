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

// DELETE /api/phrase-categories/[id]
// Staff/Admin deletion of a category (firm-scoped).
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

    // Verify category belongs to user's firm
    const { data: category, error: cError } = await supabase
      .from("phrase_categories")
      .select("id, firm_id")
      .eq("id", id)
      .single();

    if (cError || !category) return badRequest("Category not found");
    if (category.firm_id !== firmId) {
      return forbidden();
    }

    const { error: dError } = await supabase
      .from("phrase_categories")
      .delete()
      .eq("id", id);

    if (dError) return err(dError.message);

    return ok({ message: "Category deleted successfully" });
  } catch (error: any) {
    return err(error.message || "Failed to delete category");
  }
}
