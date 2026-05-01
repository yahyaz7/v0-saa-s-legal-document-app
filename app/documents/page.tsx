"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
} from "@mui/material";
import {
  Search,
  FileEdit,
  FileDown,
  Trash2,
  RefreshCw,
  FolderOpen,
  FileClock,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface DraftRow {
  id: string;
  template_id: string;
  form_data: Record<string, unknown>;
  updated_at: string;
  created_at: string;
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

function templateName(raw: DraftRow["templates"] | GenRow["templates"]): string {
  if (!raw) return "Unknown";
  return Array.isArray(raw) ? (raw[0]?.name ?? "Unknown") : raw.name;
}

function clientName(formData: Record<string, unknown>): string {
  return (
    (formData.client as string) ||
    (formData.client_name as string) ||
    (formData.name as string) ||
    "—"
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();

  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("docs-tab");
      if (saved) { sessionStorage.removeItem("docs-tab"); return Number(saved); }
    }
    return 0;
  });
  const [search, setSearch] = useState("");

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [gens, setGens] = useState<GenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete draft dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [draftsRes, gensRes] = await Promise.all([
      supabase
        .from("saved_form_drafts")
        .select("id, template_id, form_data, updated_at, created_at, templates(name)")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("document_generations")
        .select("id, template_id, draft_id, file_name, generated_at, templates(name)")
        .order("generated_at", { ascending: false })
        .limit(100),
    ]);

    if (draftsRes.error) setError(draftsRes.error.message);
    else setDrafts((draftsRes.data ?? []) as unknown as DraftRow[]);

    if (gensRes.error && !error) setError(gensRes.error.message);
    else setGens((gensRes.data ?? []) as unknown as GenRow[]);

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Delete draft ─────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError("");
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("saved_form_drafts")
      .delete()
      .eq("id", deleteId);

    setDeleting(false);
    if (delErr) { setDeleteError(delErr.message); return; }
    setDeleteId(null);
    setDrafts((prev) => prev.filter((d) => d.id !== deleteId));
  }

  // ── Filter ───────────────────────────────────────────────────────────────

  const filteredDrafts = drafts.filter((d) => {
    const q = search.toLowerCase();
    return (
      clientName(d.form_data).toLowerCase().includes(q) ||
      templateName(d.templates).toLowerCase().includes(q)
    );
  });

  const filteredGens = gens.filter((g) => {
    const q = search.toLowerCase();
    return (
      (g.file_name ?? "").toLowerCase().includes(q) ||
      templateName(g.templates).toLowerCase().includes(q)
    );
  });

  // ── Render ───────────────────────────────────────────────────────────────

  const skeletonRows = [1, 2, 3, 4, 5];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: { xs: 2.5, sm: 4 }, gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            My Documents
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage your drafts and download generated documents.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/templates"
          variant="contained"
          size="small"
          startIcon={<Plus size={15} />}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", flexShrink: 0, fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.875rem" }, px: { xs: 1.5, sm: 2 }, py: { xs: "5px", sm: "6px" } }}
        >
          New Document
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs + Search bar */}
      <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ borderBottom: "1px solid #E5E7EB", px: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem", minHeight: 48 },
              "& .Mui-selected": { color: "#395B45" },
              "& .MuiTabs-indicator": { bgcolor: "#395B45" },
            }}
          >
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FileClock size={16} />
                  Drafts
                  {!loading && (
                    <Chip label={drafts.length} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: "#F3F4F6", color: "#374151" }} />
                  )}
                </Box>
              }
            />
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FileDown size={16} />
                  Generated
                  {!loading && (
                    <Chip label={gens.length} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: "#F3F4F6", color: "#374151" }} />
                  )}
                </Box>
              }
            />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 220, "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={15} color="#9CA3AF" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {/* ── Drafts Tab ───────────────────────────────────────────────── */}
        {tab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#374151", py: 1.5 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Last Updated</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#374151" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  skeletonRows.map((i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <TableCell key={j}><Skeleton width={j === 5 ? 100 : "80%"} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: "center", py: 8 }}>
                      <FolderOpen size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                      <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                        {search ? "No drafts match your search." : "No drafts yet. Start a new document to create one."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrafts.map((draft) => (
                    <TableRow key={draft.id} hover sx={{ "&:hover": { bgcolor: "#F9FAFB" } }}>
                      <TableCell sx={{ fontWeight: 600, color: "#111827" }}>
                        {clientName(draft.form_data)}
                      </TableCell>
                      <TableCell sx={{ color: "#374151" }}>{templateName(draft.templates)}</TableCell>
                      <TableCell sx={{ color: "#6B7280", fontSize: "0.85rem" }}>
                        {new Date(draft.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="Draft"
                          size="small"
                          sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600, fontSize: "0.72rem", borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                          <Tooltip title="Continue editing">
                            <Button
                              component={Link}
                              href={`/new-document?template=${draft.template_id}&draft=${draft.id}`}
                              size="small"
                              variant="contained"
                              startIcon={<FileEdit size={14} />}
                              sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600, fontSize: "0.78rem" }}
                            >
                              Open
                            </Button>
                          </Tooltip>
                          <Tooltip title="Delete draft">
                            <IconButton
                              size="small"
                              onClick={() => { setDeleteError(""); setDeleteId(draft.id); }}
                              sx={{ color: "#9CA3AF", "&:hover": { color: "#DC2626", bgcolor: "rgba(220,38,38,0.06)" } }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* ── Generated Tab ────────────────────────────────────────────── */}
        {tab === 1 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#374151", py: 1.5 }}>File Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Generated On</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#374151" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  skeletonRows.map((i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <TableCell key={j}><Skeleton width={j === 5 ? 100 : "80%"} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredGens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: "center", py: 8 }}>
                      <FileDown size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                      <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                        {search ? "No documents match your search." : "No documents generated yet. Open a draft and click Generate DOCX."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGens.map((gen) => (
                    <TableRow key={gen.id} hover sx={{ "&:hover": { bgcolor: "#F9FAFB" } }}>
                      <TableCell sx={{ fontWeight: 500, color: "#111827", fontSize: "0.875rem" }}>
                        {gen.file_name ?? "document.docx"}
                      </TableCell>
                      <TableCell sx={{ color: "#374151" }}>{templateName(gen.templates)}</TableCell>
                      <TableCell sx={{ color: "#6B7280", fontSize: "0.85rem" }}>
                        {new Date(gen.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {" "}
                        <Typography component="span" variant="caption" sx={{ color: "#9CA3AF" }}>
                          {new Date(gen.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="Generated"
                          size="small"
                          sx={{ bgcolor: "#D1FAE5", color: "#065F46", fontWeight: 600, fontSize: "0.72rem", borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={gen.draft_id ? "Re-open draft to regenerate" : "Open template to regenerate"}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshCw size={13} />}
                            onClick={() => {
                              if (gen.draft_id) {
                                router.push(`/new-document?template=${gen.template_id}&draft=${gen.draft_id}`);
                              } else {
                                router.push(`/new-document?template=${gen.template_id}`);
                              }
                            }}
                            sx={{ borderColor: "#D1D5DB", color: "#374151", textTransform: "none", fontWeight: 600, fontSize: "0.78rem" }}
                          >
                            Re-generate
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Draft?</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently delete the draft and all its saved data. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteId(null)} disabled={deleting} sx={{ color: "#6B7280", textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmDelete}
            disabled={deleting}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, textTransform: "none", fontWeight: 600 }}
          >
            {deleting ? "Deleting…" : "Delete Draft"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
