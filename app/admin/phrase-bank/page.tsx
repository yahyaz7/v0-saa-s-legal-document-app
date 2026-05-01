"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItemButton,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Skeleton,
  Card,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  FolderPlus,
  StickyNote,
  AlertCircle,
} from "lucide-react";

interface Phrase {
  id: string;
  label: string;
  phrase_text: string;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  phrases: Phrase[];
}

export default function AdminPhraseBankPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [phraseDialogOpen, setPhraseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editCategory, setEditCategory] = useState<{ id?: string; name: string }>({ name: "" });
  const [editPhrase, setEditPhrase] = useState<{ id?: string; category_id: string; label: string; phrase_text: string }>({ category_id: "", label: "", phrase_text: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "phrase"; id: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/phrases");
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
        if (data.data.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data.data[0].id);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const activeCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSaveCategory = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/phrase-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCategory),
      });
      if (res.ok) { await fetchData(); setCategoryDialogOpen(false); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSavePhrase = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPhrase),
      });
      if (res.ok) { await fetchData(); setPhraseDialogOpen(false); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const endpoint = deleteTarget.type === "category"
        ? `/api/admin/phrase-categories/${deleteTarget.id}`
        : `/api/admin/phrases/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        if (deleteTarget.type === "category" && selectedCategoryId === deleteTarget.id) {
          setSelectedCategoryId(null);
        }
        await fetchData();
        setDeleteDialogOpen(false);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: { xs: 2.5, sm: 4 }, gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>Phrase Bank</Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage reusable legal phrases available to staff during document creation
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<FolderPlus size={15} />}
          onClick={() => { setEditCategory({ name: "" }); setCategoryDialogOpen(true); }}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600, borderRadius: 2, flexShrink: 0, fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.875rem" }, px: { xs: 1.5, sm: 2 }, py: { xs: "5px", sm: "6px" } }}
        >
          Add Category
        </Button>
      </Box>

      {isMobile ? (
        /* ── Mobile: stacked layout ── */
        <Box>
          {/* Category chips strip */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
              Categories
            </Typography>
            {loading ? (
              <Box sx={{ display: "flex", gap: 1 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} width={80} height={32} sx={{ borderRadius: 4 }} />)}
              </Box>
            ) : categories.length === 0 ? (
              <Typography variant="body2" sx={{ color: "#9CA3AF" }}>No categories yet</Typography>
            ) : (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <Box key={cat.id} sx={{ display: "flex", alignItems: "center" }}>
                      <Chip
                        label={`${cat.name} (${cat.phrases.length})`}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        size="small"
                        sx={{
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "0.75rem",
                          bgcolor: isSelected ? "#395B45" : "#F3F4F6",
                          color: isSelected ? "#fff" : "#374151",
                          border: isSelected ? "none" : "1px solid #E5E7EB",
                          "& .MuiChip-label": { px: 1.25 },
                        }}
                      />
                      {isSelected && (
                        <Box sx={{ display: "flex", ml: 0.25 }}>
                          <IconButton size="small" onClick={() => { setEditCategory({ id: cat.id, name: cat.name }); setCategoryDialogOpen(true); }} sx={{ color: "#6B7280", p: 0.5 }}>
                            <Edit2 size={12} />
                          </IconButton>
                          <IconButton size="small" onClick={() => { setDeleteTarget({ type: "category", id: cat.id }); setDeleteDialogOpen(true); }} sx={{ color: "#EF4444", p: 0.5 }}>
                            <Trash2 size={12} />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Phrases panel */}
          <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
            {!selectedCategoryId ? (
              <Box sx={{ py: 8, px: 2, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <Box sx={{ bgcolor: "#F3F4F6", p: 1.5, borderRadius: "50%", mb: 1.5, display: "flex" }}>
                  <BookOpen size={28} color="#9CA3AF" />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#4B5563" }}>No Category Selected</Typography>
                <Typography variant="caption" sx={{ color: "#9CA3AF" }}>Tap a category above to see its phrases</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827" }}>{activeCategory?.name}</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Plus size={13} />}
                    onClick={() => { setEditPhrase({ category_id: selectedCategoryId, label: "", phrase_text: "" }); setPhraseDialogOpen(true); }}
                    sx={{ color: "#395B45", borderColor: "#395B45", textTransform: "none", fontWeight: 600, fontSize: "0.72rem", px: 1, py: "3px" }}
                  >
                    Add Phrase
                  </Button>
                </Box>
                <Box sx={{ p: 1.5 }}>
                  {activeCategory?.phrases.length === 0 ? (
                    <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                      <StickyNote size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
                      <Typography variant="body2" sx={{ color: "#9CA3AF" }}>No phrases in this category yet</Typography>
                    </Box>
                  ) : (
                    activeCategory?.phrases.map((phrase) => (
                      <Card key={phrase.id} elevation={0} sx={{ mb: 1.5, border: "1px solid #E5E7EB", borderRadius: 2, "&:last-child": { mb: 0 } }}>
                        <Box sx={{ p: 1.5 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827" }}>{phrase.label}</Typography>
                            <Box sx={{ display: "flex", flexShrink: 0, ml: 1 }}>
                              <IconButton size="small" onClick={() => { setEditPhrase({ id: phrase.id, category_id: selectedCategoryId, label: phrase.label, phrase_text: phrase.phrase_text }); setPhraseDialogOpen(true); }} sx={{ color: "#6B7280", p: 0.5 }}>
                                <Edit2 size={13} />
                              </IconButton>
                              <IconButton size="small" onClick={() => { setDeleteTarget({ type: "phrase", id: phrase.id }); setDeleteDialogOpen(true); }} sx={{ color: "#EF4444", p: 0.5 }}>
                                <Trash2 size={13} />
                              </IconButton>
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ color: "#6B7280", whiteSpace: "pre-wrap", lineHeight: 1.6, display: "block" }}>
                            {phrase.phrase_text}
                          </Typography>
                        </Box>
                      </Card>
                    ))
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Box>
      ) : (
        /* ── Desktop: two-column layout (unchanged) ── */
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>

          {/* ── Categories column ── */}
          <Box sx={{ width: 260, flexShrink: 0 }}>
            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 3, overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Categories
                </Typography>
              </Box>
              <List sx={{ p: 0 }}>
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <Box key={i} sx={{ px: 2, py: 1.5 }}>
                      <Skeleton height={20} width="80%" />
                    </Box>
                  ))
                ) : categories.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="body2" sx={{ color: "#9CA3AF" }}>No categories yet</Typography>
                  </Box>
                ) : (
                  categories.map((cat) => (
                    <ListItemButton
                      key={cat.id}
                      selected={selectedCategoryId === cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      sx={{
                        py: 1.25,
                        px: 2,
                        borderLeft: "3px solid",
                        borderColor: selectedCategoryId === cat.id ? "#395B45" : "transparent",
                        bgcolor: selectedCategoryId === cat.id ? "rgba(57,91,69,0.05)" : "inherit",
                        "&:hover .cat-actions": { opacity: 1 },
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: selectedCategoryId === cat.id ? 700 : 500, color: "#111827" }}>
                          {cat.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                          {cat.phrases.length} phrase{cat.phrases.length !== 1 ? "s" : ""}
                        </Typography>
                      </Box>
                      <Box className="cat-actions" sx={{ display: "flex", opacity: 0, transition: "opacity 0.15s" }} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={() => { setEditCategory({ id: cat.id, name: cat.name }); setCategoryDialogOpen(true); }} sx={{ color: "#6B7280", p: 0.5 }}>
                          <Edit2 size={13} />
                        </IconButton>
                        <IconButton size="small" onClick={() => { setDeleteTarget({ type: "category", id: cat.id }); setDeleteDialogOpen(true); }} sx={{ color: "#EF4444", p: 0.5 }}>
                          <Trash2 size={13} />
                        </IconButton>
                      </Box>
                    </ListItemButton>
                  ))
                )}
              </List>
            </Paper>
          </Box>

          {/* ── Phrases column ── */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 3, minHeight: 400 }}>
              {!selectedCategoryId ? (
                <Box sx={{ py: 16, px: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                  <Box sx={{ bgcolor: "#F3F4F6", p: 2, borderRadius: "50%", mb: 2, display: "flex" }}>
                    <BookOpen size={40} color="#9CA3AF" />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#4B5563" }}>No Category Selected</Typography>
                  <Typography variant="body2" sx={{ color: "#9CA3AF", maxWidth: 240 }}>
                    Select a category from the left to view and manage your firm's phrases
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827" }}>{activeCategory?.name}</Typography>
                      <Typography variant="caption" sx={{ color: "#6B7280" }}>Phrases available to staff when filling forms</Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<Plus size={14} />}
                      size="small"
                      onClick={() => { setEditPhrase({ category_id: selectedCategoryId, label: "", phrase_text: "" }); setPhraseDialogOpen(true); }}
                      sx={{ color: "#395B45", borderColor: "#395B45", textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                    >
                      Add Phrase
                    </Button>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    {activeCategory?.phrases.length === 0 ? (
                      <Box sx={{ py: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <Box sx={{ bgcolor: "#F9FAFB", p: 2, borderRadius: "50%", mb: 2, display: "flex" }}>
                          <StickyNote size={32} color="#D1D5DB" />
                        </Box>
                        <Typography variant="body2" sx={{ color: "#9CA3AF" }}>No phrases in this category yet</Typography>
                      </Box>
                    ) : (
                      activeCategory?.phrases.map((phrase) => (
                        <Card key={phrase.id} elevation={0} sx={{ mb: 2, border: "1px solid #E5E7EB", borderRadius: 2 }}>
                          <Box sx={{ p: 2, display: "flex", gap: 2, alignItems: "center" }}>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827", mb: 0.5 }}>{phrase.label}</Typography>
                              <Typography variant="body2" sx={{ color: "#6B7280", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{phrase.phrase_text}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", flexShrink: 0, gap: 0.5 }}>
                              <IconButton size="small" onClick={() => { setEditPhrase({ id: phrase.id, category_id: selectedCategoryId, label: phrase.label, phrase_text: phrase.phrase_text }); setPhraseDialogOpen(true); }} sx={{ color: "#6B7280", "&:hover": { bgcolor: "#F3F4F6" } }}>
                                <Edit2 size={14} />
                              </IconButton>
                              <IconButton size="small" onClick={() => { setDeleteTarget({ type: "phrase", id: phrase.id }); setDeleteDialogOpen(true); }} sx={{ color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}>
                                <Trash2 size={14} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Card>
                      ))
                    )}
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* Category dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editCategory.id ? "Edit Category" : "New Category"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            variant="outlined"
            value={editCategory.name}
            onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
            placeholder="e.g. Police Interview Notes"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setCategoryDialogOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editCategory.name.trim() || saving}
            onClick={handleSaveCategory}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            {saving ? "Saving…" : "Save Category"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Phrase dialog */}
      <Dialog open={phraseDialogOpen} onClose={() => setPhraseDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editPhrase.id ? "Edit Phrase" : "New Phrase"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: "#6B7280", display: "block", mb: 1 }}>
            Staff can click any phrase to insert it directly into a supported field.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Label"
            fullWidth
            variant="outlined"
            value={editPhrase.label}
            onChange={(e) => setEditPhrase({ ...editPhrase, label: e.target.value })}
            placeholder="e.g. No Comment Advice"
            sx={{ mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Phrase Text"
            fullWidth
            multiline
            rows={5}
            variant="outlined"
            value={editPhrase.phrase_text}
            onChange={(e) => setEditPhrase({ ...editPhrase, phrase_text: e.target.value })}
            placeholder="Enter the full legal phrase here…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setPhraseDialogOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editPhrase.label.trim() || !editPhrase.phrase_text.trim() || saving}
            onClick={handleSavePhrase}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            {saving ? "Saving…" : "Save Phrase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ bgcolor: "#FEF2F2", p: 1, borderRadius: 2, display: "flex" }}>
            <AlertCircle size={18} color="#EF4444" />
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Confirm Delete</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Are you sure you want to delete this {deleteTarget?.type}? This cannot be undone.
            {deleteTarget?.type === "category" && " All phrases in this category will also be deleted."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={handleDelete}
            sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, textTransform: "none", fontWeight: 600 }}
          >
            {saving ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
