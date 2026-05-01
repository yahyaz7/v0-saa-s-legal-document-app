"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  Collapse,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { FileDown, Save, Check, ChevronDown, Plus, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DynamicField, TemplateFieldDef, FieldValue } from "@/components/dynamic-field";
import { saveDraft, loadDraft, DraftFormData } from "@/lib/drafts";
import AutoFillUploader, { ApplyValues } from "@/components/AutoFillUploader";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhraseItem {
  id: string;
  label: string;
  phrase_text: string;
}

interface PhraseCategory {
  id: string;
  name: string;
  phrases: PhraseItem[];
}

type FormValues = Record<string, FieldValue>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function initFormValues(fields: TemplateFieldDef[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.field_type === "checkbox") values[field.field_key] = false;
    else if (field.field_type === "repeater") values[field.field_key] = [];
    else values[field.field_key] = "";
  }
  return values;
}

/**
 * Overlay saved draft values onto a fresh FormValues object.
 * Stale keys from old template versions are silently ignored.
 */
function applyDraftData(base: FormValues, draft: DraftFormData): FormValues {
  const result = { ...base };
  for (const key of Object.keys(result)) {
    if (draft[key] !== undefined) {
      result[key] = draft[key] as FieldValue;
    }
  }
  return result;
}

/** Grid column span — textareas and repeaters take full width, everything else half. */
function fieldColSpan(field: TemplateFieldDef) {
  return field.field_type === "textarea" || field.field_type === "repeater"
    ? { xs: 12 }
    : { xs: 12, sm: 6 };
}

// ── Main component ────────────────────────────────────────────────────────────

function DocumentBuilderContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const draftParam = searchParams.get("draft");

  const [templateName, setTemplateName] = useState("");
  const [formHeading, setFormHeading] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());
  const [draftId, setDraftId] = useState<string | null>(draftParam);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docxStatus, setDocxStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  const [phraseCategories, setPhraseCategories] = useState<PhraseCategory[]>([]);
  const [phraseTargetField, setPhraseTargetField] = useState<string>("");
  const [previewPhrase, setPreviewPhrase] = useState<PhraseItem | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // Last known cursor position in a phrase-bank textarea — used for targeted insertion
  const [cursorPos, setCursorPos] = useState<{ key: string; start: number; end: number } | null>(null);

  // Auto-fill uploader
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoFilledKeys, setAutoFilledKeys] = useState<Set<string>>(new Set());

  // Add Phrase dialog
  const [addPhraseOpen, setAddPhraseOpen] = useState(false);
  const [addPhraseForm, setAddPhraseForm] = useState({ category_id: "", label: "", phrase_text: "" });
  const [addPhraseSaving, setAddPhraseSaving] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId) {
      setFetchError("No template selected. Go back to Templates and choose one.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetchData() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUserId(authUser?.id ?? null);
      try {
        setLoading(true);

        // 1. Active version + template name
        const { data: versionData, error: vError } = await supabase
          .from("template_versions")
          .select("id, template_id, form_heading, templates (name)")
          .eq("template_id", templateId)
          .eq("is_active", true)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (vError || !versionData) throw new Error("Template version not found");

        setTemplateName((versionData.templates as any).name);
        setFormHeading((versionData as any).form_heading ?? null);

        // 2. Fields for this version
        const { data: fieldsData, error: fError } = await supabase
          .from("template_fields")
          .select("*")
          .eq("template_version_id", versionData.id)
          .order("field_order");

        if (fError) throw fError;

        const fields = (fieldsData ?? []).map((f: any): TemplateFieldDef => ({
          ...f,
          // Ensure repeater field_options are always a valid array of sub-field objects
          field_options: f.field_type === "repeater"
            ? (Array.isArray(f.field_options) ? f.field_options : [])
            : (f.field_options ?? null),
        }));
        setTemplateFields(fields);

        // 3. Initialise form values (optionally hydrated from a saved draft)
        const base = initFormValues(fields);
        if (draftParam) {
          const draftData = await loadDraft(supabase, draftParam);
          setFormValues(draftData ? applyDraftData(base, draftData) : base);
        } else {
          // Always pre-fill delay fields with N/A for new documents
          if (base["delay_over_45_mins"] === "") base["delay_over_45_mins"] = "N/A";
          if (base["reasons_for_delay"] === "") base["reasons_for_delay"] = "N/A";
          setFormValues(base);
        }

        // 4. Firm phrase bank
        const phrasesRes = await fetch("/api/phrases");
        if (phrasesRes.ok) {
          const phrasesJson = await phrasesRes.json();
          if (phrasesJson.data) {
            setPhraseCategories(phrasesJson.data);
            if (phrasesJson.data.length > 0) setExpandedCategory(phrasesJson.data[0].id);
          }
        }
      } catch (err: any) {
        setFetchError(err.message || "Failed to load template data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [templateId, draftParam]);

  // ── Sections: group consecutive fields sharing the same section_heading ──────
  const sections = useMemo(() => {
    if (templateFields.length === 0) return [];
    const sorted = [...templateFields].sort((a, b) => a.field_order - b.field_order);
    const result: Array<{ heading: string; fields: TemplateFieldDef[] }> = [];
    for (const field of sorted) {
      const heading = field.section_heading ?? "";
      const last = result[result.length - 1];
      if (!last || last.heading !== heading) {
        result.push({ heading, fields: [field] });
      } else {
        last.fields.push(field);
      }
    }
    return result;
  }, [templateFields]);

  // ── Auto-fill rules for arrest_VA field ───────────────────────────────────
  const PACE_AUTOFILL_KEYS = ["time_of_advice_call_to_client", "delay_over_45_mins", "reasons_for_delay", "left_details_with_custody", "requested_for_interview", "custody_record_checked"];

  const PACE_AUTOFILL: Record<string, Record<string, string>> = {
    VA: {
      time_of_advice_call_to_client: "Advice call not claimed – attendance was for voluntary interview; advice provided in person.",
      delay_over_45_mins: "N.A.",
      reasons_for_delay: "N.A.",
      left_details_with_custody: "N/A",
      requested_for_interview: "Yes",
      custody_record_checked: "N/A",
    },
    ARREST: {
      time_of_advice_call_to_client: "Advice call completed @ [TIME] – client advised in respect of confidentiality, the PACE clock, and the procedure to be followed.",
      delay_over_45_mins: "N.A.",
      reasons_for_delay: "N.A.",
      left_details_with_custody: "N/A",
      requested_for_interview: "Yes",
      custody_record_checked: "Yes",
    },
  };

  // ── Form handlers ──────────────────────────────────────────────────────────
  function handleFieldChange(key: string, value: FieldValue) {
    // Validation logic for time-based fields
    if (typeof value === "string" && value.trim()) {
      let totalMinutes = 0;
      let isValid = true;
      let error = "";

      const timeMatch = value.match(/^(\d+):([0-5]\d)$/);
      if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        if (m % 6 !== 0) {
          isValid = false;
          error = "Minutes must be a multiple of 6";
        }
        totalMinutes = h * 60 + m;
      } else {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
          isValid = false;
          error = "Invalid format (use minutes or H:MM)";
        } else if (num % 6 !== 0) {
          isValid = false;
          error = "Must be a multiple of 6 minutes";
        }
        totalMinutes = num;
      }

      if (isValid) {
        if (key.match(/^travel_time_\d$/) || key.match(/^travel\s_time_\d$/) || key.match(/^waiting_\d$/)) {
          if (totalMinutes > 360) {
            setFieldErrors((prev) => ({ ...prev, [key]: "Maximum 6 hours allowed" }));
          } else {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
          }
        }
        if (key.match(/^advice_inst_\d$/)) {
          if (totalMinutes > 360) {
            setFieldErrors((prev) => ({ ...prev, [key]: "Maximum 6 hours (360 mins) allowed" }));
          } else {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
          }
        }
      } else if (error && (key.match(/^(travel_time_|travel\s_time_|waiting_|advice_inst_)/))) {
        setFieldErrors((prev) => ({ ...prev, [key]: error }));
      }
    }

    const lowerKey = key.toLowerCase();
    if (lowerKey === "arrest_va") {
      const normalized = typeof value === "string" ? value.replace(/\./g, "").trim().toUpperCase() : "";
      const autofill = PACE_AUTOFILL[normalized];
      if (autofill) {
        setFormValues((prev) => ({ ...prev, [key]: value, ...autofill }));
        setLockedKeys(new Set(PACE_AUTOFILL_KEYS));
      } else {
        const cleared = Object.fromEntries(PACE_AUTOFILL_KEYS.map((k) => [k, ""]));
        setFormValues((prev) => ({ ...prev, [key]: value, ...cleared }));
        setLockedKeys(new Set());
      }
    } else {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    }
    if (fieldErrors[key] && !key.match(/^(travel_time_|travel\s_time_|waiting_|advice_inst_)/)) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of templateFields) {
      if (field.is_required) {
        const val = formValues[field.field_key];
        if (field.field_type === "repeater") {
          if (!Array.isArray(val) || (val as any[]).length === 0) {
            errors[field.field_key] = `${field.field_label} requires at least one row`;
          }
        } else if (field.field_type !== "checkbox") {
          if (!val || (typeof val === "string" && !val.trim())) {
            errors[field.field_key] = `${field.field_label} is required`;
          }
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Phrase bank ────────────────────────────────────────────────────────────

  /** "Insert into" dropdown options — only fields with phrase bank enabled. */
  const phraseTargetOptions = useMemo(() => {
    const opts = templateFields
      .filter((f) => f.supports_phrase_bank)
      .sort((a, b) => a.field_order - b.field_order)
      .map((f) => ({ key: f.field_key, label: f.field_label }));
    if (opts.length > 0 && !phraseTargetField) setPhraseTargetField(opts[0].key);
    return opts;
  }, [templateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Insert phrase text at the last known cursor position, or append if unknown. */
  function handleInsertPhrase(phraseText: string) {
    if (!phraseTargetField) return;
    const current = (formValues[phraseTargetField] as string) ?? "";

    let updated: string;
    if (cursorPos?.key === phraseTargetField) {
      // Insert at cursor, replacing any selected text
      const { start, end } = cursorPos;
      updated = current.slice(0, start) + phraseText + current.slice(end);
      // Advance cursor to end of inserted text
      setCursorPos({ key: phraseTargetField, start: start + phraseText.length, end: start + phraseText.length });
    } else {
      // Fallback: append at end with a single newline separator
      updated = current ? `${current}\n${phraseText}` : phraseText;
    }

    handleFieldChange(phraseTargetField, updated);
    showSnackbar("Phrase inserted.", "success");
  }

  /** Capture cursor position when a phrase-bank textarea loses focus. */
  function handleFieldBlur(key: string, start: number, end: number) {
    if (templateFields.find((f) => f.field_key === key)?.supports_phrase_bank) {
      setCursorPos({ key, start, end });
    }
  }

  /** Auto-switch the target field when a phrase-bank-enabled textarea gains focus. */
  function handleFieldFocus(key: string) {
    if (templateFields.find((f) => f.field_key === key)?.supports_phrase_bank) {
      setPhraseTargetField(key);
    }
  }

  // ── Add phrase (staff user) ────────────────────────────────────────────────
  async function handleAddPhrase() {
    const { category_id, label, phrase_text } = addPhraseForm;
    if (!category_id || !label.trim() || !phrase_text.trim()) return;
    setAddPhraseSaving(true);
    try {
      const res = await fetch("/api/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id, label: label.trim(), phrase_text: phrase_text.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save phrase");
      // Refresh phrase list
      const refreshed = await fetch("/api/phrases");
      if (refreshed.ok) {
        const json = await refreshed.json();
        if (json.data) setPhraseCategories(json.data);
      }
      setAddPhraseOpen(false);
      setAddPhraseForm({ category_id: "", label: "", phrase_text: "" });
      showSnackbar("Phrase added.", "success");
    } catch {
      showSnackbar("Failed to add phrase. Please try again.", "error");
    } finally {
      setAddPhraseSaving(false);
    }
  }

  // ── Auto-fill apply ────────────────────────────────────────────────────────
  function handleAutoFillApply(values: ApplyValues, keys: Set<string>) {
    setFormValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(values)) {
        next[k] = v as FieldValue;
      }
      return next;
    });
    setAutoFilledKeys(keys);
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    showSnackbar(`Auto-filled ${keys.size} field${keys.size !== 1 ? "s" : ""} from document.`, "success");
  }

  // ── Snackbar helper ────────────────────────────────────────────────────────
  function showSnackbar(message: string, severity: "success" | "error") {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }

  // ── Save draft ─────────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!templateId || !userId) { showSnackbar("Cannot save: not signed in.", "error"); return; }
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      const id = await saveDraft({ supabase, userId, templateId, formData: formValues, draftId });
      if (!draftId) {
        // First save — update URL so a refresh reloads this draft
        const url = new URL(window.location.href);
        url.searchParams.set("draft", id);
        window.history.replaceState(null, "", url.toString());
      }
      setDraftId(id);
      setSaveStatus("saved");
      showSnackbar(draftId ? "Draft updated." : "Draft saved.", "success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      showSnackbar("Failed to save draft. Please try again.", "error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // ── Generate DOCX ──────────────────────────────────────────────────────────
  async function handleGenerateDocx() {
    if (!validate()) return;
    if (!templateId || !userId) { showSnackbar("Cannot generate: not signed in.", "error"); return; }
    setDocxStatus("generating");
    try {
      const response = await fetch("/api/generate-docx", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ templateId, formData: formValues, draftId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }
      const blob = await response.blob();
      // Use the server-generated filename from Content-Disposition if present
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const serverName = disposition.match(/filename="([^"]+)"/)?.[1];
      const fileName = serverName || `${templateName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.docx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDocxStatus("done");

      // Warn user if some template placeholders were unfilled
      const unmatched = response.headers.get("X-Unmatched-Placeholders");
      if (unmatched) {
        showSnackbar(
          `Document downloaded, but some fields were blank: ${unmatched.split(",").join(", ")}. Check that your template field names match exactly.`,
          "error"
        );
      } else {
        showSnackbar("DOCX generated and downloaded.", "success");
      }
      setTimeout(() => setDocxStatus("idle"), 3000);
    } catch (err: any) {
      setDocxStatus("error");
      showSnackbar(err.message || "Failed to generate DOCX.", "error");
      setTimeout(() => setDocxStatus("idle"), 3000);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
            New Document
          </Typography>
          <Typography variant="body1" sx={{ color: "#666666" }}>
            {draftParam ? "Editing saved draft — " : "Using template: "}
            <strong>{templateName || (loading ? "Loading…" : "Unknown")}</strong>
          </Typography>
        </Box>
        {!loading && !fetchError && templateFields.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<Sparkles size={16} />}
            onClick={() => setAutoFillOpen(true)}
            sx={{
              borderColor: "#395B45",
              color: "#395B45",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { borderColor: "#2D4A38", bgcolor: "rgba(57,91,69,0.04)" },
            }}
          >
            Auto-fill from Document
          </Button>
        )}
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {fetchError && <Alert severity="error" sx={{ mb: 3 }}>{fetchError}</Alert>}

      {!loading && !fetchError && (
        <Grid container spacing={3} alignItems="flex-start">
          {/* ── LEFT: Dynamic form ─────────────────────────────────────── */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              {formHeading && (
                <Box sx={{ mb: 3, pb: 2, borderBottom: "2px solid #E5E7EB", textAlign: "center" }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 1, color: "#111827", textTransform: "uppercase" }}>
                    {formHeading}
                  </Typography>
                </Box>
              )}
              {sections.map((section, idx) => (
                <Box key={`section-${idx}`}>
                  {section.heading && (
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, mb: 2, mt: idx > 0 ? 1 : 0, color: "#1A1A1A" }}
                    >
                      {section.heading}
                    </Typography>
                  )}
                  <Grid container spacing={2}>
                    {section.fields.map((field) => (
                      <Grid item xs={fieldColSpan(field).xs} sm={fieldColSpan(field).sm} key={field.field_key}>
                        <DynamicField
                          field={field}
                          value={formValues[field.field_key] ?? ""}
                          onChange={handleFieldChange}
                          onFocus={handleFieldFocus}
                          onBlur={handleFieldBlur}
                          error={fieldErrors[field.field_key]}
                          readOnly={lockedKeys.has(field.field_key) && field.field_key !== "time_of_advice_call_to_client"}
                          autoFilled={lockedKeys.has(field.field_key) || autoFilledKeys.has(field.field_key)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {idx < sections.length - 1 && <Divider sx={{ my: 3 }} />}
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* ── RIGHT: Phrase Bank — sticky sidebar ──────────────────── */}
          <Grid
            item xs={12} md={4}
            sx={{
              position: { md: "sticky" },
              top: { md: 24 },
              maxHeight: { md: "calc(100vh - 140px)" },
              overflowY: { md: "auto" },
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Paper
              elevation={0}
              sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}
            >
              {/* Panel header */}
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #E5E7EB", bgcolor: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827" }}>
                    Phrase Bank
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>
                    Click a phrase to insert it into the selected field
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<Plus size={14} />}
                  onClick={() => {
                    setAddPhraseForm({ category_id: phraseCategories[0]?.id ?? "", label: "", phrase_text: "" });
                    setAddPhraseOpen(true);
                  }}
                  sx={{ color: "#395B45", fontWeight: 600, textTransform: "none", flexShrink: 0, ml: 1 }}
                >
                  Add
                </Button>
              </Box>

              <Box sx={{ p: 2, flex: 1, overflowY: "auto", minHeight: 0 }}>
                {phraseTargetOptions.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center", py: 4 }}>
                    No fields in this template have phrase bank enabled.
                  </Typography>
                ) : (
                  <>
                    {/* Target field selector */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Insert into</InputLabel>
                      <Select
                        value={phraseTargetField}
                        label="Insert into"
                        onChange={(e) => setPhraseTargetField(e.target.value)}
                      >
                        {phraseTargetOptions.map(({ key, label }) => (
                          <MenuItem key={key} value={key}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Phrase list — accordion by category, fills remaining panel height */}
                    <Box sx={{ overflowY: "auto", mx: -0.5 }}>
                      {phraseCategories.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center", py: 4 }}>
                          No phrases added yet. Ask your admin to add phrases.
                        </Typography>
                      ) : (
                        phraseCategories.map((cat, idx) => {
                          const isOpen = expandedCategory === cat.id;
                          return (
                            <Box
                              key={cat.id}
                              sx={{
                                border: "1px solid #E5E7EB",
                                borderRadius: 2,
                                mb: 1,
                                overflow: "hidden",
                                boxShadow: isOpen ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                                transition: "box-shadow 0.2s",
                              }}
                            >
                              {/* Category header — clickable toggle */}
                              <Box
                                onClick={() => setExpandedCategory(isOpen ? null : cat.id)}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  px: 1.5,
                                  py: 1.25,
                                  cursor: "pointer",
                                  bgcolor: isOpen ? "#F0F5F1" : "#F9FAFB",
                                  borderBottom: isOpen ? "1px solid #E5E7EB" : "none",
                                  transition: "background-color 0.15s",
                                  "&:hover": { bgcolor: "#EBF2EC" },
                                  userSelect: "none",
                                }}
                              >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827" }}>
                                    {cat.name}
                                  </Typography>
                                  <Box
                                    sx={{
                                      bgcolor: isOpen ? "#395B45" : "#E5E7EB",
                                      color: isOpen ? "#fff" : "#6B7280",
                                      borderRadius: 10,
                                      px: 0.75,
                                      py: 0.1,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      lineHeight: 1.6,
                                      minWidth: 20,
                                      textAlign: "center",
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    {cat.phrases.length}
                                  </Box>
                                </Box>
                                <Box
                                  sx={{
                                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                    display: "flex",
                                    color: "#6B7280",
                                  }}
                                >
                                  <ChevronDown size={16} />
                                </Box>
                              </Box>

                              {/* Phrases — collapsed by default */}
                              <Collapse in={isOpen} timeout={200}>
                                <Box sx={{ p: 1, bgcolor: "#fff" }}>
                                  {cat.phrases.length === 0 ? (
                                    <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", textAlign: "center", py: 1.5 }}>
                                      No phrases in this category.
                                    </Typography>
                                  ) : (
                                    cat.phrases.map((phrase) => (
                                      <Box
                                        key={phrase.id}
                                        onClick={() => setPreviewPhrase(phrase)}
                                        sx={{
                                          px: 1.25,
                                          py: 1,
                                          mb: 0.5,
                                          borderRadius: 1.5,
                                          cursor: "pointer",
                                          border: "1px solid transparent",
                                          transition: "all 0.15s",
                                          "&:hover": {
                                            bgcolor: "rgba(57,91,69,0.06)",
                                            border: "1px solid #C4D9C8",
                                          },
                                          "&:last-child": { mb: 0 },
                                        }}
                                      >
                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 700, fontSize: 13, color: "#111827", lineHeight: 1.4, mb: 0.25 }}
                                        >
                                          {phrase.label || "—"}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "#6B7280",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            lineHeight: 1.4,
                                          }}
                                        >
                                          {phrase.phrase_text}
                                        </Typography>
                                      </Box>
                                    ))
                                  )}
                                </Box>
                              </Collapse>
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Fixed bottom action bar */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 240,
          right: 0,
          p: 2,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 2,
          borderTop: "1px solid #E0E0E0",
          zIndex: 1000,
        }}
      >
        {draftId && (
          <Typography variant="caption" sx={{ color: "#999", mr: "auto" }}>
            Draft ID: {draftId.slice(0, 8)}…
          </Typography>
        )}
        <Button
          variant="outlined"
          color={saveStatus === "error" ? "error" : "primary"}
          startIcon={
            saveStatus === "saving" ? <CircularProgress size={14} color="inherit" /> :
            saveStatus === "saved"  ? <Check size={16} /> :
            <Save size={16} />
          }
          onClick={handleSaveDraft}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save Draft"}
        </Button>
        <Button
          variant="contained"
          color={docxStatus === "error" ? "error" : "primary"}
          startIcon={
            docxStatus === "generating" ? <CircularProgress size={14} color="inherit" /> :
            docxStatus === "done"       ? <Check size={16} /> :
            <FileDown size={16} />
          }
          onClick={handleGenerateDocx}
          disabled={docxStatus === "generating"}
        >
          {docxStatus === "generating" ? "Generating…" : docxStatus === "done" ? "Downloaded" : "Generate DOCX"}
        </Button>
      </Paper>

      {/* Add Phrase dialog */}
      <Dialog open={addPhraseOpen} onClose={() => setAddPhraseOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Add Phrase</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={addPhraseForm.category_id}
              label="Category"
              onChange={(e) => setAddPhraseForm((p) => ({ ...p, category_id: e.target.value }))}
            >
              {phraseCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Label"
            fullWidth
            size="small"
            value={addPhraseForm.label}
            onChange={(e) => setAddPhraseForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="e.g. No Comment Advice"
            required
          />
          <TextField
            label="Phrase Text"
            fullWidth
            multiline
            rows={5}
            size="small"
            value={addPhraseForm.phrase_text}
            onChange={(e) => setAddPhraseForm((p) => ({ ...p, phrase_text: e.target.value }))}
            placeholder="Enter the full legal phrase here…"
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setAddPhraseOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!addPhraseForm.category_id || !addPhraseForm.label.trim() || !addPhraseForm.phrase_text.trim() || addPhraseSaving}
            onClick={handleAddPhrase}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            {addPhraseSaving ? "Saving…" : "Save Phrase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Phrase preview dialog */}
      <Dialog
        open={!!previewPhrase}
        onClose={() => setPreviewPhrase(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {previewPhrase?.label || "Phrase"}
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", color: "#374151", lineHeight: 1.7 }}
          >
            {previewPhrase?.phrase_text}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setPreviewPhrase(null)}
            sx={{ color: "#6B7280", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (previewPhrase) handleInsertPhrase(previewPhrase.phrase_text);
              setPreviewPhrase(null);
            }}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            Insert into Field
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Auto-fill uploader dialog */}
      <AutoFillUploader
        open={autoFillOpen}
        onClose={() => setAutoFillOpen(false)}
        templateFields={templateFields.map((f) => ({
          field_key: f.field_key,
          field_label: f.field_label,
          field_type: f.field_type,
          field_options: f.field_options,
        }))}
        onApply={handleAutoFillApply}
      />
    </Box>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><CircularProgress /></Box>}>
      <DocumentBuilderContent />
    </Suspense>
  );
}
