import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, unauthorized } from "@/lib/api/response";

// GET /api/firm-info
// Any authenticated user — returns their firm's name and logo_url.
// Uses cookie-based auth (same as all other API routes in this project).
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const firmId = user.app_metadata?.firm_id as string | undefined;
  if (!firmId) return ok({ name: null, logo_url: null });

  const db = createAdminClient();
  const { data: firm } = await db
    .from("firms")
    .select("name, logo_url")
    .eq("id", firmId)
    .single();

  return ok({
    name: (firm as any)?.name ?? null,
    logo_url: (firm as any)?.logo_url ?? null,
  });
}
