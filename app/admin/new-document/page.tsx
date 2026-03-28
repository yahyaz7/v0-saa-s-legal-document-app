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
  IconButton,
} from "@mui/material";
import { FileDown, Save, Check, ChevronDown, Plus, ArrowLeft } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DynamicField, TemplateFieldDef, FieldValue } from "@/components/dynamic-field";
import { saveDraft, loadDraft, DraftFormData } from "@/lib/drafts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhraseItem { id: string; label: string; phrase_text: string }
interface PhraseCategory { id: string; name: string; phrases: PhraseItem[] }
type FormValues = Record<string, FieldValue>;

function initFormValues(fields: TemplateFieldDef[]): FormValues {
  const v: FormValues = {};
  for (const f of fields) v[f.field_key] = f.field_type === "checkbox" ? false : "";
  return v;
}

function applyDraftData(base: FormValues, draft: DraftFormData): FormValues {
  const result = { ...base };
  for (const key of Object.keys(result)) {
    if (draft[key] !== undefined) result[key] = draft[key] as FieldValue;
  }
  return result;
}

function fieldColSpan(f: TemplateFieldDef) {
  return f.field_type === "textarea" ? { xs: 12 } : { xs: 12, sm: 6 };
}

// ── Main content ──────────────────────────────────────────────────────────────

function AdminDocumentBuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get("template");
  const draftParam  = searchParams.get("draft");

  const [templateName, setTemplateName]   = useState("");
  const [formHeading, setFormHeading]     = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateFieldDef[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState<string | null>(null);
  const [userId, setUserId]               = useState<string | null>(null);

  const [formValues, setFormValues]   = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [draftId, setDraftId]       = useState<string | null>(draftParam);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docxStatus, setDocxStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [snackbarOpen, setSnackbarOpen]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  const [phraseCategories, setPhraseCategories]   = useState<PhraseCategory[]>([]);
  const [phraseTargetField, setPhraseTargetField] = useState<string>("");
  const [previewPhrase, setPreviewPhrase]         = useState<PhraseItem | null>(null);
  const [expandedCategory, setExpandedCategory]   = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ key: string; start: number; end: number } | null>(null);

  const [addPhraseOpen, setAddPhraseOpen]   = useState(false);
  const [addPhraseForm, setAddPhraseForm]   = useState({ category_id: "", label: "", phrase_text: "" });
  const [addPhraseSaving, setAddPhraseSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId) {
      setFetchError("No template selected. Go back and choose a template.");
      setLoading(false);
      return;
    }
    const supabase = createClient();

    async function fetchData() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUserId(authUser?.id ?? null);
      try {
        setLoading(true);

        const { data: vData, error: vError } = await supabase
          .from("template_versions")
          .select("id, template_id, form_heading, templates(name)")
          .eq("template_id", templateId)
          .eq("is_active", true)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (vError || !vData) throw new Error("Template version not found");
        setTemplateName((vData.templates as any).name);
        setFormHeading((vData as any).form_heading ?? null);

        const { data: fieldsData, error: fError } = await supabase
          .from("template_fields")
          .select("*")
          .eq("template_version_id", vData.id)
          .order("field_order");
        if (fError) throw fError;

        const fields = (fieldsData ?? []) as TemplateFieldDef[];
        setTemplateFields(fields);

        const base = initFormValues(fields);
        if (draftParam) {
          const draftData = await loadDraft(supabase, draftParam);
          setFormValues(draftData ? applyDraftData(base, draftData) : base);
        } else {
          setFormValues(base);
        }

        const phrasesRes = await fetch("/api/phrases");
        if (phrasesRes.ok) {
          const json = await phrasesRes.json();
          if (json.data) {
            setPhraseCategories(json.data);
            if (json.data.length > 0) setExpandedCategory(json.data[0].id);
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

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    if (templateFields.length === 0) return [];
    const sorted = [...templateFields].sort((a, b) => a.field_order - b.field_order);
    const result: Array<{ heading: string; fields: TemplateFieldDef[] }> = [];
    for (const field of sorted) {
      const heading = field.section_heading ?? "";
      const last = result[result.length - 1];
      if (!last || last.heading !== heading) result.push({ heading, fields: [field] });
      else last.fields.push(field);
    }
    return result;
  }, [templateFields]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  function handleFieldChange(key: string, value: FieldValue) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of templateFields) {
      if (field.is_required) {
        const val = formValues[field.field_key];
        if (!val || (typeof val === "string" && !val.trim()))
          errors[field.field_key] = `${field.field_label} is required`;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Phrase bank ────────────────────────────────────────────────────────────
  const phraseTargetOptions = useMemo(() => {
    const opts = templateFields
      .filter((f) => f.supports_phrase_bank)
      .sort((a, b) => a.field_order - b.field_order)
      .map((f) => ({ key: f.field_key, label: f.field_label }));
    if (opts.length > 0 && !phraseTargetField) setPhraseTargetField(opts[0].key);
    return opts;
  }, [templateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInsertPhrase(phraseText: string) {
    if (!phraseTargetField) return;
    const current = (formValues[phraseTargetField] as string) ?? "";
    let updated: string;
    if (cursorPos?.key === phraseTargetField) {
      const { start, end } = cursorPos;
      updated = current.slice(0, start) + phraseText + current.slice(end);
      setCursorPos({ key: phraseTargetField, start: start + phraseText.length, end: start + phraseText.length });
    } else {
      updated = current ? `${current}\n${phraseText}` : phraseText;
    }
    handleFieldChange(phraseTargetField, updated);
    showSnackbar("Phrase inserted.", "success");
  }

  function handleFieldBlur(key: string, start: number, end: number) {
    if (templateFields.find((f) => f.field_key === key)?.supports_phrase_bank)
      setCursorPos({ key, start, end });
  }

  function handleFieldFocus(key: string) {
    if (templateFields.find((f) => f.field_key === key)?.supports_phrase_bank)
      setPhraseTargetField(key);
  }

  // ── Add phrase ─────────────────────────────────────────────────────────────
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
      const refreshed = await fetch("/api/phrases");
      if (refreshed.ok) {
        const json = await refreshed.json();
        if (json.data) setPhraseCategories(json.data);
      }
      setAddPhraseOpen(false);
      setAddPhraseForm({ category_id: "", label: "", phrase_text: "" });
      showSnackbar("Phrase added.", "success");
    } catch {
      showSnackbar("Failed to add phrase.", "error");
    } finally {
      setAddPhraseSaving(false);
    }
  }

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
      showSnackbar("Failed to save draft.", "error");
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
        body: JSON.stringify({ templateId, formData: formValues, draftId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate document");
      }
      const blob = await response.blob();
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <IconButton
          onClick={() => router.push("/admin/documents")}
          size="small"
          sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5 }}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
            {draftParam ? "Continue Draft" : "New Document"}
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280" }}>
            {draftParam ? "Editing saved draft — " : "Using template: "}
            <strong>{templateName || (loading ? "Loading…" : "Unknown")}</strong>
          </Typography>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {fetchError && <Alert severity="error" sx={{ mb: 3 }}>{fetchError}</Alert>}

      {!loading && !fetchError && (
        <Grid container spacing={3}>
          {/* LEFT: Dynamic form */}
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
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, mt: idx > 0 ? 1 : 0, color: "#1A1A1A" }}>
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
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {idx < sections.length - 1 && <Divider sx={{ my: 3 }} />}
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* RIGHT: Phrase Bank */}
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #E5E7EB", bgcolor: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827" }}>Phrase Bank</Typography>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>Click a phrase to insert into the selected field</Typography>
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

              <Box sx={{ p: 2 }}>
                {phraseTargetOptions.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center", py: 4 }}>
                    No fields in this template have phrase bank enabled.
                  </Typography>
                ) : (
                  <>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Insert into</InputLabel>
                      <Select value={phraseTargetField} label="Insert into" onChange={(e) => setPhraseTargetField(e.target.value)}>
                        {phraseTargetOptions.map(({ key, label }) => (
                          <MenuItem key={key} value={key}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ maxHeight: 480, overflowY: "auto", mx: -0.5 }}>
                      {phraseCategories.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center", py: 4 }}>
                          No phrases yet.
                        </Typography>
                      ) : (
                        phraseCategories.map((cat) => {
                          const isOpen = expandedCategory === cat.id;
                          return (
                            <Box key={cat.id} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 1, overflow: "hidden", boxShadow: isOpen ? "0 2px 8px rgba(0,0,0,0.06)" : "none", transition: "box-shadow 0.2s" }}>
                              <Box
                                onClick={() => setExpandedCategory(isOpen ? null : cat.id)}
                                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1.25, cursor: "pointer", bgcolor: isOpen ? "#F0F5F1" : "#F9FAFB", borderBottom: isOpen ? "1px solid #E5E7EB" : "none", transition: "background-color 0.15s", "&:hover": { bgcolor: "#EBF2EC" }, userSelect: "none" }}
                              >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#111827" }}>{cat.name}</Typography>
                                  <Box sx={{ bgcolor: isOpen ? "#395B45" : "#E5E7EB", color: isOpen ? "#fff" : "#6B7280", borderRadius: 10, px: 0.75, py: 0.1, fontSize: 11, fontWeight: 700, lineHeight: 1.6, minWidth: 20, textAlign: "center", transition: "all 0.15s" }}>
                                    {cat.phrases.length}
                                  </Box>
                                </Box>
                                <Box sx={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "flex", color: "#6B7280" }}>
                                  <ChevronDown size={16} />
                                </Box>
                              </Box>
                              <Collapse in={isOpen} timeout={200}>
                                <Box sx={{ p: 1, bgcolor: "#fff" }}>
                                  {cat.phrases.length === 0 ? (
                                    <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", textAlign: "center", py: 1.5 }}>No phrases in this category.</Typography>
                                  ) : (
                                    cat.phrases.map((phrase) => (
                                      <Box
                                        key={phrase.id}
                                        onClick={() => setPreviewPhrase(phrase)}
                                        sx={{ px: 1.25, py: 1, mb: 0.5, borderRadius: 1.5, cursor: "pointer", border: "1px solid transparent", transition: "all 0.15s", "&:hover": { bgcolor: "rgba(57,91,69,0.06)", border: "1px solid #C4D9C8" }, "&:last-child": { mb: 0 } }}
                                      >
                                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13, color: "#111827", lineHeight: 1.4, mb: 0.25 }}>{phrase.label || "—"}</Typography>
                                        <Typography variant="caption" sx={{ color: "#6B7280", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
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
        sx={{ position: "fixed", bottom: 0, left: 240, right: 0, p: 2, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, borderTop: "1px solid #E0E0E0", zIndex: 1000 }}
      >
        {draftId && (
          <Typography variant="caption" sx={{ color: "#999", mr: "auto" }}>
            Draft ID: {draftId.slice(0, 8)}…
          </Typography>
        )}
        <Button
          variant="outlined"
          color={saveStatus === "error" ? "error" : "primary"}
          startIcon={saveStatus === "saving" ? <CircularProgress size={14} color="inherit" /> : saveStatus === "saved" ? <Check size={16} /> : <Save size={16} />}
          onClick={handleSaveDraft}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save Draft"}
        </Button>
        <Button
          variant="contained"
          color={docxStatus === "error" ? "error" : "primary"}
          startIcon={docxStatus === "generating" ? <CircularProgress size={14} color="inherit" /> : docxStatus === "done" ? <Check size={16} /> : <FileDown size={16} />}
          onClick={handleGenerateDocx}
          disabled={docxStatus === "generating"}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
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
            <Select value={addPhraseForm.category_id} label="Category" onChange={(e) => setAddPhraseForm((p) => ({ ...p, category_id: e.target.value }))}>
              {phraseCategories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Label" fullWidth size="small" value={addPhraseForm.label} onChange={(e) => setAddPhraseForm((p) => ({ ...p, label: e.target.value }))} required />
          <TextField label="Phrase Text" fullWidth multiline rows={5} size="small" value={addPhraseForm.phrase_text} onChange={(e) => setAddPhraseForm((p) => ({ ...p, phrase_text: e.target.value }))} required />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setAddPhraseOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disabled={!addPhraseForm.category_id || !addPhraseForm.label.trim() || !addPhraseForm.phrase_text.trim() || addPhraseSaving} onClick={handleAddPhrase} sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}>
            {addPhraseSaving ? "Saving…" : "Save Phrase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Phrase preview dialog */}
      <Dialog open={!!previewPhrase} onClose={() => setPreviewPhrase(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{previewPhrase?.label || "Phrase"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "#374151", lineHeight: 1.7 }}>{previewPhrase?.phrase_text}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setPreviewPhrase(null)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={() => { if (previewPhrase) handleInsertPhrase(previewPhrase.phrase_text); setPreviewPhrase(null); }} sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}>
            Insert into Field
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={3500} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function AdminNewDocumentPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><CircularProgress /></Box>}>
      <AdminDocumentBuilderContent />
    </Suspense>
  );
}
