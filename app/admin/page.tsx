"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Alert,
  Button,
  Divider,
} from "@mui/material";
import {
  Building2,
  Users,
  ArrowRight,
  FileClock,
  FileDown,
  FileText,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Firm = { id: string; name: string; slug: string; created_at: string; userCount: number };

interface DraftRow {
  id: string;
  template_id: string;
  form_data: Record<string, unknown>;
  updated_at: string;
  templates: { name: string } | { name: string }[] | null;
}

interface Stats {
  drafts: number;
  generated: number;
}

function tplName(raw: DraftRow["templates"]): string {
  if (!raw) return "Unknown";
  return Array.isArray(raw) ? (raw[0]?.name ?? "Unknown") : raw.name;
}

function clientName(fd: Record<string, unknown>): string {
  return (fd.client as string) || (fd.client_name as string) || (fd.name as string) || "—";
}

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const router = useRouter();
  const [firm, setFirm]               = useState<Firm | null>(null);
  const [loadingFirm, setLoadingFirm] = useState(true);
  const [error, setError]             = useState("");

  const [stats, setStats]             = useState<Stats>({ drafts: 0, generated: 0 });
  const [recentDrafts, setRecentDrafts] = useState<DraftRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // ── Fetch firm ────────────────────────────────────────────────────────────

  const loadFirm = useCallback(async () => {
    setLoadingFirm(true);
    const token = await getToken();
    if (!token) { setLoadingFirm(false); return; }
    const res = await fetch("/api/admin/firm", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to load firm details."); setLoadingFirm(false); return; }
    setFirm(json.data as Firm);
    setLoadingFirm(false);
  }, []);

  // ── Fetch doc stats + recent drafts ──────────────────────────────────────

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    const supabase = createClient();

    // Scope all queries to the current admin's own data only
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    if (!uid) { setLoadingDocs(false); return; }

    const [draftsRes, gensCountRes, recentRes] = await Promise.all([
      supabase.from("saved_form_drafts").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("document_generations").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase
        .from("saved_form_drafts")
        .select("id, template_id, form_data, updated_at, templates(name)")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(4),
    ]);

    setStats({
      drafts: draftsRes.count ?? 0,
      generated: gensCountRes.count ?? 0,
    });
    setRecentDrafts((recentRes.data ?? []) as unknown as DraftRow[]);
    setLoadingDocs(false);
  }, []);

  useEffect(() => {
    loadFirm();
    loadDocs();
  }, [loadFirm, loadDocs]);

  const skeletonRows = [1, 2, 3];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: { xs: 2.5, sm: 4 }, gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <LayoutDashboard size={20} color="#395B45" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>Overview</Typography>
            <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.25, fontSize: { xs: "0.78rem", sm: "0.875rem" } }}>
              {loadingFirm ? <Skeleton width={160} /> : `${firm?.name ?? "Your Firm"} · Firm Admin`}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={15} />}
          component={Link}
          href="/admin/documents"
          sx={{
            bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none",
            flexShrink: 0, fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.875rem" }, px: { xs: 1.5, sm: 2 }, py: { xs: "5px", sm: "6px" },
          }}
        >
          New Document
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2.5, sm: 4 }, flexWrap: "wrap" }}>
        {/* Firm */}
        <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 150px" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, py: "16px !important", px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ bgcolor: "#F0FDF4", p: { xs: 1, sm: 1.5 }, borderRadius: 1.5, flexShrink: 0 }}><Building2 size={20} color="#395B45" /></Box>
            <Box>
              {loadingFirm ? <Skeleton width={100} height={26} /> : (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{firm?.name ?? "—"}</Typography>
              )}
              <Typography variant="caption" sx={{ color: "#6B7280" }}>Firm Name</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Team */}
        <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 120px" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, py: "16px !important", px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ bgcolor: "#EEF2FF", p: { xs: 1, sm: 1.5 }, borderRadius: 1.5, flexShrink: 0 }}><Users size={20} color="#6366F1" /></Box>
            <Box>
              {loadingFirm ? <Skeleton width={40} height={30} /> : (
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: "#111827", fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>{firm?.userCount ?? 0}</Typography>
              )}
              <Typography variant="caption" sx={{ color: "#6B7280" }}>Team Members</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* My Drafts */}
        <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 120px" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, py: "16px !important", px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ bgcolor: "#FFFBEB", p: { xs: 1, sm: 1.5 }, borderRadius: 1.5, flexShrink: 0 }}><FileClock size={20} color="#D97706" /></Box>
            <Box>
              {loadingDocs ? <Skeleton width={40} height={30} /> : (
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: "#111827", fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>{stats.drafts}</Typography>
              )}
              <Typography variant="caption" sx={{ color: "#6B7280" }}>My Drafts</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Generated */}
        <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 120px" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, py: "16px !important", px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ bgcolor: "rgba(57,91,69,0.08)", p: { xs: 1, sm: 1.5 }, borderRadius: 1.5, flexShrink: 0 }}><FileDown size={20} color="#395B45" /></Box>
            <Box>
              {loadingDocs ? <Skeleton width={40} height={30} /> : (
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: "#111827", fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>{stats.generated}</Typography>
              )}
              <Typography variant="caption" sx={{ color: "#6B7280" }}>Generated</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ── Two-column content ───────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: { xs: 2, sm: 3 }, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Recent Drafts */}
        <Box sx={{ flex: "1 1 340px", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827" }}>Recent Drafts</Typography>
            <Button
              component={Link}
              href="/admin/documents"
              size="small"
              endIcon={<ArrowRight size={14} />}
              sx={{ color: "#395B45", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
            >
              View all
            </Button>
          </Box>
          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
            {loadingDocs ? (
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {skeletonRows.map((i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="60%" height={18} />
                      <Skeleton width="40%" height={14} />
                    </Box>
                    <Skeleton width={50} height={24} sx={{ borderRadius: 1 }} />
                  </Box>
                ))}
              </Box>
            ) : recentDrafts.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <FileClock size={32} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 1.5 }}>No drafts yet.</Typography>
                <Button
                  component={Link}
                  href="/admin/documents"
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: "#395B45", color: "#395B45", textTransform: "none" }}
                >
                  Create your first document
                </Button>
              </Box>
            ) : (
              recentDrafts.map((draft, idx) => (
                <Box key={draft.id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{ display: "flex", alignItems: "center", px: 2, py: 1.5, gap: 2, cursor: "pointer", transition: "background 0.12s", "&:hover": { bgcolor: "#F9FAFB" } }}
                    onClick={() => router.push(`/admin/new-document?template=${draft.template_id}&draft=${draft.id}`)}
                  >
                    <Box sx={{ bgcolor: "#FFFBEB", p: 1, borderRadius: 1.5, flexShrink: 0 }}>
                      <FileClock size={18} color="#D97706" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {clientName(draft.form_data)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                        {tplName(draft.templates)} · {new Date(draft.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </Typography>
                    </Box>
                    <Chip label="Draft" size="small" sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600, fontSize: "0.7rem", borderRadius: 1 }} />
                  </Box>
                </Box>
              ))
            )}
          </Card>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827", mb: 1.5 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[
              { title: "New Document", desc: "Start a new document from a template", icon: <Plus size={18} color="#395B45" />, bg: "#F0FDF4", href: "/admin/documents" },
              { title: "Manage Templates", desc: "Upload and configure templates", icon: <FileText size={18} color="#6366F1" />, bg: "#EEF2FF", href: "/admin/templates" },
              { title: "Manage Team", desc: "Add or remove staff members", icon: <Users size={18} color="#D97706" />, bg: "#FFFBEB", href: "/admin/users" },
              { title: "Firm Settings", desc: "Update firm name and settings", icon: <Building2 size={18} color="#374151" />, bg: "#F3F4F6", href: "/admin/settings" },
            ].map((action) => (
              <Card
                key={action.href}
                elevation={0}
                onClick={() => router.push(action.href)}
                sx={{ border: "1px solid #E5E7EB", borderRadius: 2, cursor: "pointer", transition: "border-color 0.15s, background 0.15s", "&:hover": { borderColor: "#395B45", bgcolor: "#F0FFF4" } }}
              >
                <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: "12px !important" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ bgcolor: action.bg, p: 1.25, borderRadius: 1.5, flexShrink: 0 }}>{action.icon}</Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{action.title}</Typography>
                      <Typography variant="caption" sx={{ color: "#9CA3AF" }}>{action.desc}</Typography>
                    </Box>
                  </Box>
                  <ArrowRight size={16} color="#9CA3AF" />
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Firm details */}
          {!loadingFirm && firm && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#374151", mb: 1 }}>Firm Details</Typography>
              <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
                <CardContent sx={{ py: "12px !important" }}>
                  {[
                    { label: "Name", value: firm.name },
                    { label: "Slug", value: firm.slug },
                    { label: "Created", value: new Date(firm.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
                  ].map((row, idx, arr) => (
                    <Box key={row.label}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: "#6B7280", fontWeight: 500 }}>{row.label}</Typography>
                        <Chip label={row.value} size="small" sx={{ bgcolor: "#F3F4F6", color: "#374151", fontWeight: 500, maxWidth: 180 }} />
                      </Box>
                      {idx < arr.length - 1 && <Divider />}
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
