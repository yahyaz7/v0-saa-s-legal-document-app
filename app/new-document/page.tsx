"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Switch,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  Snackbar,
} from "@mui/material";
import { Plus, FileDown, Save, Sparkles, Check } from "lucide-react";
import { ExtractedField } from "@/lib/app-context";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function TabPanel({
  children,
  value,
  index,
}: {
  children: React.ReactNode;
  value: number;
  index: number;
}) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ py: 2 }}>
      {value === index && children}
    </Box>
  );
}

type FormValues = Record<string, FieldValue>;

function initFormValues(fields: TemplateFieldDef[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    values[field.field_key] = field.field_type === "checkbox" ? false : "";
  }
  return values;
}

/**
 * Overlay saved draft data onto a freshly-initialised FormValues object.
 * Only keys that exist in the current template are applied, so stale keys
 * from an old template version are silently ignored.
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

/** Returns the Grid column span for a field based on its type. */
function fieldColSpan(field: TemplateFieldDef) {
  if (field.field_type === "textarea") {
    return { xs: 12 };
  }
  return { xs: 12, sm: 6 };
}

// ── Main component ────────────────────────────────────────────────────────────

function DocumentBuilderContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const draftParam = searchParams.get("draft"); // present when opening a saved draft

  // Template metadata + fields from DB
  const [templateName, setTemplateName] = useState("");
  const [templateFields, setTemplateFields] = useState<TemplateFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [formValues, setFormValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Draft state — seed from URL so re-saves UPDATE the same row
  const [draftId, setDraftId] = useState<string | null>(draftParam);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docxStatus, setDocxStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  // Phrase bank state
  const [phraseCategories, setPhraseCategories] = useState<PhraseCategory[]>([]);
  const [phraseTargetField, setPhraseTargetField] = useState<string>("");

  // Right-panel state (unchanged from original)
  const [tabValue, setTabValue] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId) {
      setFetchError("No template selected. Go back to Templates and choose one.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetchData() {
      try {
        setLoading(true);
        // 1. Get Template & Active Version
        const { data: versionData, error: vError } = await supabase
          .from("template_versions")
          .select(`
            id,
            template_id,
            templates (name)
          `)
          .eq("template_id", templateId)
          .eq("is_active", true)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (vError || !versionData) throw new Error("Template version not found");

        setTemplateName((versionData.templates as any).name);
        const versionId = versionData.id;

        // 2. Fetch Fields for this version
        const { data: fieldsData, error: fError } = await supabase
          .from("template_fields")
          .select("*")
          .eq("template_version_id", versionId)
          .order("field_order");

        if (fError) throw fError;

        const fields = (fieldsData ?? []) as TemplateFieldDef[];
        setTemplateFields(fields);
        
        // 3. Initialise Form
        const base = initFormValues(fields);
        
        // 4. Load Draft if present
        if (draftParam) {
          const draftData = await loadDraft(supabase, draftParam);
          setFormValues(draftData ? applyDraftData(base, draftData) : base);
        } else {
          setFormValues(base);
        }

        // 5. Load Phrases from firm's phrase bank
        const phrasesRes = await fetch("/api/phrases");
        if (phrasesRes.ok) {
          const phrasesJson = await phrasesRes.json();
          if (phrasesJson.data) setPhraseCategories(phrasesJson.data);
        }

        setLoading(false);
      } catch (err: any) {
        setFetchError(err.message || "Failed to load template data");
        setLoading(false);
      }
    }

    supabase.auth.getUser().then(({ data }: { data: any }) => setUserId(data.user?.id ?? null));
    fetchData();
  }, [templateId, draftParam]);

  // ── Section grouping ───────────────────────────────────────────────────────
  // Phase 2 schema has no section column — all fields render in a single group,
  // ordered by field_order.
  const sections = useMemo(() => {
    if (templateFields.length === 0) return [];
    return [{
      name: "Document Fields",
      fields: [...templateFields].sort((a, b) => a.field_order - b.field_order),
    }];
  }, [templateFields]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleFieldChange = (key: string, value: FieldValue) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
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
  };

  // ── Phrase bank ────────────────────────────────────────────────────────────

  /** Fields that have phrase bank support enabled — drives the "Insert into" dropdown. */
  const phraseTargetOptions = useMemo(() => {
    const opts = templateFields
      .filter((f) => f.supports_phrase_bank)
      .sort((a, b) => a.field_order - b.field_order)
      .map((f) => ({ key: f.field_key, label: f.field_label }));
    // Auto-select first eligible field once template loads
    if (opts.length > 0 && !phraseTargetField) {
      setPhraseTargetField(opts[0].key);
    }
    return opts;
  }, [templateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Append phrase text to the target field, separated by a blank line. */
  const handleInsertPhrase = (phraseText: string) => {
    if (!phraseTargetField) return;
    const current = (formValues[phraseTargetField] as string) ?? "";
    const updated = current.trim() ? `${current}\n\n${phraseText}` : phraseText;
    handleFieldChange(phraseTargetField, updated);
    setSnackbarMessage("Phrase inserted.");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  /** When a phrase-bank-enabled field gains focus, auto-switch the target dropdown. */
  const handleFieldFocus = (key: string) => {
    const field = templateFields.find((f) => f.field_key === key);
    if (field?.supports_phrase_bank) {
      setPhraseTargetField(key);
    }
  };

  // ── Save draft ─────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!templateId || !userId) {
      setSnackbarMessage("Cannot save: not signed in.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    setSaveStatus("saving");

    try {
      const supabase = createClient();
      const id = await saveDraft({
        supabase,
        userId,
        templateId,
        formData: formValues,
        draftId,
      });
      setDraftId(id);
      setSaveStatus("saved");
      setSnackbarMessage(draftId ? "Draft updated." : "Draft saved.");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
      // Reset button back to idle after a short pause
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Save draft error:", err);
      setSaveStatus("error");
      setSnackbarMessage("Failed to save draft. Please try again.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // ── Generate DOCX ──────────────────────────────────────────────────────────
  const handleGenerateDocx = async () => {
    if (!validate()) return;
    if (!templateId || !userId) {
      setSnackbarMessage("Cannot generate: not signed in.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    setDocxStatus("generating");

    try {
      const response = await fetch("/api/generate-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          formData: formValues,
          // We could also pass versionId if we want to pin it
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }

      const blob = await response.blob();
      const fileName = `${templateName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.docx`;

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setDocxStatus("done");
      setSnackbarMessage("DOCX generated and downloaded.");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
      setTimeout(() => setDocxStatus("idle"), 3000);
    } catch (err: any) {
      console.error("DOCX generation error:", err);
      setDocxStatus("error");
      setSnackbarMessage(err.message || "Failed to generate DOCX.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      setTimeout(() => setDocxStatus("idle"), 3000);
    }
  };

  // ── Right-panel handlers (unchanged) ──────────────────────────────────────
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExtractFields = () => {
    const mockFields: ExtractedField[] = [
      { id: "1", fieldName: "Defendant Name", suggestedValue: "John Smith", confidence: 95, approved: false },
      { id: "2", fieldName: "Case Reference", suggestedValue: "CR-2024-001234", confidence: 88, approved: false },
      { id: "3", fieldName: "Court Name", suggestedValue: "Crown Court, London", confidence: 92, approved: false },
      { id: "4", fieldName: "Offence Date", suggestedValue: "15 January 2024", confidence: 85, approved: false },
    ];
    setExtractedFields(mockFields);
    setTabValue(2);
  };

  const handleFieldApproval = (id: string, approved: boolean) => {
    setExtractedFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, approved } : f))
    );
  };

  const handleExtractedValueChange = (id: string, value: string) => {
    setExtractedFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, suggestedValue: value } : f))
    );
  };

  const getConfidenceColor = (
    confidence: number
  ): "success" | "warning" | "error" => {
    if (confidence >= 90) return "success";
    if (confidence >= 70) return "warning";
    return "error";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ pb: 10 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          New Document
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          {draftParam ? "Editing saved draft — " : "Using template: "}
          <strong>{templateName || (loading ? "Loading…" : "Unknown")}</strong>
        </Typography>
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error */}
      {fetchError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {fetchError}
        </Alert>
      )}

      {/* Main layout */}
      {!loading && !fetchError && (
        <Grid container spacing={3}>
          {/* ── LEFT: Dynamic form ────────────────────────────────────────── */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              {sections.map((section, sectionIdx) => (
                <Box key={section.name}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, mb: 2, color: "#1A1A1A" }}
                  >
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

                  {sectionIdx < sections.length - 1 && (
                    <Divider sx={{ my: 3 }} />
                  )}
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* ── RIGHT: Phrase bank & AI tools (unchanged) ─────────────────── */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 0, overflow: "hidden" }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  borderBottom: "1px solid #E0E0E0",
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: 13,
                  },
                }}
              >
                <Tab label="Suggested Phrases" />
                <Tab label="Paste Source" />
                <Tab label="Extracted Fields" />
              </Tabs>

              {/* Tab 0 – Phrase Bank */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ px: 2 }}>
                  {phraseTargetOptions.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "#666666", textAlign: "center", py: 4 }}>
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

                      {/* Phrases grouped by category */}
                      <Box sx={{ maxHeight: 430, overflow: "auto" }}>
                        {phraseCategories.length === 0 ? (
                          <Typography variant="body2" sx={{ color: "#666666", textAlign: "center", py: 4 }}>
                            No phrases added yet. Ask your admin to add phrases.
                          </Typography>
                        ) : (
                          phraseCategories.map((cat) => (
                            <Box key={cat.id} sx={{ mb: 2 }}>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.5 }}
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
                                    "&:hover": { bgcolor: "rgba(57,91,69,0.06)", borderColor: "#395B45" },
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
              </TabPanel>

              {/* Tab 1 – Paste Source */}
              <TabPanel value={tabValue} index={1}>
                <Box sx={{ px: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={12}
                    placeholder="Paste source text here (e.g., case notes, previous statements)..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<Sparkles size={16} />}
                    onClick={handleExtractFields}
                    disabled={!sourceText.trim()}
                  >
                    Extract Fields
                  </Button>
                </Box>
              </TabPanel>

              {/* Tab 2 – Extracted Fields */}
              <TabPanel value={tabValue} index={2}>
                <Box sx={{ px: 2, maxHeight: 500, overflow: "auto" }}>
                  {extractedFields.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{ color: "#666666", textAlign: "center", py: 4 }}
                    >
                      No extracted fields yet. Paste source text and click
                      &quot;Extract Fields&quot;.
                    </Typography>
                  ) : (
                    extractedFields.map((field) => (
                      <Box
                        key={field.id}
                        sx={{
                          mb: 2,
                          p: 2,
                          border: "1px solid #E0E0E0",
                          borderRadius: 1,
                          backgroundColor: field.approved
                            ? "rgba(57, 91, 69, 0.04)"
                            : "transparent",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, fontSize: 13 }}
                          >
                            {field.fieldName}
                          </Typography>
                          <Chip
                            label={`${field.confidence}%`}
                            size="small"
                            color={getConfidenceColor(field.confidence)}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          value={field.suggestedValue}
                          onChange={(e) =>
                            handleExtractedValueChange(field.id, e.target.value)
                          }
                          sx={{ mb: 1 }}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.approved}
                              onChange={(e) =>
                                handleFieldApproval(field.id, e.target.checked)
                              }
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontSize: 12 }}>
                              Approve
                            </Typography>
                          }
                        />
                      </Box>
                    ))
                  )}
                </Box>
              </TabPanel>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Bottom Fixed Action Bar */}
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
            saveStatus === "saving" ? (
              <CircularProgress size={14} color="inherit" />
            ) : saveStatus === "saved" ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )
          }
          onClick={handleSaveDraft}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
            ? "Saved"
            : "Save Draft"}
        </Button>
        <Button
          variant="contained"
          color={docxStatus === "error" ? "error" : "primary"}
          startIcon={
            docxStatus === "generating" ? (
              <CircularProgress size={14} color="inherit" />
            ) : docxStatus === "done" ? (
              <Check size={16} />
            ) : (
              <FileDown size={16} />
            )
          }
          onClick={handleGenerateDocx}
          disabled={docxStatus === "generating"}
        >
          {docxStatus === "generating"
            ? "Generating…"
            : docxStatus === "done"
            ? "Downloaded"
            : "Generate DOCX"}
        </Button>
      </Paper>

      {/* Save feedback snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}>Loading…</Box>}>
      <DocumentBuilderContent />
    </Suspense>
  );
}
