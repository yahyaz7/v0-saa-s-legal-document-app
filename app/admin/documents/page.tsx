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
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
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
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRow {
  id: string;
  user_id: string;
  template_id: string;
  form_data: Record<string, unknown>;
  updated_at: string;
  templates: { name: string } | { name: string }[] | null;
}

interface GenRow {
  id: string;
  user_id: string;
  template_id: string;
  draft_id: string | null;
  file_name: string | null;
  generated_at: string;
  templates: { name: string } | { name: string }[] | null;
}

interface TemplateOption {
  id: string;
  name: string;
}

function tplName(raw: DraftRow["templates"] | GenRow["templates"]): string {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDocumentsPage() {
  const router = useRouter();

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [gens, setGens] = useState<GenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template picker dialog
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const [pickerOpen, setPickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Delete draft dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch data ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [draftsRes, gensRes] = await Promise.all([
      supabase
        .from("saved_form_drafts")
        .select("id, user_id, template_id, form_data, updated_at, templates(name)")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("document_generations")
        .select("id, user_id, template_id, draft_id, file_name, generated_at, templates(name)")
        .order("generated_at", { ascending: false })
        .limit(200),
    ]);

    if (draftsRes.error) setError(draftsRes.error.message);
    else setDrafts((draftsRes.data ?? []) as unknown as DraftRow[]);

    if (gensRes.error) setError((e) => e ?? gensRes.error!.message);
    else setGens((gensRes.data ?? []) as unknown as GenRow[]);

    // Collect unique user IDs and fetch their names
    const allDrafts = (draftsRes.data ?? []) as unknown as DraftRow[];
    const allGens = (gensRes.data ?? []) as unknown as GenRow[];
    const uniqueIds = [...new Set([...allDrafts.map((d) => d.user_id), ...allGens.map((g) => g.user_id)].filter(Boolean))];
    if (uniqueIds.length > 0) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name")
        .in("id", uniqueIds);
      const names: Record<string, string> = {};
      for (const u of usersData ?? []) names[u.id] = u.name ?? u.id;
      setUserNames(names);
    }

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Template picker ───────────────────────────────────────────────────────

  async function openPicker() {
    setPickerOpen(true);
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("templates")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setTemplates((data ?? []) as TemplateOption[]);
    setTemplatesLoading(false);
  }

  function selectTemplate(id: string) {
    setPickerOpen(false);
    router.push(`/admin/new-document?template=${id}`);
  }

  // ── Delete draft ──────────────────────────────────────────────────────────

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

  // ── Filter ────────────────────────────────────────────────────────────────

  const filteredDrafts = drafts.filter((d) => {
    const q = search.toLowerCase();
    return (
      clientName(d.form_data).toLowerCase().includes(q) ||
      tplName(d.templates).toLowerCase().includes(q)
    );
  });

  const filteredGens = gens.filter((g) => {
    const q = search.toLowerCase();
    return (
      (g.file_name ?? "").toLowerCase().includes(q) ||
      tplName(g.templates).toLowerCase().includes(q)
    );
  });

  const skeletonRows = [1, 2, 3, 4];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Documents
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Create, manage and track all your firm's document drafts and generated files.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={openPicker}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none" }}
        >
          New Document
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs + Search */}
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
            <Tab label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FileClock size={16} />
                All Drafts
                {!loading && <Chip label={drafts.length} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: "#F3F4F6", color: "#374151" }} />}
              </Box>
            } />
            <Tab label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FileDown size={16} />
                Generated
                {!loading && <Chip label={gens.length} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: "#F3F4F6", color: "#374151" }} />}
              </Box>
            } />
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

        {/* ── Drafts Tab ─────────────────────────────────────────────────── */}
        {tab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#374151", py: 1.5 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Created By</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Last Updated</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#374151" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  skeletonRows.map((i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <TableCell key={j}><Skeleton width={j === 5 ? 120 : "80%"} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 8 }}>
                      <FolderOpen size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                      <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 1 }}>
                        {search ? "No drafts match your search." : "No drafts yet."}
                      </Typography>
                      {!search && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={openPicker}
                          sx={{ borderColor: "#395B45", color: "#395B45", textTransform: "none" }}
                        >
                          Create your first document
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrafts.map((draft) => (
                    <TableRow key={draft.id} hover sx={{ "&:hover": { bgcolor: "#F9FAFB" } }}>
                      <TableCell sx={{ fontWeight: 600, color: "#111827" }}>
                        {clientName(draft.form_data)}
                      </TableCell>
                      <TableCell sx={{ color: "#374151" }}>{tplName(draft.templates)}</TableCell>
                      <TableCell sx={{ color: "#374151", fontSize: "0.85rem" }}>
                        {userNames[draft.user_id] ?? "—"}
                      </TableCell>
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
                              size="small"
                              variant="contained"
                              startIcon={<FileEdit size={14} />}
                              onClick={() => router.push(`/admin/new-document?template=${draft.template_id}&draft=${draft.id}`)}
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

        {/* ── Generated Tab ───────────────────────────────────────────────── */}
        {tab === 1 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#374151", py: 1.5 }}>File Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Created By</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Generated On</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "#374151" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  skeletonRows.map((i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <TableCell key={j}><Skeleton width={j === 5 ? 120 : "80%"} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredGens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 8 }}>
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
                      <TableCell sx={{ color: "#374151" }}>{tplName(gen.templates)}</TableCell>
                      <TableCell sx={{ color: "#374151", fontSize: "0.85rem" }}>
                        {userNames[gen.user_id] ?? "—"}
                      </TableCell>
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
                                router.push(`/admin/new-document?template=${gen.template_id}&draft=${gen.draft_id}`);
                              } else {
                                router.push(`/admin/new-document?template=${gen.template_id}`);
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

      {/* Template Picker Dialog */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Choose a Template</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography variant="body2" sx={{ color: "#6B7280", mb: 2 }}>
            Select a published template to begin a new document.
          </Typography>
          {templatesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : templates.length === 0 ? (
            <Alert severity="info">
              No published templates found. Publish a template first from the Templates page.
            </Alert>
          ) : (
            <List disablePadding sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
              {templates.map((tpl, idx) => (
                <ListItemButton
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl.id)}
                  divider={idx < templates.length - 1}
                  sx={{ "&:hover": { bgcolor: "#F0FDF4" } }}
                >
                  <Box sx={{ bgcolor: "#F0FDF4", p: 1, borderRadius: 1.5, mr: 2, flexShrink: 0 }}>
                    <FileText size={16} color="#395B45" />
                  </Box>
                  <ListItemText
                    primary={tpl.name}
                    primaryTypographyProps={{ fontWeight: 600, color: "#111827", fontSize: "0.9rem" }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPickerOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
