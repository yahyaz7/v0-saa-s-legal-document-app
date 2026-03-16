"use client";

import { useEffect, useState, Suspense } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Switch,
  Alert,
  CircularProgress,
} from "@mui/material";
import { FileText, Plus, Trash2, Eye, X, CheckCircle2, Pencil } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DynamicFormEngine from "@/components/dynamic-form-engine";

interface Template {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  version: number;
  versionCount: number;
}

interface EditableField {
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  field_options: string[] | null;
  supports_phrase_bank: boolean;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

function AdminTemplatesContent() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit fields dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [editFields, setEditFields] = useState<EditableField[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (res.ok && data.data) setTemplates(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/templates/${deleteTargetId}`, { method: "DELETE" });
      if (res.ok) { await fetchTemplates(); setDeleteDialogOpen(false); }
    } catch (e) { console.error(e); }
    finally { setDeleting(false); setDeleteTargetId(null); }
  };

  const openEditDialog = async (template: Template) => {
    setEditTemplate(template);
    setEditError(null);
    setEditSuccess(false);
    setEditFields([]);
    setEditDialogOpen(true);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/fields`);
      const json = await res.json();
      if (res.ok && json.data) setEditFields(json.data);
      else setEditError("Failed to load fields.");
    } catch {
      setEditError("Failed to load fields.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditFieldChange = (
    fieldKey: string,
    prop: keyof EditableField,
    value: unknown
  ) => {
    setEditFields((prev) =>
      prev.map((f) => (f.field_key === fieldKey ? { ...f, [prop]: value } : f))
    );
  };

  const handleSaveFields = async () => {
    if (!editTemplate) return;
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(false);
    try {
      const res = await fetch(`/api/templates/${editTemplate.id}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: editFields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setEditSuccess(true);
      fetchTemplates();
      setTimeout(() => {
        setEditDialogOpen(false);
        setEditSuccess(false);
      }, 1200);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>Templates</Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Create and manage document templates for your firm
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/templates/manage"
          variant="contained"
          startIcon={<Plus size={16} />}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", borderRadius: 2 }}
        >
          New Template
        </Button>
      </Box>

      {/* Success banner */}
      {success && (
        <Fade in>
          <Card elevation={0} sx={{ bgcolor: "#F0FDF4", border: "1px solid #BBF7D0", mb: 3, borderRadius: 2 }}>
            <CardContent sx={{ py: "10px !important", px: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
              <CheckCircle2 size={18} color="#22C55E" />
              <Typography variant="body2" sx={{ color: "#166534", fontWeight: 500 }}>
                Template published successfully!
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: "#F9FAFB" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, py: 2, color: "#374151" }}>Template</TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Version</TableCell>
              <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Created</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: "#374151" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton width="55%" height={24} /></TableCell>
                  <TableCell><Skeleton width={70} height={24} /></TableCell>
                  <TableCell><Skeleton width={40} height={24} /></TableCell>
                  <TableCell><Skeleton width={80} height={24} /></TableCell>
                  <TableCell align="right"><Skeleton width={80} height={32} sx={{ ml: "auto" }} /></TableCell>
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 12 }}>
                  <Box sx={{ opacity: 0.4, mb: 2, display: "flex", justifyContent: "center" }}>
                    <FileText size={48} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ color: "#6B7280", fontWeight: 500, mb: 0.5 }}>
                    No templates yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 3 }}>
                    Upload a DOCX and configure its fields to get started
                  </Typography>
                  <Button
                    component={Link}
                    href="/admin/templates/manage"
                    variant="contained"
                    size="small"
                    startIcon={<Plus size={14} />}
                    sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", borderRadius: 2 }}
                  >
                    Create First Template
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ bgcolor: "#EEF2FF", p: 1, borderRadius: 2, display: "flex" }}>
                        <FileText size={18} color="#4F46E5" />
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827" }}>
                          {template.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                          {template.description || "No description"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={template.is_active ? "Published" : "Draft"}
                      size="small"
                      sx={{
                        bgcolor: template.is_active ? "#F0FDF4" : "#FFF7ED",
                        color: template.is_active ? "#166534" : "#9A3412",
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        border: `1px solid ${template.is_active ? "#BBF7D0" : "#FED7AA"}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`v${template.version ?? 1}`}
                      size="small"
                      sx={{ bgcolor: "#EEF2FF", color: "#4F46E5", fontWeight: 600, fontSize: "0.7rem", border: "1px solid #C7D2FE" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: "#6B7280" }}>
                      {new Date(template.created_at).toLocaleDateString("en-GB")}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                      <Tooltip title="Preview form">
                        <IconButton
                          size="small"
                          onClick={() => { setSelectedTemplate(template); setPreviewOpen(true); }}
                          sx={{ color: "#6B7280", "&:hover": { bgcolor: "#F3F4F6" } }}
                        >
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit fields">
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(template)}
                          sx={{ color: "#395B45", "&:hover": { bgcolor: "#F0FDF4" } }}
                        >
                          <Pencil size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete template">
                        <IconButton
                          size="small"
                          onClick={() => { setDeleteTargetId(template.id); setDeleteDialogOpen(true); }}
                          sx={{ color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}
                        >
                          <Trash2 size={16} />
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

      {/* Preview dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pb: 1 }}>
          <Box>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, display: "block" }}>
              {selectedTemplate?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280" }}>
              Form preview — how staff will see this template
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewOpen(false)} size="small" sx={{ mt: -0.5 }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {selectedTemplate && (
            <DynamicFormEngine templateId={selectedTemplate.id} readOnly />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPreviewOpen(false)} sx={{ color: "#6B7280", textTransform: "none", fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit fields dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setEditSuccess(false); setEditError(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Box>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, display: "block" }}>
              Edit Fields — {editTemplate?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280" }}>
              Update labels, types and options. Field keys are fixed.
            </Typography>
          </Box>
          <IconButton onClick={() => setEditDialogOpen(false)} size="small">
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {editError && (
            <Alert severity="error" sx={{ m: 2 }}>{editError}</Alert>
          )}
          {editSuccess && (
            <Alert severity="success" sx={{ m: 2 }}>Fields saved successfully.</Alert>
          )}

          {editLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : editFields.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "#6B7280" }}>No fields found for this template.</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead sx={{ bgcolor: "#F9FAFB" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, py: 1.5, pl: 2, color: "#374151" }}>Key (fixed)</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Display Label</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Options (comma-sep)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: "#374151" }}>Req</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: "#374151" }}>Phrase Bank</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editFields.map((field) => (
                  <TableRow key={field.field_key} hover>
                    <TableCell sx={{ pl: 2 }}>
                      <Chip
                        label={field.field_key}
                        size="small"
                        sx={{ fontFamily: "monospace", bgcolor: "#F3F4F6", fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={field.field_label}
                        onChange={(e) => handleEditFieldChange(field.field_key, "field_label", e.target.value)}
                        sx={{ minWidth: 160 }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 130 }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={field.field_type}
                          onChange={(e) => handleEditFieldChange(field.field_key, "field_type", e.target.value)}
                        >
                          {FIELD_TYPES.map((t) => (
                            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      {field.field_type === "dropdown" ? (
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Yes, No, ..."
                          value={(field.field_options ?? []).join(",")}
                          onChange={(e) =>
                            handleEditFieldChange(
                              field.field_key,
                              "field_options",
                              e.target.value.split(",")
                            )
                          }
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: "#9CA3AF" }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(e) => handleEditFieldChange(field.field_key, "is_required", e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#395B45" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={field.supports_phrase_bank}
                        onChange={(e) => handleEditFieldChange(field.field_key, "supports_phrase_bank", e.target.checked)}
                        sx={{ "& .MuiSwitch-thumb": { bgcolor: field.supports_phrase_bank ? "#395B45" : undefined } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setEditDialogOpen(false)}
            sx={{ color: "#6B7280", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={editSaving || editLoading || editFields.length === 0}
            onClick={handleSaveFields}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            {editSaving ? <><CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />Saving…</> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ bgcolor: "#FEF2F2", p: 1, borderRadius: 2, display: "flex" }}>
            <Trash2 size={18} color="#EF4444" />
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Delete Template</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently delete the template, all its field configurations, and the uploaded DOCX file. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={deleting}
            onClick={handleDeleteTemplate}
            sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, textTransform: "none", fontWeight: 600 }}
          >
            {deleting ? "Deleting…" : "Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminTemplatesPage() {
  return (
    <Suspense fallback={
      <Box sx={{ p: 4 }}>
        <Skeleton width={200} height={36} sx={{ mb: 1 }} />
        <Skeleton width={300} height={24} sx={{ mb: 4 }} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    }>
      <AdminTemplatesContent />
    </Suspense>
  );
}
