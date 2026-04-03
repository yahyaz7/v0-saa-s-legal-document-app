import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("roles(name)")
    .eq("id", user.id)
    .single();

  const role = (userData?.roles as any)?.name;
  if (role !== "admin" && role !== "super_admin") return null;
  return user;
}

// PATCH /api/admin/offences/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const updates: Record<string, string> = {};
    if (body.category !== undefined) updates.category = body.category.trim();
    if (body.type !== undefined) updates.type = body.type.trim();
    if (body.offence !== undefined) updates.offence = body.offence.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("offences")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update offence" }, { status: 500 });
  }
}

// DELETE /api/admin/offences/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase
      .from("offences")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete offence" }, { status: 500 });
  }
}
