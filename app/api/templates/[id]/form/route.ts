import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch the active/latest version for this template
    const { data: version, error: vError } = await supabase
      .from("template_versions")
      .select(`
        id,
        version_number,
        docx_template_path,
        templates (
          id,
          name,
          description
        )
      `)
      .eq("template_id", templateId)
      .eq("is_active", true)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (vError || !version) {
      return NextResponse.json({ error: "Template version not found" }, { status: 404 });
    }

    // 2. Fetch all fields for this version
    const { data: fields, error: fError } = await supabase
      .from("template_fields")
      .select("*")
      .eq("template_version_id", version.id)
      .order("field_order", { ascending: true });

    if (fError) throw fError;

    // 3. (Optional) Fetch phrases if requested or as part of the initial load
    // For MVP, we'll keep it simple and just return template + fields

    return NextResponse.json({
      success: true,
      template: version.templates,
      version: {
        id: version.id,
        number: version.version_number
      },
      fields: fields.map(f => ({
        id: f.id,
        key: f.field_key,
        label: f.field_label,
        type: f.field_type,
        required: f.is_required,
        order: f.field_order,
        placeholder: f.placeholder,
        helpText: f.help_text
      }))
    });

  } catch (error: any) {
    console.error("[Template Form Fetch Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch form data" }, { status: 500 });
  }
}
