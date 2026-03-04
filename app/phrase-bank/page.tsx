"use client";

import { useState } from "react";
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
} from "@mui/material";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { useAppContext, Phrase } from "@/lib/app-context";

interface PhraseFormData {
  title: string;
  content: string;
  offenceTags: string[];
  stage: string;
  category: string;
  triggerKeywords: string[];
}

const defaultFormData: PhraseFormData = {
  title: "",
  content: "",
  offenceTags: [],
  stage: "",
  category: "",
  triggerKeywords: [],
};

const stageOptions = ["Pre-sentence", "Sentencing", "Appeal", "Trial", "Bail"];
const categoryOptions = ["Character", "Mitigation", "Personal Circumstances", "Medical", "Employment", "Family"];
const tagOptions = ["General", "Mitigation", "Mental Health", "Family", "Employment", "Drug Offence", "Violence"];

export default function PhraseBankPage() {
  const { phrases, addPhrase, updatePhrase, deletePhrase } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null);
  const [formData, setFormData] = useState<PhraseFormData>(defaultFormData);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [phraseToDelete, setPhraseToDelete] = useState<string | null>(null);

  const handleOpenDialog = (phrase?: Phrase) => {
    if (phrase) {
      setEditingPhrase(phrase);
      setFormData({
        title: phrase.title,
        content: phrase.content,
        offenceTags: phrase.offenceTags,
        stage: phrase.stage,
        category: phrase.category,
        triggerKeywords: phrase.triggerKeywords,
      });
    } else {
      setEditingPhrase(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPhrase(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (editingPhrase) {
      updatePhrase(editingPhrase.id, formData);
    } else {
      addPhrase({ ...formData, confidence: 85 });
    }
    handleCloseDialog();
  };

  const handleDeleteClick = (id: string) => {
    setPhraseToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (phraseToDelete) {
      deletePhrase(phraseToDelete);
    }
    setDeleteConfirmOpen(false);
    setPhraseToDelete(null);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
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

      {/* Phrases Table */}
      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Offence Tags</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Stage</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Trigger Keywords</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {phrases.map((phrase) => (
                <TableRow key={phrase.id} sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}>
                  <TableCell sx={{ fontWeight: 500 }}>{phrase.title}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {phrase.offenceTags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{ backgroundColor: "rgba(57, 91, 69, 0.08)", color: "#395B45", fontSize: 11 }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{phrase.stage}</TableCell>
                  <TableCell>{phrase.category}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {phrase.triggerKeywords.slice(0, 2).map((keyword) => (
                        <Chip
                          key={keyword}
                          label={keyword}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 11 }}
                        />
                      ))}
                      {phrase.triggerKeywords.length > 2 && (
                        <Chip label={`+${phrase.triggerKeywords.length - 2}`} size="small" sx={{ fontSize: 11 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(phrase)} sx={{ color: "#666666" }}>
                      <Edit2 size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteClick(phrase.id)} sx={{ color: "#D32F2F" }}>
                      <Trash2 size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { maxHeight: "90vh" }
        }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingPhrase ? "Edit Phrase" : "Add New Phrase"}
          </Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ overflow: "auto" }}>
          <Grid container spacing={3} sx={{ pt: 1, minWidth: 0 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Offence Tags</InputLabel>
                <Select
                  multiple
                  value={formData.offenceTags}
                  label="Offence Tags"
                  onChange={(e) => setFormData({ ...formData, offenceTags: e.target.value as string[] })}
                  MenuProps={{
                    PaperProps: {
                      sx: { maxHeight: 300 }
                    }
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", maxHeight: 60, overflow: "hidden" }}>
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={formData.stage}
                  label="Stage"
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                >
                  {stageOptions.map((stage) => (
                    <MenuItem key={stage} value={stage}>
                      {stage}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categoryOptions.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Trigger Keywords (comma separated)"
                value={formData.triggerKeywords.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggerKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingPhrase ? "Update" : "Add"} Phrase
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Phrase?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this phrase? This action cannot be undone.</Typography>
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
