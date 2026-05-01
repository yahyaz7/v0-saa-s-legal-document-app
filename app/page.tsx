"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Divider,
  Alert,
} from "@mui/material";
import {
  Plus,
  FileEdit,
  FileDown,
  FileClock,
  FileText,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRow {
  id: string;
  template_id: string;
  form_data: Record<string, unknown>;
  updated_at: string;
  templates: { name: string } | { name: string }[] | null;
}

interface GenRow {
  id: string;
  template_id: string;
  draft_id: string | null;
  file_name: string | null;
  generated_at: string;
  templates: { name: string } | { name: string }[] | null;
}

interface Stats {
  drafts: number;
  generated: number;
  templates: number;
}

function tplName(raw: DraftRow["templates"] | GenRow["templates"]): string {
  if (!raw) return "Unknown";
  return Array.isArray(raw) ? (raw[0]?.name ?? "Unknown") : raw.name;
}

function clientFromData(formData: Record<string, unknown>): string {
  return (
    (formData.client as string) ||
    (formData.client_name as string) ||
    (formData.name as string) ||
    "—"
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  bg,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  loading: boolean;
}) {
  return (
    <Card
      elevation={0}
      sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 130px" }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, py: "16px !important", px: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ bgcolor: bg, p: { xs: 1, sm: 1.5 }, borderRadius: 1.5, display: "flex", flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {loading ? (
            <Skeleton width={40} height={32} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, color: "#111827", fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>
              {value}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "#6B7280", fontWeight: 500, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState<Stats>({ drafts: 0, generated: 0, templates: 0 });
  const [recentDrafts, setRecentDrafts] = useState<DraftRow[]>([]);
  const [recentGens, setRecentGens] = useState<GenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Get user name
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const full: string = (user.user_metadata?.full_name as string) || user.email || "";
      setUserName(full.split("@")[0]);
    }

    // Parallel fetches
    const [draftsRes, gensRes, tplRes] = await Promise.all([
      supabase
        .from("saved_form_drafts")
        .select("id, template_id, form_data, updated_at, templates(name)")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("document_generations")
        .select("id, template_id, draft_id, file_name, generated_at, templates(name)")
        .order("generated_at", { ascending: false })
        .limit(5),
      supabase
        .from("templates")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (draftsRes.error) { setError(draftsRes.error.message); }
    else {
      const rows = (draftsRes.data ?? []) as unknown as DraftRow[];
      setRecentDrafts(rows);
    }

    if (gensRes.error && !error) { setError(gensRes.error.message); }
    else {
      const rows = (gensRes.data ?? []) as unknown as GenRow[];
      setRecentGens(rows);
    }

    // Counts — drafts + gens need separate count queries
    const [draftCountRes, genCountRes] = await Promise.all([
      supabase
        .from("saved_form_drafts")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("document_generations")
        .select("id", { count: "exact", head: true }),
    ]);

    setStats({
      drafts: draftCountRes.count ?? 0,
      generated: genCountRes.count ?? 0,
      templates: tplRes.count ?? 0,
    });

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const skeletonRows = [1, 2, 3];

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: { xs: 2.5, sm: 4 }, gap: 1 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <LayoutDashboard size={20} color="#395B45" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>
              {greeting()}{userName ? `, ${userName}` : ""}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "#6B7280", fontSize: { xs: "0.78rem", sm: "0.875rem" } }}>
            Here&apos;s an overview of your work.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/templates"
          variant="contained"
          size="small"
          startIcon={<Plus size={15} />}
          sx={{
            bgcolor: "#395B45",
            "&:hover": { bgcolor: "#2D4A38" },
            fontWeight: 600,
            textTransform: "none",
            flexShrink: 0,
            fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.875rem" },
            px: { xs: 1.5, sm: 2 },
            py: { xs: "5px", sm: "6px" },
          }}
        >
          New Document
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2.5, sm: 4 }, flexWrap: "wrap" }}>
        <StatCard
          label="Saved Drafts"
          value={stats.drafts}
          icon={<FileClock size={20} color="#D97706" />}
          bg="#FFFBEB"
          loading={loading}
        />
        <StatCard
          label="Documents Generated"
          value={stats.generated}
          icon={<FileDown size={20} color="#395B45" />}
          bg="rgba(57,91,69,0.1)"
          loading={loading}
        />
        <StatCard
          label="Available Templates"
          value={stats.templates}
          icon={<FileText size={20} color="#6366F1" />}
          bg="#EEF2FF"
          loading={loading}
        />
      </Box>

      {/* ── Two-column activity ─────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: { xs: 2, sm: 3 }, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Recent Drafts */}
        <Box sx={{ flex: "1 1 340px", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827" }}>
              Recent Drafts
            </Typography>
            <Button
              component={Link}
              href="/documents"
              size="small"
              endIcon={<ArrowRight size={14} />}
              sx={{ color: "#395B45", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
            >
              View all
            </Button>
          </Box>
          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
            {loading ? (
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {skeletonRows.map((i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="60%" height={18} />
                      <Skeleton width="40%" height={14} />
                    </Box>
                    <Skeleton width={60} height={32} sx={{ borderRadius: 1 }} />
                  </Box>
                ))}
              </Box>
            ) : recentDrafts.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <FileClock size={32} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                  No drafts yet.
                </Typography>
                <Button
                  component={Link}
                  href="/templates"
                  size="small"
                  sx={{ mt: 1.5, color: "#395B45", textTransform: "none", fontWeight: 600 }}
                >
                  Start your first document →
                </Button>
              </Box>
            ) : (
              recentDrafts.map((draft, idx) => (
                <Box key={draft.id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      px: 2,
                      py: 1.5,
                      gap: 2,
                      cursor: "pointer",
                      transition: "background 0.12s",
                      "&:hover": { bgcolor: "#F9FAFB" },
                    }}
                    onClick={() => router.push(`/new-document?template=${draft.template_id}&draft=${draft.id}`)}
                  >
                    <Box sx={{ bgcolor: "#FFFBEB", p: 1, borderRadius: 1.5, flexShrink: 0 }}>
                      <FileClock size={18} color="#D97706" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {clientFromData(draft.form_data)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                        {tplName(draft.templates)} · {new Date(draft.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </Typography>
                    </Box>
                    <Chip
                      label="Draft"
                      size="small"
                      sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600, fontSize: "0.7rem", borderRadius: 1 }}
                    />
                  </Box>
                </Box>
              ))
            )}
          </Card>
        </Box>

        {/* Recent Generated */}
        <Box sx={{ flex: "1 1 340px", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827" }}>
              Recent Generated
            </Typography>
            <Button
              component={Link}
              href="/documents"
              size="small"
              endIcon={<ArrowRight size={14} />}
              sx={{ color: "#395B45", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
              onClick={() => {
                // pre-select generated tab via sessionStorage
                if (typeof window !== "undefined") sessionStorage.setItem("docs-tab", "1");
              }}
            >
              View all
            </Button>
          </Box>
          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
            {loading ? (
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {skeletonRows.map((i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="70%" height={18} />
                      <Skeleton width="40%" height={14} />
                    </Box>
                    <Skeleton width={80} height={20} sx={{ borderRadius: 1 }} />
                  </Box>
                ))}
              </Box>
            ) : recentGens.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <FileDown size={32} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                  No documents generated yet.
                </Typography>
                <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", mt: 0.5 }}>
                  Open a draft and click &ldquo;Generate DOCX&rdquo;.
                </Typography>
              </Box>
            ) : (
              recentGens.map((gen, idx) => (
                <Box key={gen.id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      px: 2,
                      py: 1.5,
                      gap: 2,
                      cursor: "pointer",
                      transition: "background 0.12s",
                      "&:hover": { bgcolor: "#F9FAFB" },
                    }}
                    onClick={() => {
                      if (gen.draft_id) {
                        router.push(`/new-document?template=${gen.template_id}&draft=${gen.draft_id}`);
                      } else {
                        router.push(`/new-document?template=${gen.template_id}`);
                      }
                    }}
                  >
                    <Box sx={{ bgcolor: "rgba(57,91,69,0.08)", p: 1, borderRadius: 1.5, flexShrink: 0 }}>
                      <FileDown size={18} color="#395B45" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {gen.file_name ?? "document.docx"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                        {tplName(gen.templates)} · {new Date(gen.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </Typography>
                    </Box>
                    <Chip
                      label="Generated"
                      size="small"
                      sx={{ bgcolor: "#D1FAE5", color: "#065F46", fontWeight: 600, fontSize: "0.7rem", borderRadius: 1 }}
                    />
                  </Box>
                </Box>
              ))
            )}
          </Card>
        </Box>

      </Box>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <Box sx={{ mt: { xs: 2.5, sm: 4 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827", mb: 1.5 }}>
          Quick Actions
        </Typography>
        <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, flexWrap: "wrap" }}>
          {[
            {
              label: "Start New Document",
              sub: "Choose a template and begin",
              icon: <Plus size={20} color="#395B45" />,
              bg: "rgba(57,91,69,0.08)",
              href: "/templates",
            },
            {
              label: "Browse Templates",
              sub: "View all available templates",
              icon: <FileText size={20} color="#6366F1" />,
              bg: "#EEF2FF",
              href: "/templates",
            },
            {
              label: "View All Documents",
              sub: "Drafts and generated files",
              icon: <FileEdit size={20} color="#D97706" />,
              bg: "#FFFBEB",
              href: "/documents",
            },
          ].map((action) => (
            <Card
              key={action.label}
              elevation={0}
              component={Link}
              href={action.href}
              sx={{
                flex: "1 1 180px",
                border: "1px solid #E5E7EB",
                borderRadius: 2,
                textDecoration: "none",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
                "&:hover": { borderColor: "#395B45", boxShadow: "0 2px 8px rgba(57,91,69,0.12)" },
              }}
            >
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: "14px !important" }}>
                <Box sx={{ bgcolor: action.bg, p: 1.25, borderRadius: 1.5, flexShrink: 0 }}>
                  {action.icon}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
                    {action.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                    {action.sub}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
