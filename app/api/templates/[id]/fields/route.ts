import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, unauthorized, notFound } from "@/lib/api/response";

// GET /api/templates/[id]/fields
// Returns field definitions for the active version of a template.
// Accessible by any authenticated user (staff open this to render the form).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  const db = createAdminClient();

  // Fetch latest active version
  const { data: version, error: vError } = await db
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (vError || !version) return notFound("Template version");

  // Fetch fields — return DB column names directly (field_key is canonical)
  const { data: fields, error: fError } = await db
    .from("template_fields")
    .select(
      "field_key, field_label, field_type, is_required, field_order, field_options, supports_phrase_bank"
    )
    .eq("template_version_id", version.id)
    .order("field_order", { ascending: true });

  if (fError) return err(fError.message);

  return ok(fields ?? []);
}
