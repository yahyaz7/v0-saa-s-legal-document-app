import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ok, unauthorized, forbidden, err } from "@/lib/api/response";

// GET /api/admin/analytics
// Admin/super-admin only. Returns DOCX generation counts per user and per template.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unauthorized();

  // Role check
  const role = (user.app_metadata as any)?.role as string | undefined;
  if (!role || !["admin", "super_admin"].includes(role)) return forbidden();

  const firmId = (user.app_metadata as any)?.firm_id as string | undefined;
  const db = createAdminClient();

  try {
    // ── 1. Build base query scoped to the admin's firm ──────────────────────
    // For super_admin: all firms; for admin: their firm only via user_id filter
    let gens: any[] = [];

    if (role === "super_admin") {
      const { data, error } = await db
        .from("document_generations")
        .select("id, user_id, template_id, generated_at");
      if (error) throw error;
      gens = data ?? [];
    } else {
      // Scope to users in this firm
      const { data: firmUsers, error: fuErr } = await db
        .from("users")
        .select("id")
        .eq("firm_id", firmId);
      if (fuErr) throw fuErr;
      const userIds = (firmUsers ?? []).map((u: any) => u.id);

      if (userIds.length === 0) {
        gens = [];
      } else {
        const { data, error } = await db
          .from("document_generations")
          .select("id, user_id, template_id, generated_at")
          .in("user_id", userIds);
        if (error) throw error;
        gens = data ?? [];
      }
    }

    // ── 2. Aggregate: per user ─────────────────────────────────────────────
    const userCounts: Record<string, number> = {};
    for (const g of gens) {
      userCounts[g.user_id] = (userCounts[g.user_id] ?? 0) + 1;
    }

    // ── 3. Aggregate: per template ────────────────────────────────────────
    const templateCounts: Record<string, number> = {};
    for (const g of gens) {
      templateCounts[g.template_id] = (templateCounts[g.template_id] ?? 0) + 1;
    }

    // ── 4. Fetch user emails ───────────────────────────────────────────────
    const userIds = Object.keys(userCounts);
    let userRows: Array<{ id: string; email: string; full_name: string }> = [];
    if (userIds.length > 0) {
      const { data } = await db
        .from("users")
        .select("id, email, name")
        .in("id", userIds);
      userRows = (data ?? []) as any;
    }

    const userMap: Record<string, { email: string; full_name: string }> = {};
    for (const u of userRows) {
      userMap[u.id] = { email: u.email ?? "", full_name: (u as any).name ?? "" };
    }

    // Fallback: for any user_id not found in the users table, fetch from auth
    const missingIds = userIds.filter((id) => !userMap[id]);
    if (missingIds.length > 0) {
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data: authUser } = await db.auth.admin.getUserById(id);
            if (authUser?.user) {
              userMap[id] = {
                email: authUser.user.email ?? id,
                full_name: (authUser.user.user_metadata?.full_name as string) ?? "",
              };
            }
          } catch {
            // leave as unknown
          }
        })
      );
    }

    // ── 5. Fetch template names ────────────────────────────────────────────
    const templateIds = Object.keys(templateCounts);
    let templateRows: Array<{ id: string; name: string }> = [];
    if (templateIds.length > 0) {
      const { data } = await db
        .from("templates")
        .select("id, name")
        .in("id", templateIds);
      templateRows = (data ?? []) as any;
    }

    const templateMap: Record<string, string> = {};
    for (const t of templateRows) {
      templateMap[t.id] = t.name;
    }

    // ── 6. Count active users in this firm ────────────────────────────────
    let activeUserCount = 0;
    if (role === "super_admin") {
      const { count } = await db
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      activeUserCount = count ?? 0;
    } else {
      const { count } = await db
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("is_active", true);
      activeUserCount = count ?? 0;
    }

    // ── 7. Shape the response ─────────────────────────────────────────────
    const byUser = Object.entries(userCounts)
      .map(([userId, count]) => ({
        user_id: userId,
        email: userMap[userId]?.email ?? "Unknown",
        full_name: userMap[userId]?.full_name ?? "",
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const byTemplate = Object.entries(templateCounts)
      .map(([templateId, count]) => ({
        template_id: templateId,
        name: templateMap[templateId] ?? "Unknown",
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return ok({
      total: gens.length,
      active_users: activeUserCount,
      by_user: byUser,
      by_template: byTemplate,
    });
  } catch (error: any) {
    return err(error.message || "Failed to load analytics");
  }
}
