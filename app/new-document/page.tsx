"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Card,
  CardContent,
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

interface PhraseEntry {
  id: string;
  field_key: string | null;
  title: string;
  content: string;
  category: string | null;
  offence_tags: string[];
}

/** Field keys that support phrase-bank insertion on this template. */
const PHRASE_BANK_KEYS = ["instructions", "advice", "outcome", "next_action"];

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
    if (field.field_type === "repeater") {
      const emptyRow = Object.fromEntries(
        (field.repeater_fields ?? []).map((f) => [f.key, ""])
      );
      values[field.field_key] = [emptyRow];
    } else {
      values[field.field_key] = "";
    }
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

/** Returns the Grid column span for a field based on its type and section. */
function fieldColSpan(field: TemplateFieldDef) {
  if (field.field_type === "repeater" || field.field_type === "textarea") {
    return { xs: 12 };
  }
  if (field.section === "Time Recording") {
    return { xs: 12, sm: 6, md: 4 };
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
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  // Phrase bank state
  const [dbPhrases, setDbPhrases] = useState<PhraseEntry[]>([]);
  const [phraseTargetField, setPhraseTargetField] = useState<string>(PHRASE_BANK_KEYS[0]);

  // Right-panel state (unchanged from original)
  const [tabValue, setTabValue] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId) {
      setFetchError(
        "No template selected. Go back to Templates and choose one."
      );
      setLoading(false);
      return;
    }

    const supabase = createClient();

    Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("templates")
        .select("name")
        .eq("id", templateId)
        .single(),
      supabase
        .from("template_fields")
        .select("*")
        .eq("template_id", templateId)
        .order("section_order")
        .order("field_order"),
      // Load draft data when ?draft= is present in the URL
      draftParam ? loadDraft(supabase, draftParam) : Promise.resolve(null),
      // Load phrase bank entries for this template
      supabase
        .from("phrase_bank_entries")
        .select("id, field_key, title, content, category, offence_tags")
        .eq("template_id", templateId)
        .order("title"),
    ]).then(([userRes, templateRes, fieldsRes, draftData, phrasesRes]) => {
      setUserId(userRes.data.user?.id ?? null);

      if (templateRes.error || !templateRes.data) {
        setFetchError("Template not found.");
      } else if (fieldsRes.error) {
        setFetchError("Failed to load template fields.");
      } else {
        const fields = (fieldsRes.data ?? []) as TemplateFieldDef[];
        setTemplateName(templateRes.data.name);
        setTemplateFields(fields);
        const base = initFormValues(fields);
        setFormValues(draftData ? applyDraftData(base, draftData) : base);
      }

      if (!phrasesRes.error) {
        setDbPhrases((phrasesRes.data ?? []) as PhraseEntry[]);
      }

      setLoading(false);
    });
  }, [templateId, draftParam]);

  // ── Section grouping ───────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const map = new Map<string, { order: number; fields: TemplateFieldDef[] }>();
    for (const field of templateFields) {
      if (!map.has(field.section)) {
        map.set(field.section, { order: field.section_order, fields: [] });
      }
      map.get(field.section)!.fields.push(field);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, { fields }]) => ({
        name,
        fields: [...fields].sort((a, b) => a.field_order - b.field_order),
      }));
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
      if (field.required) {
        const val = formValues[field.field_key];
        if (!val || (typeof val === "string" && !val.trim())) {
          errors[field.field_key] = `${field.label} is required`;
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Phrase bank ────────────────────────────────────────────────────────────

  /** Dropdown options: only phrase-bank-eligible fields that exist in the template. */
  const phraseTargetOptions = useMemo(
    () =>
      templateFields
        .filter((f) => PHRASE_BANK_KEYS.includes(f.field_key))
        .sort((a, b) => a.section_order - b.section_order || a.field_order - b.field_order)
        .map((f) => ({ key: f.field_key, label: f.label })),
    [templateFields]
  );

  /** Phrases relevant to the currently-selected target field (plus generic ones with null field_key). */
  const filteredPhrases = useMemo(
    () => dbPhrases.filter((p) => p.field_key === phraseTargetField || p.field_key === null),
    [dbPhrases, phraseTargetField]
  );

  /** Append phrase content to the target field value, separated by a blank line. */
  const handleInsertPhrase = (content: string) => {
    const current = (formValues[phraseTargetField] as string) ?? "";
    const updated = current.trim() ? `${current}\n\n${content}` : content;
    handleFieldChange(phraseTargetField, updated);
  };

  /** When a textarea gains focus, auto-target the phrase panel to that field. */
  const handleFieldFocus = (key: string) => {
    if (PHRASE_BANK_KEYS.includes(key)) {
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
          <Grid size={{ xs: 12, md: 8 }}>
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
                      <Grid size={fieldColSpan(field)} key={field.field_key}>
                        <DynamicField
                          field={field}
                          value={
                            formValues[field.field_key] ??
                            (field.field_type === "repeater" ? [] : "")
                          }
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
          <Grid size={{ xs: 12, md: 4 }}>
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

              {/* Tab 0 – Suggested Phrases */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ px: 2 }}>
                  {/* Target field selector */}
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Insert into</InputLabel>
                    <Select
                      value={phraseTargetField}
                      label="Insert into"
                      onChange={(e) => setPhraseTargetField(e.target.value)}
                    >
                      {phraseTargetOptions.map(({ key, label }) => (
                        <MenuItem key={key} value={key}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Phrase list */}
                  <Box sx={{ maxHeight: 430, overflow: "auto" }}>
                    {filteredPhrases.length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{ color: "#666666", textAlign: "center", py: 4 }}
                      >
                        No phrases available for this field.
                      </Typography>
                    ) : (
                      filteredPhrases.map((phrase) => (
                        <Card
                          key={phrase.id}
                          sx={{ mb: 2, border: "1px solid #E0E0E0", boxShadow: "none" }}
                        >
                          <CardContent sx={{ pb: "12px !important" }}>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                mb: 0.5,
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600, fontSize: 14 }}
                              >
                                {phrase.title}
                              </Typography>
                              {phrase.category && (
                                <Chip
                                  label={phrase.category}
                                  size="small"
                                  sx={{
                                    backgroundColor: "#F5F5F5",
                                    color: "#666666",
                                    fontSize: 10,
                                    height: 18,
                                    ml: 1,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#666666",
                                fontSize: 12,
                                lineHeight: 1.5,
                                mb: 1,
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {phrase.content}
                            </Typography>
                            {phrase.offence_tags?.length > 0 && (
                              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                                {phrase.offence_tags.map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    sx={{ backgroundColor: "#EEF2EE", fontSize: 10, height: 18 }}
                                  />
                                ))}
                              </Box>
                            )}
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              startIcon={<Plus size={14} />}
                              fullWidth
                              sx={{ mt: 0.5 }}
                              onClick={() => handleInsertPhrase(phrase.content)}
                            >
                              Add to Document
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Box>
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
          color="primary"
          startIcon={<FileDown size={16} />}
          onClick={() => {
            if (validate()) {
              // TODO: generate DOCX (next task)
            }
          }}
        >
          Generate DOCX
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
