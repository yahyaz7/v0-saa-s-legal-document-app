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

// GET /api/admin/offences?q=&category=&type=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() ?? "";

    let query = supabase
      .from("offences")
      .select("id, category, type, offence, uploaded_by, created_at")
      .order("category")
      .order("offence");

    if (category) query = query.eq("category", category);
    if (type) query = query.eq("type", type);
    if (q) query = query.or(`offence.ilike.%${q}%,category.ilike.%${q}%,type.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch offences" }, { status: 500 });
  }
}

// DELETE /api/admin/offences — bulk delete { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const ids: string[] = body.ids ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const { error } = await supabase.from("offences").delete().in("id", ids);
    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete offences" }, { status: 500 });
  }
}

// POST /api/admin/offences — create single offence
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { category, type, offence } = body;

    if (!offence?.trim()) {
      return NextResponse.json({ error: "offence is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("offences")
      .insert({ category: category?.trim() ?? "", type: type?.trim() ?? "", offence: offence.trim(), uploaded_by: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create offence" }, { status: 500 });
  }
}
