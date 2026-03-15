"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbPhrase {
  id: string;
  title: string;
  content: string;
  offence_tags: string[];
  stage: string | null;
  category: string | null;
  trigger_keywords: string[];
}

interface PhraseFormData {
  title: string;
  content: string;
  offence_tags: string[];
  stage: string;
  category: string;
  trigger_keywords: string[];
}

const defaultFormData: PhraseFormData = {
  title: "",
  content: "",
  offence_tags: [],
  stage: "",
  category: "",
  trigger_keywords: [],
};

const stageOptions = ["Pre-sentence", "Sentencing", "Appeal", "Trial", "Bail"];
const categoryOptions = [
  "Character",
  "Mitigation",
  "Personal Circumstances",
  "Medical",
  "Employment",
  "Family",
];
const tagOptions = [
  "General",
  "Mitigation",
  "Mental Health",
  "Family",
  "Employment",
  "Drug Offence",
  "Violence",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhraseBankPage() {
  const [phrases, setPhrases] = useState<DbPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<DbPhrase | null>(null);
  const [formData, setFormData] = useState<PhraseFormData>(defaultFormData);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [phraseToDelete, setPhraseToDelete] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadPhrases = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("phrase_bank_entries")
      .select("id, title, content, offence_tags, stage, category, trigger_keywords")
      .order("title");

    if (error) {
      setFetchError("Failed to load phrases. Please refresh.");
    } else {
      setPhrases((data ?? []) as DbPhrase[]);
      setFetchError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  // ── Dialog handlers ─────────────────────────────────────────────────────────

  const handleOpenDialog = (phrase?: DbPhrase) => {
    if (phrase) {
      setEditingPhrase(phrase);
      setFormData({
        title: phrase.title,
        content: phrase.content,
        offence_tags: phrase.offence_tags ?? [],
        stage: phrase.stage ?? "",
        category: phrase.category ?? "",
        trigger_keywords: phrase.trigger_keywords ?? [],
      });
    } else {
      setEditingPhrase(null);
      setFormData(defaultFormData);
    }
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPhrase(null);
    setFormData(defaultFormData);
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formData.content.trim()) {
      setFormError("Content is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const supabase = createClient();
    const payload = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      offence_tags: formData.offence_tags,
      stage: formData.stage || null,
      category: formData.category || null,
      trigger_keywords: formData.trigger_keywords,
    };

    const { error } = editingPhrase
      ? await supabase
          .from("phrase_bank_entries")
          .update(payload)
          .eq("id", editingPhrase.id)
      : await supabase.from("phrase_bank_entries").insert(payload);

    if (error) {
      setFormError("Failed to save phrase. Please try again.");
      setSaving(false);
      return;
    }

    await loadPhrases();
    setSaving(false);
    handleCloseDialog();
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDeleteClick = (id: string) => {
    setPhraseToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!phraseToDelete) return;
    const supabase = createClient();
    await supabase.from("phrase_bank_entries").delete().eq("id", phraseToDelete);
    await loadPhrases();
    setDeleteConfirmOpen(false);
    setPhraseToDelete(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
            Phrase Bank
          </Typography>
          <Typography variant="body1" sx={{ color: "#666666" }}>
            Manage your library of reusable legal phrases.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          onClick={() => handleOpenDialog()}
        >
          Add Phrase
        </Button>
      </Box>

      {fetchError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {fetchError}
        </Alert>
      )}

      {/* Phrases Table */}
      <Paper sx={{ overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Offence Tags</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Stage</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>
                    Trigger Keywords
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {phrases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      sx={{ textAlign: "center", py: 6, color: "#666666" }}
                    >
                      No phrases yet. Click &quot;Add Phrase&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  phrases.map((phrase) => (
                    <TableRow
                      key={phrase.id}
                      sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{phrase.title}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {(phrase.offence_tags ?? []).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{
                                backgroundColor: "rgba(57, 91, 69, 0.08)",
                                color: "#395B45",
                                fontSize: 11,
                              }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>{phrase.stage ?? "—"}</TableCell>
                      <TableCell>{phrase.category ?? "—"}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {(phrase.trigger_keywords ?? []).slice(0, 2).map((keyword) => (
                            <Chip
                              key={keyword}
                              label={keyword}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 11 }}
                            />
                          ))}
                          {(phrase.trigger_keywords ?? []).length > 2 && (
                            <Chip
                              label={`+${phrase.trigger_keywords.length - 2}`}
                              size="small"
                              sx={{ fontSize: 11 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(phrase)}
                          sx={{ color: "#666666" }}
                        >
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(phrase.id)}
                          sx={{ color: "#D32F2F" }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: "90vh" } }}
      >
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingPhrase ? "Edit Phrase" : "Add New Phrase"}
          </Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ overflow: "auto" }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Grid container spacing={3} sx={{ pt: 1, minWidth: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Offence Tags</InputLabel>
                <Select
                  multiple
                  value={formData.offence_tags}
                  label="Offence Tags"
                  onChange={(e) =>
                    setFormData({ ...formData, offence_tags: e.target.value as string[] })
                  }
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                  renderValue={(selected) => (
                    <Box
                      sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", maxHeight: 60, overflow: "hidden" }}
                    >
                      {selected.map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ height: 24 }} />
                      ))}
                    </Box>
                  )}
                >
                  {tagOptions.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={formData.stage}
                  label="Stage"
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {stageOptions.map((stage) => (
                    <MenuItem key={stage} value={stage}>
                      {stage}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {categoryOptions.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Trigger Keywords (comma separated)"
                value={formData.trigger_keywords.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    trigger_keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined" disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {saving ? "Saving…" : editingPhrase ? "Update Phrase" : "Add Phrase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Phrase?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this phrase? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
