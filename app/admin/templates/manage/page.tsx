"use client";

import { useState, useEffect, Fragment } from "react";
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
  InputLabel,
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
  Collapse,
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
  ChevronDown,
  ChevronUp,
  Search,
  Rows3,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface DetectedField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  field_options: any[];
  supports_phrase_bank: boolean;
  section_heading: string;
}

interface RepeaterSubFieldConfig {
  name: string;
  label: string;
  type: "text" | "dropdown" | "date" | "offence_search";
  options?: string[];
  _optionsRaw?: string;
}

const fieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "offence_search", label: "Offence Search" },
  { value: "repeater", label: "Repeater (Table Rows)" },
];

const steps = ["Upload DOCX", "Field Configuration", "Publish Template"];

// ── Repeater sub-field editor ─────────────────────────────────────────────────

interface RepeaterSubFieldEditorProps {
  fieldId: string;
  subFields: RepeaterSubFieldConfig[];
  onSubFieldChange: (fieldId: string, colIdx: number, prop: keyof RepeaterSubFieldConfig, value: string) => void;
  onSubFieldOptionsChange: (fieldId: string, colIdx: number, raw: string) => void;
  onSubFieldOptionsBlur: (fieldId: string, colIdx: number, raw: string) => void;
  onAddSubField: (fieldId: string) => void;
  onRemoveSubField: (fieldId: string, colIdx: number) => void;
  onToggleOffenceSearch: (fieldId: string, colIdx: number, enabled: boolean) => void;
}

