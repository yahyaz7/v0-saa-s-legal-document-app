"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Switch,
  Tooltip,
} from "@mui/material";
import {
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface DetectedField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  field_options: string[];
  supports_phrase_bank: boolean;
  section_heading: string;
}

const fieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

const steps = ["Upload DOCX", "Field Configuration", "Publish Template"];

function ManageTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingId = searchParams.get("id");

  // Start at step 1 immediately when resuming a draft — avoids flash of step 0
  const [activeStep, setActiveStep] = useState(existingId ? 1 : 0);
  const [dragOver, setDragOver] = useState(false);

  // Step 1
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  // Step 2
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [formHeading, setFormHeading] = useState("");

  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // ── Load existing draft when ?id= is present ───────────────────────────────
  useEffect(() => {
    if (!existingId) return;
    setLoading(true);
    fetch(`/api/admin/templates/${existingId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error("Not found");
        const { template, version, fields: dbFields } = json.data;
        setTemplateId(template.id);
        setTemplateName(template.name);
        setTemplateDescription(template.description || "");
        if (version) {
          setVersionId(version.id);
          if (version.form_heading) setFormHeading(version.form_heading);
          const mapped: DetectedField[] = (dbFields ?? []).map((f: any) => ({
            id: f.id ?? crypto.randomUUID(),
            field_name: f.field_key,
            field_label: f.field_label,
            field_type: f.field_type,
            is_required: f.is_required,
            field_options: f.field_options ?? [],
            supports_phrase_bank: f.supports_phrase_bank,
            section_heading: f.section_heading ?? "",
          }));
          setFields(mapped);
          setActiveStep(1); // always land on field configuration when resuming a draft
        }
      })
      .catch(() => setError("Failed to load template draft."))
      .finally(() => setLoading(false));
  }, [existingId]);

  // ── Save fields silently and navigate back ─────────────────────────────────
  const handleSaveAndGoBack = async () => {
    if (templateId && fields.length > 0) {
      const cleanedFields = fields.map((f) => ({
        ...f,
        field_label: f.field_label.trim(),
        field_name: f.field_name.trim(),
        field_options: f.field_options.map((o) => o.trim()).filter((o) => o !== ""),
      }));
      await fetch(`/api/templates/${templateId}/fields/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: cleanedFields, versionId, formHeading }),
      }).catch(() => {}); // best-effort — don't block navigation
    }
    router.push("/admin/templates");
  };

  // ── STEP 1 ─────────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      if (!templateName) setTemplateName(file.name.replace(/\.docx$/i, ""));
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!uploadedFile || !templateName) return;

    setLoading(true);
    setError(null);

    // Track the newly created template so we can roll it back on any failure
    let createdTemplateId: string | null = null;

    try {
      // 1. Upload — always creates a new template record + version
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("name", templateName);
      formData.append("description", templateDescription);

      const uploadRes = await fetch("/api/templates/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const newTemplateId = uploadData.data.template_id;
      const newVersionId = uploadData.data.version_id;

      // Record ID so the catch block can clean up if anything below fails
      createdTemplateId = newTemplateId;

      // 2. Detect placeholders
      const detectRes = await fetch(`/api/templates/${newTemplateId}/detect-placeholders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: newVersionId }),
      });
      const detectData = await detectRes.json();
      if (!detectRes.ok) throw new Error(detectData.error || "Detection failed");

      // Detection succeeded — commit IDs to state
      setTemplateId(newTemplateId);
      setVersionId(newVersionId);
      createdTemplateId = null; // no longer needs rollback

      // 3. Map detected items (headings + placeholders) to initial field objects
      type DetectedItem = { type: "heading" | "placeholder"; value: string };
      const { items: detectedItems, suggested_heading } = detectData.data as {
        items: DetectedItem[];
        suggested_heading: string | null;
      };
      if (suggested_heading) setFormHeading(suggested_heading);
      let currentHeading = "";
      const initialFields: DetectedField[] = [];
      for (const item of detectedItems) {
        if (item.type === "heading") {
          currentHeading = item.value;
        } else {
          initialFields.push({
            id: crypto.randomUUID(),
            field_name: item.value,
            field_label: item.value.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            field_type: "text",
            is_required: false,
            field_options: [],
            supports_phrase_bank: false,
            section_heading: currentHeading,
          });
        }
      }

      setFields(initialFields);
      setActiveStep(1);
    } catch (err: any) {
      setError(err.message);

      // Roll back the template record + storage file so it never appears in the list
      if (createdTemplateId) {
        await fetch(`/api/admin/templates/${createdTemplateId}`, { method: "DELETE" }).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2 ─────────────────────────────────────────────────────────────────

  const handleFieldChange = (id: string, prop: keyof DetectedField, value: unknown) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [prop]: value } : f)));
  };

  const handleOptionsChange = (id: string, value: string) => {
    handleFieldChange(id, "field_options", value.split(","));
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddField = () => {
    setFields((prev) => {
      const existingKeys = new Set(prev.map((f) => f.field_name));
      let n = prev.length + 1;
      while (existingKeys.has(`field_${n}`)) n++;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          field_name: `field_${n}`,
          field_label: `Field ${n}`,
          field_type: "text",
          is_required: false,
          field_options: [],
          supports_phrase_bank: false,
          section_heading: "",
        },
      ];
    });
  };

  const handleSaveFields = async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const cleanedFields = fields.map((f) => ({
        ...f,
        field_label: f.field_label.trim(),
        field_name: f.field_name.trim(),
        field_options: f.field_options.map((o) => o.trim()).filter((o) => o !== ""),
      }));

      const res = await fetch(`/api/templates/${templateId}/fields/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: cleanedFields, versionId, formHeading }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");

      setActiveStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handlePublish = async () => {
    if (!templateId) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");

      router.push("/admin/templates?success=true");
    } catch (err: any) {
      setError(err.message);
      setPublishing(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <IconButton onClick={handleSaveAndGoBack} sx={{ bgcolor: "#F3F4F6" }}>
          <ArrowLeft size={18} />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Template Builder
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280" }}>
            Upload a DOCX, configure fields, then publish
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #E5E7EB" }} elevation={0}>
        <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
          {steps.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>
        )}

        {/* ── Step 1: Upload ── */}
        {activeStep === 0 && (
          <Box sx={{ maxWidth: 800, mx: "auto" }}>
            <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {/* Drop zone */}
              <Box sx={{ flex: "1 1 300px" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  1. Select DOCX Template
                </Typography>
                <Paper
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file?.name.endsWith(".docx")) {
                      setUploadedFile(file);
                      if (!templateName) setTemplateName(file.name.replace(/\.docx$/i, ""));
                    }
                  }}
                  onClick={() => document.getElementById("docx-upload")?.click()}
                  sx={{
                    py: 6, px: 4, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    border: "2px dashed",
                    borderColor: dragOver ? "#395B45" : "#D1D5DB",
                    bgcolor: dragOver ? "rgba(57,91,69,0.04)" : "#FAFAFA",
                    transition: "all 0.2s ease", borderRadius: 4,
                  }}
                  elevation={0}
                >
                  <input id="docx-upload" type="file" accept=".docx" onChange={handleFileSelect} style={{ display: "none" }} />
                  <Box sx={{ bgcolor: "rgba(57,91,69,0.1)", p: 2, borderRadius: "50%", display: "inline-flex", mb: 2 }}>
                    <Upload size={32} color="#395B45" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "#111827", fontWeight: 600 }}>
                    {uploadedFile ? uploadedFile.name : "Click or drag to upload"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Maximum file size: 10MB</Typography>
                </Paper>
              </Box>

              {/* Meta */}
              <Box sx={{ flex: "1 1 300px" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  2. Template Details
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <TextField
                    label="Template Name"
                    fullWidth
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Magistrates Attendance Note"
                    required
                  />
                  <TextField
                    label="Description (Optional)"
                    fullWidth
                    multiline
                    rows={3}
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe when to use this template..."
                  />
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={!uploadedFile || !templateName || loading}
                    onClick={handleUploadAndAnalyze}
                    endIcon={loading ? null : <ArrowRight size={18} />}
                    sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, py: 1.5, textTransform: "none", fontWeight: 600 }}
                  >
                    {loading ? "Uploading & Analysing…" : "Next: Configure Fields"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Step 2: Configure Fields ── */}
        {activeStep === 1 && (
          <Box>
            {/* Form Heading — detected from DOCX, editable, mandatory */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography variant="caption" sx={{ color: "#6B7280", display: "block", mb: 1 }}>
                Form Heading <span style={{ color: "#EF4444" }}>*</span>
              </Typography>
              <TextField
                fullWidth
                value={formHeading}
                onChange={(e) => setFormHeading(e.target.value)}
                placeholder="e.g. COURT ATTENDANCE NOTE"
                required
                error={formHeading.trim() === ""}
                helperText={formHeading.trim() === "" ? "Form heading is required" : "Displayed at the top of the form when users fill it in"}
                inputProps={{
                  style: {
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  },
                }}
                sx={{ maxWidth: 560, mx: "auto" }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <FileText color="#395B45" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {fields.length} Placeholders Configured
                </Typography>
              </Box>
              <Button
                startIcon={<Plus size={16} />}
                onClick={handleAddField}
                sx={{ color: "#395B45", fontWeight: 600, textTransform: "none" }}
              >
                Add Field
              </Button>
            </Box>

            <TableContainer sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 4 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#F9FAFB" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Pattern</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Display Label</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Config</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Req</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Phrase Bank</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id} hover>
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip
                          label={`{${field.field_name}}`}
                          size="small"
                          sx={{ fontFamily: "monospace", bgcolor: "#F3F4F6", fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={field.field_label}
                          onChange={(e) => handleFieldChange(field.id, "field_label", e.target.value)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={field.field_type}
                            onChange={(e) => handleFieldChange(field.id, "field_type", e.target.value)}
                          >
                            {fieldTypeOptions.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        {field.field_type === "dropdown" ? (
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="Option 1, Option 2, ..."
                            value={field.field_options.join(",")}
                            onChange={(e) => handleOptionsChange(field.id, e.target.value)}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: "#9CA3AF" }}>No extra config</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <input
                          type="checkbox"
                          checked={field.is_required}
                          onChange={(e) => handleFieldChange(field.id, "is_required", e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: "#395B45" }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Allow phrase bank insertion for this field">
                          <Switch
                            size="small"
                            checked={field.supports_phrase_bank}
                            onChange={(e) => handleFieldChange(field.id, "supports_phrase_bank", e.target.checked)}
                            color="primary"
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleRemoveField(field.id)} sx={{ color: "#EF4444" }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(0)}
                sx={{ color: "#374151", borderColor: "#D1D5DB", textTransform: "none" }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveFields}
                disabled={loading || !formHeading.trim()}
                sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", px: 4 }}
              >
                {loading ? "Saving…" : "Next: Verify & Publish"}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Step 3: Publish ── */}
        {activeStep === 2 && (
          <Box sx={{ maxWidth: 600, mx: "auto", textAlign: "center" }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ bgcolor: "rgba(57,91,69,0.1)", p: 3, borderRadius: "50%", display: "inline-flex", mb: 3 }}>
                <Check size={48} color="#395B45" />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Template Ready!</Typography>
              <Typography variant="body2" sx={{ color: "#6B7280" }}>
                Ready to publish <strong>{templateName}</strong> with <strong>{fields.length}</strong> configured fields.
              </Typography>
            </Box>

            <Box sx={{ p: 4, bgcolor: "#F9FAFB", borderRadius: 3, border: "1px solid #E5E7EB", textAlign: "left", mb: 4 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, textTransform: "uppercase", fontSize: "0.75rem", color: "#6B7280" }}>
                Summary
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ flex: "1 1 40%" }}>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>File</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{uploadedFile?.name}</Typography>
                </Box>
                <Box sx={{ flex: "1 1 40%" }}>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Field Count</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{fields.length} Fields</Typography>
                </Box>
                <Box sx={{ flex: "1 1 40%" }}>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Phrase Bank</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {fields.filter((f) => f.supports_phrase_bank).length} Fields enabled
                  </Typography>
                </Box>
                <Box sx={{ flex: "1 1 40%" }}>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Status</Typography>
                  <Typography variant="body2" sx={{ color: "#395B45", fontWeight: 700 }}>Ready to Publish</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
                disabled={publishing}
                sx={{ color: "#374151", borderColor: "#D1D5DB", textTransform: "none", px: 4 }}
              >
                Go Back
              </Button>
              <Button
                variant="contained"
                onClick={handlePublish}
                disabled={publishing}
                sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", px: 6 }}
              >
                {publishing ? "Publishing…" : "Finalize & Publish"}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 4, display: "flex", gap: 2, p: 2, bgcolor: "#F9FAFB", borderRadius: 2 }}>
        <HelpCircle size={20} color="#6B7280" />
        <Typography variant="body2" sx={{ color: "#6B7280" }}>
          <strong>Pro Tip:</strong> Placeholders like <code>{"{client_name}"}</code> are automatically detected from your DOCX.
          Use <code>Dropdown</code> for fields with fixed options to ensure data consistency.
        </Typography>
      </Box>

    </Box>
  );
}

export default function AdminManageTemplatesPage() {
  return (
    <Suspense fallback={<LinearProgress />}>
      <ManageTemplateContent />
    </Suspense>
  );
}
