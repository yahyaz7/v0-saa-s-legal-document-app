import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check - get firm_id
    const { data: userData } = await supabase
      .from("users")
      .select("firm_id")
      .eq("id", user.id)
      .single();

    const firmId = userData?.firm_id;

    const body = await req.json();
    const { 
      template_id, 
      template_version_id, 
      title, 
      fields, // Record<field_key, value>
      document_id // Optional, for updates
    } = body;

    if (!template_id || !fields) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let docId = document_id;

    // ── STEP 1: Create or Update Document Record ────────────────────────────
    if (docId) {
      const { error: dError } = await supabase
        .from("documents")
        .update({
          title: title || "Untitled Document",
          updated_at: new Date().toISOString(),
        })
        .eq("id", docId);
      if (dError) throw dError;
    } else {
      const { data: doc, error: dError } = await supabase
        .from("documents")
        .insert({
          firm_id: firmId,
          template_id,
          template_version_id: template_version_id, // Important for reproducibility
          created_by: user.id,
          title: title || "Untitled Document",
          status: "draft"
        })
        .select()
        .single();
      if (dError) throw dError;
      docId = doc.id;
    }

    // ── STEP 2: Save Field Values ───────────────────────────────────────────
    // For MVP/Simplicity: Delete old values for this document and re-insert
    // In a production app with heavy load, we'd use upsert.
    if (document_id) {
      const { error: delError } = await supabase
        .from("document_field_values")
        .delete()
        .eq("document_id", docId);
      if (delError) throw delError;
    }

    // Map field keys to field IDs from the template_fields table
    const { data: templateFields } = await supabase
      .from("template_fields")
      .select("id, field_key")
      .eq("template_version_id", template_version_id);

    if (!templateFields) throw new Error("Could not find template fields");

    const valueInserts = templateFields.map(tf => ({
      document_id: docId,
      template_field_id: tf.id,
      value_text: typeof fields[tf.field_key] === "object" 
        ? JSON.stringify(fields[tf.field_key]) 
        : String(fields[tf.field_key])
    }));

    const { error: vError } = await supabase
      .from("document_field_values")
      .insert(valueInserts);

    if (vError) throw vError;

    return NextResponse.json({
      success: true,
      documentId: docId
    });

  } catch (error: any) {
    console.error("[Document Save Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to save document" }, { status: 500 });
  }
}
