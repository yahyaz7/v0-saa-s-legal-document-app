import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from("phrases")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Phrase deleted successfully" });

  } catch (error: any) {
    console.error("[Phrase Delete Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to delete phrase" }, { status: 500 });
  }
}