function RepeaterSubFieldEditor({
  fieldId,
  subFields,
  onSubFieldChange,
  onSubFieldOptionsChange,
  onSubFieldOptionsBlur,
  onAddSubField,
  onRemoveSubField,
  onToggleOffenceSearch,
}: RepeaterSubFieldEditorProps) {
  return (
    <Box
      sx={{
        mt: 0,
        border: "1px solid #C6D9CB",
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        bgcolor: "#F7FBF8",
        px: 2.5,
        pt: 2,
        pb: 2.5,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Rows3 size={14} color="#395B45" />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "#395B45", textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}
        >
          Repeater Columns
        </Typography>
        <Typography variant="caption" sx={{ color: "#9CA3AF", ml: 0.5 }}>
          — configure each column of this repeating table
        </Typography>
      </Box>

      {subFields.length === 0 ? (
        <Box
          sx={{
            py: 2,
            textAlign: "center",
            border: "1px dashed #D1D5DB",
            borderRadius: 1.5,
            bgcolor: "#fff",
            mb: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
            No columns yet — add at least one column below.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 1.5 }}>
          {subFields.map((sf, colIdx) => {
            const isOffenceSearch = sf.type === "offence_search";
            const isDropdown = sf.type === "dropdown";
            return (
              <Box
                key={colIdx}
                sx={{
                  bgcolor: "#fff",
                  border: isOffenceSearch ? "1.5px solid #395B45" : "1px solid #E5E7EB",
                  borderRadius: 2,
                  p: 1.5,
                  transition: "border-color 0.15s",
                }}
              >
                {/* Row: key + label + delete */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* Column number badge */}
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: isOffenceSearch ? "#395B45" : "#E5EDE8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      mt: 0.5,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: isOffenceSearch ? "#fff" : "#395B45" }}>
                      {colIdx + 1}
                    </Typography>
                  </Box>

                  <TextField
                    size="small"
                    label="Key"
                    value={sf.name}
                    onChange={(e) => onSubFieldChange(fieldId, colIdx, "name", e.target.value)}
                    sx={{ width: 110, "& .MuiInputBase-input": { fontSize: "0.8rem" } }}
                  />
                  <TextField
                    size="small"
                    label="Column Label"
                    value={sf.label}
                    onChange={(e) => onSubFieldChange(fieldId, colIdx, "label", e.target.value)}
                    sx={{ flex: 1, minWidth: 120, "& .MuiInputBase-input": { fontSize: "0.8rem" } }}
                  />

                  {/* Dropdown options — only shown when type is dropdown */}
                  {isDropdown && (
                    <TextField
                      size="small"
                      label="Options"
                      placeholder="Yes, No, N/A"
                      value={
                        sf._optionsRaw !== undefined
                          ? sf._optionsRaw
                          : (sf.options ?? []).join(", ")
                      }
                      onChange={(e) => onSubFieldOptionsChange(fieldId, colIdx, e.target.value)}
                      onBlur={(e) => onSubFieldOptionsBlur(fieldId, colIdx, e.target.value)}
                      helperText="Comma-separated"
                      sx={{ width: 180, "& .MuiInputBase-input": { fontSize: "0.8rem" } }}
                    />
                  )}

                  <Box sx={{ flexGrow: 1 }} />

                  <Tooltip title="Remove this column">
                    <IconButton
                      size="small"
                      onClick={() => onRemoveSubField(fieldId, colIdx)}
                      sx={{ color: "#D1D5DB", "&:hover": { color: "#EF4444", bgcolor: "#FEF2F2" }, mt: 0.25 }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Input type row — always stable layout */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mt: 1.25,
                    pt: 1.25,
                    borderTop: "1px solid #F3F4F6",
                    gap: 2,
                  }}
                >
                  {/* Input Type — always visible, disabled when offence search is on */}
                  <FormControl size="small" sx={{ minWidth: 130 }} disabled={isOffenceSearch}>
                    <InputLabel sx={{ fontSize: "0.78rem" }}>Input Type</InputLabel>
                    <Select
                      value={isOffenceSearch ? "text" : sf.type}
                      label="Input Type"
                      onChange={(e) => onSubFieldChange(fieldId, colIdx, "type", e.target.value)}
                      sx={{ fontSize: "0.8rem" }}
                    >
                      <MenuItem value="text" sx={{ fontSize: "0.8rem" }}>Text</MenuItem>
                      <MenuItem value="date" sx={{ fontSize: "0.8rem" }}>Date</MenuItem>
                      <MenuItem value="dropdown" sx={{ fontSize: "0.8rem" }}>Dropdown</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Spacer pushes toggle to the right always */}
                  <Box sx={{ flex: 1 }} />

                  {/* Offence Search toggle — fixed position on the right */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                    <Search size={13} color={isOffenceSearch ? "#395B45" : "#D1D5DB"} />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: isOffenceSearch ? 600 : 400,
                        color: isOffenceSearch ? "#395B45" : "#6B7280",
                        transition: "color 0.15s",
                      }}
                    >
                      Offence Search
                    </Typography>
                    <Tooltip
                      title={
                        isOffenceSearch
                          ? "Disable offence search — revert to plain text input"
                          : "Enable live search from the offences database for this column"
                      }
                    >
                      <Switch
                        size="small"
                        checked={isOffenceSearch}
                        onChange={(e) => onToggleOffenceSearch(fieldId, colIdx, e.target.checked)}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": { color: "#395B45" },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#395B45" },
                        }}
                      />
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Button
        size="small"
        startIcon={<Plus size={13} />}
        onClick={() => onAddSubField(fieldId)}
        sx={{
          textTransform: "none",
          fontSize: "0.78rem",
          color: "#395B45",
          fontWeight: 600,
          border: "1px dashed #B6D4BE",
          borderRadius: 1.5,
          px: 1.5,
          py: 0.5,
          "&:hover": { bgcolor: "#EAF2EC", borderColor: "#395B45" },
        }}
      >
        Add column
      </Button>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ManageTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingId = searchParams.get("id");

  const [activeStep, setActiveStep] = useState(existingId ? 1 : 0);
  const [dragOver, setDragOver] = useState(false);
  const [expandedRepeaters, setExpandedRepeaters] = useState<Set<string>>(new Set());

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

  // ── Load existing draft ───────────────────────────────────────────────────────
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
          const mapped: DetectedField[] = (dbFields ?? []).map((f: any) => {
            // Normalise field_options for repeater fields so sub-field editor renders correctly.
            // Ensures each sub-field has a valid `type`, `name`, `label`, and `options`.
            let fieldOptions: any[] = f.field_options ?? [];
            if (f.field_type === "repeater" && Array.isArray(fieldOptions)) {
              fieldOptions = fieldOptions.map((sf: any) => ({
                name: sf.name ?? sf.key ?? "",
                label: sf.label ?? (sf.name ?? "").split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
                type: (["text", "dropdown", "date", "offence_search"].includes(sf.type) ? sf.type : "text") as RepeaterSubFieldConfig["type"],
                options: sf.options ?? [],
                ...(sf._optionsRaw !== undefined ? { _optionsRaw: sf._optionsRaw } : {}),
              }));
            }
            return {
              id: f.id ?? crypto.randomUUID(),
              field_name: f.field_key,
              field_label: f.field_label,
              field_type: f.field_type,
              is_required: f.is_required,
              field_options: fieldOptions,
              supports_phrase_bank: f.supports_phrase_bank,
              section_heading: f.section_heading ?? "",
            };
          });
          setFields(mapped);
          // Auto-expand repeater fields
          const repeaterIds = new Set(mapped.filter((f) => f.field_type === "repeater").map((f) => f.id));
          setExpandedRepeaters(repeaterIds);
          setActiveStep(1);
        }
      })
      .catch(() => setError("Failed to load template draft."))
      .finally(() => setLoading(false));
  }, [existingId]);

  // ── Save and go back ──────────────────────────────────────────────────────────
  const handleSaveAndGoBack = async () => {
    if (templateId && fields.length > 0) {
      const cleanedFields = fields.map((f) => ({
        ...f,
        field_label: f.field_label.trim(),
        field_name: f.field_name.trim(),
        field_options: f.field_options.map((o: any) =>
          typeof o === "string" ? o.trim() : o
        ).filter((o: any) => typeof o !== "string" || o !== ""),
      }));
      await fetch(`/api/templates/${templateId}/fields/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: cleanedFields, versionId, formHeading }),
      }).catch(() => {});
    }
    router.push("/admin/templates");
  };

  // ── Step 1 ────────────────────────────────────────────────────────────────────
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
    let createdTemplateId: string | null = null;
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("name", templateName);
      formData.append("description", templateDescription);

      const uploadRes = await fetch("/api/templates/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const newTemplateId = uploadData.data.template_id;
      const newVersionId = uploadData.data.version_id;
      createdTemplateId = newTemplateId;

      const detectRes = await fetch(`/api/templates/${newTemplateId}/detect-placeholders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: newVersionId }),
      });
      const detectData = await detectRes.json();
      if (!detectRes.ok) throw new Error(detectData.error || "Detection failed");

      setTemplateId(newTemplateId);
      setVersionId(newVersionId);
      createdTemplateId = null;

      type DetectedItem =
        | { type: "heading"; value: string }
        | { type: "placeholder"; value: string }
        | { type: "repeater"; value: string; subFields: string[] };

      const { items: detectedItems, suggested_heading } = detectData.data as {
        items: DetectedItem[];
        suggested_heading: string | null;
      };
      if (suggested_heading) setFormHeading(suggested_heading);

      let currentHeading = "";
      const initialFields: DetectedField[] = [];
      const newRepeaterIds = new Set<string>();

      for (const item of detectedItems) {
        if (item.type === "heading") {
          currentHeading = item.value;
        } else if (item.type === "repeater") {
          const subFieldConfigs: RepeaterSubFieldConfig[] = (item.subFields ?? []).map((sf: string) => ({
            name: sf,
            label: sf.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            type: "text" as const,
            options: [],
          }));
          const id = crypto.randomUUID();
          newRepeaterIds.add(id);
          initialFields.push({
            id,
            field_name: item.value,
            field_label: item.value.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            field_type: "repeater",
            is_required: false,
            field_options: subFieldConfigs,
            supports_phrase_bank: false,
            section_heading: currentHeading,
          });
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
      setExpandedRepeaters(newRepeaterIds); // auto-expand all detected repeaters
      setActiveStep(1);
    } catch (err: any) {
      setError(err.message);
      if (createdTemplateId) {
        await fetch(`/api/admin/templates/${createdTemplateId}`, { method: "DELETE" }).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 helpers ────────────────────────────────────────────────────────────

  const handleFieldChange = (id: string, prop: keyof DetectedField, value: unknown) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [prop]: value } : f)));
  };

  const handleOptionsChange = (id: string, value: string) => {
    handleFieldChange(id, "field_options", value.split(","));
  };

  const handleAddSubField = (id: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const existing = (f.field_options as RepeaterSubFieldConfig[]) ?? [];
        const n = existing.length + 1;
        return {
          ...f,
          field_options: [
            ...existing,
            { name: `col_${n}`, label: `Column ${n}`, type: "text" as const, options: [] },
          ],
        };
      })
    );
  };

  const handleRemoveSubField = (fieldId: string, colIndex: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        return { ...f, field_options: (f.field_options as RepeaterSubFieldConfig[]).filter((_, i) => i !== colIndex) };
      })
    );
  };

  const handleSubFieldChange = (fieldId: string, colIndex: number, prop: keyof RepeaterSubFieldConfig, value: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const updated = (f.field_options as RepeaterSubFieldConfig[]).map((sf, i) =>
          i === colIndex ? { ...sf, [prop]: value } : sf
        );
        return { ...f, field_options: updated };
      })
    );
  };

  const handleSubFieldOptionsChange = (fieldId: string, colIndex: number, raw: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const updated = (f.field_options as RepeaterSubFieldConfig[]).map((sf, i) =>
          i === colIndex ? { ...sf, _optionsRaw: raw } : sf
        );
        return { ...f, field_options: updated };
      })
    );
  };

  const handleSubFieldOptionsBlur = (fieldId: string, colIndex: number, raw: string) => {
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const updated = (f.field_options as RepeaterSubFieldConfig[]).map((sf, i) => {
          if (i !== colIndex) return sf;
          const { _optionsRaw, ...clean } = sf as any;
          return { ...clean, options: parsed };
        });
        return { ...f, field_options: updated };
      })
    );
  };

  // Toggle offence search on/off for a specific sub-field
  const handleToggleOffenceSearch = (fieldId: string, colIndex: number, enabled: boolean) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const updated = (f.field_options as RepeaterSubFieldConfig[]).map((sf, i) => {
          if (i !== colIndex) return sf;
          return { ...sf, type: enabled ? ("offence_search" as const) : ("text" as const) };
        });
        return { ...f, field_options: updated };
      })
    );
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setExpandedRepeaters((prev) => { const n = new Set(prev); n.delete(id); return n; });
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

  const toggleRepeaterExpanded = (id: string) => {
    setExpandedRepeaters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveFields = async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const cleanedFields = fields.map((f) => {
        if (f.field_type === "repeater") {
          return {
            ...f,
            field_label: f.field_label.trim(),
            field_name: f.field_name.trim(),
            field_options: (f.field_options as RepeaterSubFieldConfig[]).map(({ _optionsRaw, ...sf }: any) => sf),
          };
        }
        return {
          ...f,
          field_label: f.field_label.trim(),
          field_name: f.field_name.trim(),
          field_options: (f.field_options as string[]).map((o) => String(o).trim()).filter((o) => o !== ""),
        };
      });

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <IconButton onClick={handleSaveAndGoBack} sx={{ bgcolor: "#F3F4F6" }}>
          <ArrowLeft size={18} />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>Template Builder</Typography>
          <Typography variant="body2" sx={{ color: "#6B7280" }}>Upload a DOCX, configure fields, then publish</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #E5E7EB" }} elevation={0}>
        <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
          {steps.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

        {/* ── Step 1: Upload ── */}
        {activeStep === 0 && (
          <Box sx={{ maxWidth: 800, mx: "auto" }}>
            <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <Box sx={{ flex: "1 1 300px" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>1. Select DOCX Template</Typography>
                <Paper
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
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
              <Box sx={{ flex: "1 1 300px" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>2. Template Details</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <TextField
                    label="Template Name" fullWidth value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Magistrates Attendance Note" required
                  />
                  <TextField
                    label="Description (Optional)" fullWidth multiline rows={3}
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe when to use this template..."
                  />
                  <Button
                    variant="contained" fullWidth size="large"
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
            {/* Form heading */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography variant="caption" sx={{ color: "#6B7280", display: "block", mb: 1 }}>
                Form Heading <span style={{ color: "#EF4444" }}>*</span>
              </Typography>
              <TextField
                fullWidth value={formHeading}
                onChange={(e) => setFormHeading(e.target.value)}
                placeholder="e.g. COURT ATTENDANCE NOTE"
                required error={formHeading.trim() === ""}
                helperText={formHeading.trim() === "" ? "Form heading is required" : "Displayed at the top of the form"}
                slotProps={{ htmlInput: { style: { textAlign: "center", fontWeight: 800, fontSize: "1.1rem", letterSpacing: 1, textTransform: "uppercase" } } }}
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
                startIcon={<Plus size={16} />} onClick={handleAddField}
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
                  {fields.map((field) => {
                    const isRepeater = field.field_type === "repeater";
                    const isExpanded = expandedRepeaters.has(field.id);
                    const subFields = isRepeater ? (field.field_options as RepeaterSubFieldConfig[]) : [];
                    const offenceSearchCount = subFields.filter((sf) => sf.type === "offence_search").length;

                    return (
                      <Fragment key={field.id}>
                        <TableRow
                          sx={{
                            bgcolor: isRepeater ? "#F7FBF8" : "inherit",
                            // Remove bottom border when repeater is expanded so card flows in
                            "& td": isRepeater && isExpanded ? { borderBottom: "none" } : {},
                          }}
                        >
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Chip
                                label={`{${field.field_name}}`}
                                size="small"
                                sx={{ fontFamily: "monospace", bgcolor: isRepeater ? "#E5EDE8" : "#F3F4F6", fontWeight: 600 }}
                              />
                              {isRepeater && (
                                <Chip
                                  label={`${subFields.length} cols`}
                                  size="small"
                                  sx={{ fontSize: "0.65rem", height: 18, bgcolor: "#395B45", color: "#fff" }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small" fullWidth value={field.field_label}
                              onChange={(e) => handleFieldChange(field.id, "field_label", e.target.value)}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={field.field_type}
                                onChange={(e) => {
                                  handleFieldChange(field.id, "field_type", e.target.value);
                                  if (e.target.value === "repeater" && !isRepeater) {
                                    handleFieldChange(field.id, "field_options", []);
                                    setExpandedRepeaters((prev) => new Set([...prev, field.id]));
                                  }
                                }}
                              >
                                {fieldTypeOptions.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            {field.field_type === "dropdown" ? (
                              <TextField
                                size="small" fullWidth placeholder="Option 1, Option 2, ..."
                                value={
                                  Array.isArray(field.field_options) &&
                                  (field.field_options.length === 0 || typeof (field.field_options as any[])[0] === "string")
                                    ? (field.field_options as string[]).join(",")
                                    : ""
                                }
                                onChange={(e) => handleOptionsChange(field.id, e.target.value)}
                              />
                            ) : isRepeater ? (
                              /* Repeater summary + expand toggle */
                              <Button
                                size="small"
                                onClick={() => toggleRepeaterExpanded(field.id)}
                                endIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                sx={{
                                  textTransform: "none",
                                  fontSize: "0.78rem",
                                  color: "#395B45",
                                  fontWeight: 600,
                                  border: "1px solid #B6D4BE",
                                  borderRadius: 1.5,
                                  px: 1.25,
                                  bgcolor: isExpanded ? "#EAF2EC" : "transparent",
                                  "&:hover": { bgcolor: "#EAF2EC" },
                                }}
                              >
                                {isExpanded ? "Hide columns" : "Configure columns"}
                                {offenceSearchCount > 0 && (
                                  <Box
                                    component="span"
                                    sx={{
                                      ml: 0.75,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 0.3,
                                      bgcolor: "#395B45",
                                      color: "#fff",
                                      borderRadius: 1,
                                      px: 0.6,
                                      py: 0.1,
                                      fontSize: "0.6rem",
                                      fontWeight: 700,
                                    }}
                                  >
                                    <Search size={9} />
                                    {offenceSearchCount}
                                  </Box>
                                )}
                              </Button>
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

                        {/* Repeater sub-field editor — expands inline below the row */}
                        {isRepeater && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                              <Collapse in={isExpanded} unmountOnExit>
                                <Box sx={{ px: 2, pb: 1 }}>
                                  <RepeaterSubFieldEditor
                                    fieldId={field.id}
                                    subFields={subFields}
                                    onSubFieldChange={handleSubFieldChange}
                                    onSubFieldOptionsChange={handleSubFieldOptionsChange}
                                    onSubFieldOptionsBlur={handleSubFieldOptionsBlur}
                                    onAddSubField={handleAddSubField}
                                    onRemoveSubField={handleRemoveSubField}
                                    onToggleOffenceSearch={handleToggleOffenceSearch}
                                  />
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Button
                variant="outlined" onClick={() => setActiveStep(0)}
                sx={{ color: "#374151", borderColor: "#D1D5DB", textTransform: "none" }}
              >
                Back
              </Button>
              <Button
                variant="contained" onClick={handleSaveFields}
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
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{uploadedFile?.name ?? templateName}</Typography>
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
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Offence Search</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(() => {
                      const standalone = fields.filter((f) => f.field_type === "offence_search").length;
                      const repeaters = fields.filter((f) =>
                        f.field_type === "repeater" &&
                        (f.field_options as RepeaterSubFieldConfig[]).some((sf) => sf.type === "offence_search")
                      ).length;
                      const parts = [];
                      if (standalone > 0) parts.push(`${standalone} field${standalone !== 1 ? "s" : ""}`);
                      if (repeaters > 0) parts.push(`${repeaters} repeater${repeaters !== 1 ? "s" : ""}`);
                      return parts.length > 0 ? parts.join(", ") : "None";
                    })()}
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
                variant="outlined" onClick={() => setActiveStep(1)} disabled={publishing}
                sx={{ color: "#374151", borderColor: "#D1D5DB", textTransform: "none", px: 4 }}
              >
                Go Back
              </Button>
              <Button
                variant="contained" onClick={handlePublish} disabled={publishing}
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
          For repeater fields, toggle <strong>Offence Search</strong> on any column to enable live search from the offences database.
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
