import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const body = await req.json();
    const { id, name } = body;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    if (id) {
      // Update
      const { data, error } = await supabase
        .from("phrase_categories")
        .update({ name })
        .eq("id", id)
        .eq("firm_id", firmId) // Ensure ownership
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    } else {
      // Create
      const { data, error } = await supabase
        .from("phrase_categories")
        .insert({ name, firm_id: firmId })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

  } catch (error: any) {
    console.error("[Category Save Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to save category" }, { status: 500 });
  }
}
