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
  _req: NextRequest,
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
    const { data: version } = await adminSupabase
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = createAdminClient();

    // 1. Collect all storage file paths before touching the DB
    const { data: versions, error: vFetchError } = await db
      .from("template_versions")
      .select("docx_template_path")
      .eq("template_id", templateId);

    if (vFetchError) throw vFetchError;

    const filePaths = (versions ?? [])
      .map((v) => v.docx_template_path)
      .filter(Boolean) as string[];

    // 2. Delete files from storage first — abort if this fails so the DB record is preserved
    if (filePaths.length > 0) {
      const { error: storageError } = await db.storage
        .from("docx-templates")
        .remove(filePaths);

      if (storageError) {
        console.error("[Template Delete] Storage removal failed:", storageError);
        throw new Error(`Failed to delete template files from storage: ${storageError.message}`);
      }
    }

    // 3. Delete DB record — cascades to template_versions and template_fields
    const { error: deleteError } = await db
      .from("templates")
      .delete()
      .eq("id", templateId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[Template Delete Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
