import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertSuperAdmin(request: NextRequest): Promise<{ error: string; status: number } | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };

  const { data: { user }, error } = await makeAdminClient().auth.getUser(auth.slice(7));
  if (error || !user) return { error: "Unauthorized", status: 401 };
  if (user.app_metadata?.role !== "super_admin") return { error: "Forbidden", status: 403 };
  return null;
}

// GET /api/super-admin/firms
// Returns all firms with their user counts
export async function GET(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const db = makeAdminClient();

  const { data: firms, error: firmsError } = await db
    .from("firms")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  if (firmsError) return NextResponse.json({ error: firmsError.message }, { status: 500 });

  // Count users per firm in one query
  const { data: userCounts, error: countError } = await db
    .from("users")
    .select("firm_id")
    .not("firm_id", "is", null);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const countMap: Record<string, number> = {};
  for (const u of userCounts ?? []) {
    if (u.firm_id) countMap[u.firm_id] = (countMap[u.firm_id] ?? 0) + 1;
  }

  const result = (firms ?? []).map((f) => ({
    ...f,
    userCount: countMap[f.id] ?? 0,
  }));

  return NextResponse.json(result);
}

// POST /api/super-admin/firms
// Creates a new firm
export async function POST(request: NextRequest) {
  const denied = await assertSuperAdmin(request);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const body = await request.json().catch(() => ({}));
  const name = body.name?.trim();
  const slug = body.slug?.trim();

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const { data, error } = await makeAdminClient()
    .from("firms")
    .insert({ name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, userCount: 0 }, { status: 201 });
}
