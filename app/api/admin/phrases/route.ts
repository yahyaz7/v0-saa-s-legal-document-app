import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: userData } = await supabase
      .from("users")
      .select("firm_id, roles(name)")
      .eq("id", user.id)
      .single();

    const roleName = (userData?.roles as any)?.name;
    const firmId = userData?.firm_id;
    
    if (roleName !== "admin" && roleName !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch categories and their phrases
    const { data: categories, error: cError } = await supabase
      .from("phrase_categories")
      .select(`
        id,
        name,
        phrases (
          id,
          phrase_text,
          created_at
        )
      `)
      .eq("firm_id", firmId)
      .order("name", { ascending: true });

    if (cError) throw cError;

    return NextResponse.json({
      success: true,
      data: categories
    });

  } catch (error: any) {
    console.error("[Phrase Bank List Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch phrases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("roles(name)")
      .eq("id", user.id)
      .single();

    if ((userData?.roles as any)?.name !== "admin" && (userData?.roles as any)?.name !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, category_id, phrase_text } = body;

    if (!category_id || !phrase_text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (id) {
      // Update
      const { data, error } = await supabase
        .from("phrases")
        .update({ category_id, phrase_text, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    } else {
      // Create
      const { data, error } = await supabase
        .from("phrases")
        .insert({ category_id, phrase_text, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

  } catch (error: any) {
    console.error("[Phrase Save Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to save phrase" }, { status: 500 });
  }
}
