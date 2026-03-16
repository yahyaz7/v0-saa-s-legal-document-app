import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Check app_metadata first (faster)
  const metaRole = user.app_metadata?.role;
  if (metaRole === "admin" || metaRole === "super_admin") return user;

  // Fallback to database check
  const { data: userData } = await supabase
    .from("users")
    .select("roles(name)")
    .eq("id", user.id)
    .single();

  const roleName = (userData?.roles as any)?.name;
  if (roleName === "admin" || roleName === "super_admin") return user;

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminSupabase = createAdminClient();

    // 1. Fetch Template
    const { data: template, error: tError } = await adminSupabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (tError) throw tError;

    // 2. Fetch Latest Version
    const { data: version, error: vError } = await adminSupabase
      .from("template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    // Note: If no versions exist yet, that's okay, we'll return template with empty fields
    const fields = version ? await adminSupabase
      .from("template_fields")
      .select("*")
      .eq("template_version_id", version.id)
      .order("field_order", { ascending: true })
      : { data: [] };

    return NextResponse.json({
      success: true,
      data: {
        template,
        version: version || null,
        fields: fields.data || []
      }
    });

  } catch (error: any) {
    console.error("[Template Fetch Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch template" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminSupabase = createAdminClient();

    // 1. Get all version file paths to clean up storage
    const { data: versions } = await adminSupabase
      .from("template_versions")
      .select("docx_template_path")
      .eq("template_id", templateId);

    const filePaths = versions?.map(v => v.docx_template_path) || [];

    // 2. Delete the template (cascades to versions and fields)
    const { error: deleteError } = await adminSupabase
      .from("templates")
      .delete()
      .eq("id", templateId);

    if (deleteError) throw deleteError;

    // 3. Clean up storage
    if (filePaths.length > 0) {
      await adminSupabase.storage
        .from("docx-templates")
        .remove(filePaths);
    }

    return NextResponse.json({ success: true, message: "Template and all versions deleted successfully" });

  } catch (error: any) {
    console.error("[Template Delete Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
