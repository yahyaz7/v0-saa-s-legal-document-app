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
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import { FileDown, Save, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DynamicField, TemplateFieldDef, FieldValue } from "@/components/dynamic-field";
import { saveDraft, loadDraft, DraftFormData } from "@/lib/drafts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhraseItem {
  id: string;
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
    values[field.field_key] = field.field_type === "checkbox" ? false : "";
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

/** Grid column span — textareas take full width, everything else half. */
function fieldColSpan(field: TemplateFieldDef) {
  return field.field_type === "textarea" ? { xs: 12 } : { xs: 12, sm: 6 };
}

// ── Main component ────────────────────────────────────────────────────────────

function DocumentBuilderContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const draftParam = searchParams.get("draft");

  const [templateName, setTemplateName] = useState("");
  const [templateFields, setTemplateFields] = useState<TemplateFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [draftId, setDraftId] = useState<string | null>(draftParam);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docxStatus, setDocxStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  const [phraseCategories, setPhraseCategories] = useState<PhraseCategory[]>([]);
  const [phraseTargetField, setPhraseTargetField] = useState<string>("");

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
          .select("id, template_id, templates (name)")
          .eq("template_id", templateId)
          .eq("is_active", true)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (vError || !versionData) throw new Error("Template version not found");

        setTemplateName((versionData.templates as any).name);

        // 2. Fields for this version
        const { data: fieldsData, error: fError } = await supabase
          .from("template_fields")
          .select("*")
          .eq("template_version_id", versionData.id)
          .order("field_order");

        if (fError) throw fError;

        const fields = (fieldsData ?? []) as TemplateFieldDef[];
        setTemplateFields(fields);

        // 3. Initialise form values (optionally hydrated from a saved draft)
        const base = initFormValues(fields);
        if (draftParam) {
          const draftData = await loadDraft(supabase, draftParam);
          setFormValues(draftData ? applyDraftData(base, draftData) : base);
        } else {
          setFormValues(base);
        }

        // 4. Firm phrase bank
        const phrasesRes = await fetch("/api/phrases");
        if (phrasesRes.ok) {
          const phrasesJson = await phrasesRes.json();
          if (phrasesJson.data) setPhraseCategories(phrasesJson.data);
        }
      } catch (err: any) {
        setFetchError(err.message || "Failed to load template data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [templateId, draftParam]);

  // ── Sections (single group ordered by field_order) ─────────────────────────
  const sections = useMemo(() => {
    if (templateFields.length === 0) return [];
    return [{
      name: "Document Fields",
      fields: [...templateFields].sort((a, b) => a.field_order - b.field_order),
    }];
  }, [templateFields]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  function handleFieldChange(key: string, value: FieldValue) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of templateFields) {
      if (field.is_required) {
        const val = formValues[field.field_key];
        if (!val || (typeof val === "string" && !val.trim())) {
          errors[field.field_key] = `${field.field_label} is required`;
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

  /** Append phrase text to the selected target field. */
  function handleInsertPhrase(phraseText: string) {
    if (!phraseTargetField) return;
    const current = (formValues[phraseTargetField] as string) ?? "";
    handleFieldChange(phraseTargetField, current.trim() ? `${current}\n\n${phraseText}` : phraseText);
    showSnackbar("Phrase inserted.", "success");
  }

  /** Auto-switch the target field when a phrase-bank-enabled textarea gains focus. */
  function handleFieldFocus(key: string) {
    if (templateFields.find((f) => f.field_key === key)?.supports_phrase_bank) {
      setPhraseTargetField(key);
    }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, formData: formValues }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }
      const blob = await response.blob();
      const fileName = `${templateName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.docx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDocxStatus("done");
      showSnackbar("DOCX generated and downloaded.", "success");
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          New Document
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          {draftParam ? "Editing saved draft — " : "Using template: "}
          <strong>{templateName || (loading ? "Loading…" : "Unknown")}</strong>
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {fetchError && <Alert severity="error" sx={{ mb: 3 }}>{fetchError}</Alert>}

      {!loading && !fetchError && (
        <Grid container spacing={3}>
          {/* ── LEFT: Dynamic form ─────────────────────────────────────── */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              {sections.map((section, idx) => (
                <Box key={section.name}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: "#1A1A1A" }}>
                    {section.name}
                  </Typography>
                  <Grid container spacing={2}>
                    {section.fields.map((field) => (
                      <Grid item xs={fieldColSpan(field).xs} sm={fieldColSpan(field).sm} key={field.field_key}>
                        <DynamicField
                          field={field}
                          value={formValues[field.field_key] ?? ""}
                          onChange={handleFieldChange}
                          onFocus={handleFieldFocus}
                          error={fieldErrors[field.field_key]}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {idx < sections.length - 1 && <Divider sx={{ my: 3 }} />}
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* ── RIGHT: Phrase Bank ─────────────────────────────────────── */}
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
              {/* Panel header */}
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #E5E7EB", bgcolor: "#F9FAFB" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827" }}>
                  Phrase Bank
                </Typography>
                <Typography variant="caption" sx={{ color: "#6B7280" }}>
                  Click a phrase to insert it into the selected field
                </Typography>
              </Box>

              <Box sx={{ p: 2 }}>
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

                    {/* Phrase list grouped by category */}
                    <Box sx={{ maxHeight: 460, overflowY: "auto" }}>
                      {phraseCategories.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center", py: 4 }}>
                          No phrases added yet. Ask your admin to add phrases.
                        </Typography>
                      ) : (
                        phraseCategories.map((cat) => (
                          <Box key={cat.id} sx={{ mb: 2 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: "#6B7280",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                                mb: 0.75,
                              }}
                            >
                              {cat.name} ({cat.phrases.length})
                            </Typography>
                            {cat.phrases.map((phrase) => (
                              <Box
                                key={phrase.id}
                                onClick={() => handleInsertPhrase(phrase.phrase_text)}
                                sx={{
                                  p: 1.5,
                                  mb: 0.75,
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 1,
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                  "&:hover": {
                                    bgcolor: "rgba(57,91,69,0.06)",
                                    borderColor: "#395B45",
                                  },
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontSize: 12,
                                    color: "#374151",
                                    lineHeight: 1.5,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {phrase.phrase_text}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ))
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
