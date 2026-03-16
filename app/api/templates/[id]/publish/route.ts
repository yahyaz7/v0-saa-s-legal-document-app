import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, unauthorized, forbidden } from "@/lib/api/response";

// POST /api/templates/[id]/publish
// Admin / super_admin only.
// Sets is_active = true on the template, making it visible to staff.
// Returns { data: { published: true } }
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  // Role from JWT
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") return forbidden();

  const { error } = await createAdminClient()
    .from("templates")
    .update({ is_active: true })
    .eq("id", templateId);

  if (error) return err(error.message);

  return ok({ published: true });
}
