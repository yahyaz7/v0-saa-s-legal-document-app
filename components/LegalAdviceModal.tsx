"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent,
  Box, Button, Typography, IconButton, TextField,
  FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Checkbox, CircularProgress, Alert,
  useMediaQuery, useTheme, Radio, RadioGroup, Paper,
} from "@mui/material";
import { X, Wand2, BookOpen, Copy, Check, RotateCcw } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const OFFENCE_CATEGORIES = [
  "General", "Drink / Drug Drive", "Drugs", "Violence", "Domestic",
  "Theft / Dishonesty", "Burglary", "Sexual", "Public Order", "Motoring",
  "Digital", "Weapons",
];

const LEGAL_ADVICE_OPTIONS = [
  "No comment interview", "Provide prepared statement", "Answer all questions",
  "Answer selective questions", "Decline interview", "Admit offence",
  "Deny allegation", "Request further disclosure", "Advise silence pending disclosure",
  "Advise caution in answers", "Advise full account", "Advise limited account",
];

const INITIAL_POSITION_OPTIONS = [
  "Denies offence", "Admits offence", "Partially admits", "No comment",
  "Gives selective answers", "Provides written statement",
  "Unable to provide instructions / no clear instructions",
  "Admits some / denies others", "Denies offence → later partially admits",
  "Partially admits → later denies",
];

const STAGE_OPTIONS = [
  "Voluntary interview", "Under arrest", "In custody / awaiting interview",
  "Disclosure provided by police", "Late disclosure before interview",
  "Delayed consultation", "Further disclosure provided during custody",
];

const DISCLOSURE_OPTIONS = [
  "No disclosure", "Limited disclosure", "Moderate evidence", "Strong evidence",
  "Limited → Moderate evidence", "Disclosure escalated during consultation",
  "Unknown level of disclosure",
];

const INTERVIEW_OUTCOME_OPTIONS = [
  "No comment interview", "Prepared statement given", "Answered all questions",
  "Selective answers", "Admission made", "Denial maintained",
  "Mixed responses", "No interview conducted",
];

const POST_INTERVIEW_OPTIONS = [
  "Released under investigation (RUI)", "Bail granted",
  "Bail granted with conditions", "Bail granted without conditions",
  "Charged", "No further action (NFA)", "Case discontinued",
  "Further investigation pending",
];

const EVIDENCE_TYPES = [
  "CCTV", "Witness evidence", "Forensic evidence", "Identification evidence",
  "Digital evidence", "Co-accused admissions", "Multiple evidence types",
  "Unknown evidence type",
];

const RISK_MODIFIERS = [
  "Client is vulnerable", "Youth client", "Appropriate adult present",
  "Interpreter present", "Health concerns identified", "Capacity concerns identified",
  "Serious allegation", "Multiple offences", "Adverse inference explained",
  "Identification reliability explained", "Forensic evidence risk explained",
  "Client intoxicated", "Client distressed", "Client confused",
  "Intent disputed", "Client reserves position",
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormState {
  offenceSummary: string;
  offenceCategory: string;
  legalAdvice: string;
  initialPosition: string;
  stage: string;
  disclosure: string;
  evidenceTypes: string[];
  interviewOutcome: string;
  postInterviewOutcome: string;
  riskModifiers: string[];
}

interface GenerateResponse {
  text?: string;
  advice?: string; result?: string; output?: string;
  error?: string; message?: string; detail?: string;
  errors?: string[];
  warnings?: { code: string; message: string }[];
  usedBlockIds?: string[];
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onClose: () => void;
  extractedOffences: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function defaultForm(extracted: string[]): FormState {
  return {
    offenceSummary:      extracted.length === 1 ? extracted[0] : "",
    offenceCategory:     "",
    legalAdvice:         "",
    initialPosition:     "",
    stage:               "",
    disclosure:          "",
    evidenceTypes:       [],
    interviewOutcome:    "",
    postInterviewOutcome:"",
    riskModifiers:       [],
  };
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const selectSx = {
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#D1D5DB" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
};
const labelSx = { "&.Mui-focused": { color: "#395B45" } };

function SectionLabel({ num, children }: { num?: string; children: React.ReactNode }) {
  return (
    <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#374151", mb: 1 }}>
      {num && <Box component="span" sx={{ color: "#395B45", mr: 0.5 }}>{num}.</Box>}
      {children}
    </Typography>
  );
}

function CheckboxGrid({
  items, selected, onToggle, accentColor = "#395B45",
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  accentColor?: string;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
      {items.map((val) => (
        <FormControlLabel
          key={val}
          control={
            <Checkbox
              size="small"
              checked={selected.includes(val)}
              onChange={() => onToggle(val)}
              sx={{ color: "#D1D5DB", py: 0.5, "&.Mui-checked": { color: accentColor } }}
            />
          }
          label={<Typography sx={{ fontSize: "0.8rem", color: "#374151" }}>{val}</Typography>}
          sx={{
            m: 0, border: "1px solid #E5E7EB", borderRadius: 1,
            px: 0.75, py: 0.25, bgcolor: "#fff",
            "&:hover": { borderColor: "#D1D5DB", bgcolor: "#FAFAFA" },
          }}
        />
      ))}
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LegalAdviceModal({ open, onClose, extractedOffences }: Props) {
  const theme  = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [form,    setForm]    = useState<FormState>(() => defaultForm(extractedOffences));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState("");
  const [copied,  setCopied]  = useState(false);

  // Re-seed when modal re-opens with different extracted offences
  const [lastExtracted, setLastExtracted] = useState<string[]>([]);
  if (open && extractedOffences !== lastExtracted) {
    setLastExtracted(extractedOffences);
    setForm(defaultForm(extractedOffences));
    setResult("");
    setError("");
  }

  const set = (field: keyof FormState, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  function toggleCheck(field: "evidenceTypes" | "riskModifiers", val: string) {
    setForm((p) => ({
      ...p,
      [field]: p[field].includes(val) ? p[field].filter((v) => v !== val) : [...p[field], val],
    }));
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setError("");
    if (!form.offenceSummary.trim()) { setError("Please enter or select an offence."); return; }
    if (!form.initialPosition)       { setError("Please select an Initial Position."); return; }
    if (!form.stage)                 { setError("Please select a Stage of Police Process."); return; }
    if (!form.disclosure)            { setError("Please select a Disclosure & Evidence Assessment."); return; }
    if (!form.interviewOutcome)      { setError("Please select an Interview Outcome."); return; }
    if (!form.postInterviewOutcome)  { setError("Please select a Post-Interview Outcome."); return; }

    const payload = {
      offences: [{
        summary:     form.offenceSummary.trim(),
        category:    form.offenceCategory  || "General",
        legalAdvice: form.legalAdvice      || "No comment interview",
      }],
      initialPosition:      form.initialPosition,
      stage:                form.stage,
      disclosure:           form.disclosure,
      evidenceTypes:        form.evidenceTypes,
      interviewOutcome:     form.interviewOutcome,
      postInterviewOutcome: form.postInterviewOutcome,
      riskModifiers:        form.riskModifiers,
    };

    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch("https://www.demox.live/api/public/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (networkErr: unknown) {
        throw new Error(
          `Network error — could not reach the API.\n${networkErr instanceof Error ? networkErr.message : String(networkErr)}`
        );
      }

      const rawText = await res.text();
      let json: GenerateResponse | null = null;
      try { json = JSON.parse(rawText) as GenerateResponse; } catch { /* not JSON */ }

      if (!res.ok) {
        const errorsArr = Array.isArray(json?.errors) ? (json.errors as string[]).join("; ") : null;
        const serverMsg =
          errorsArr ||
          json?.error ||
          json?.message ||
          json?.detail ||
          (rawText.trim().length > 0 && rawText.trim().length < 500 ? rawText.trim() : null);
        throw new Error(
          serverMsg
            ? `HTTP ${res.status}: ${serverMsg}`
            : `Request failed with HTTP ${res.status}. Raw response:\n${rawText.slice(0, 400)}`
        );
      }

      if (!json) throw new Error(`API returned HTTP ${res.status} but the response was not valid JSON:\n${rawText.slice(0, 400)}`);

      const text =
        (typeof json.text    === "string" ? json.text    : "") ||
        (typeof json.advice  === "string" ? json.advice  : "") ||
        (typeof json.result  === "string" ? json.result  : "") ||
        (typeof json.output  === "string" ? json.output  : "") ||
        JSON.stringify(json, null, 2);
      setResult(text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setForm(defaultForm(extractedOffences));
    setResult("");
    setError("");
  }

  function handleClose() {
    if (loading) return;
    handleReset();
    onClose();
  }

  // ── Left panel ───────────────────────────────────────────────────────────────

  const leftPanel = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* ── Offence ─────────────────────────────────────────────────────── */}
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827", mb: 1.25 }}>
          Offence
        </Typography>

        {/* If multiple extracted offences: radio selector */}
        {extractedOffences.length > 1 && (
          <Paper variant="outlined" sx={{ mb: 1.5, borderRadius: 1.5, overflow: "hidden" }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280" }}>
                Select one offence from document
              </Typography>
            </Box>
            <RadioGroup
              value={form.offenceSummary}
              onChange={(e) => set("offenceSummary", e.target.value)}
              sx={{ px: 1.5, py: 0.75 }}
            >
              {extractedOffences.map((o) => (
                <FormControlLabel
                  key={o}
                  value={o}
                  control={
                    <Radio size="small" sx={{ color: "#D1D5DB", "&.Mui-checked": { color: "#395B45" } }} />
                  }
                  label={<Typography sx={{ fontSize: "0.82rem", color: "#374151" }}>{o}</Typography>}
                  sx={{ my: 0.25 }}
                />
              ))}
            </RadioGroup>
          </Paper>
        )}

        {/* Manual offence text input */}
        <TextField
          fullWidth size="small"
          label={extractedOffences.length > 1 ? "Or type a custom offence" : "Detected / selected offence *"}
          placeholder="e.g. Theft from shop"
          value={extractedOffences.length > 1 && extractedOffences.includes(form.offenceSummary) ? "" : form.offenceSummary}
          onChange={(e) => set("offenceSummary", e.target.value)}
          sx={{ mb: 1.5, "& .MuiOutlinedInput-root": selectSx }}
          InputLabelProps={{ sx: labelSx }}
        />

        {/* Category */}
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel sx={labelSx}>Offence category</InputLabel>
          <Select value={form.offenceCategory} label="Offence category"
            onChange={(e) => set("offenceCategory", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select category</em></MenuItem>
            {OFFENCE_CATEGORIES.map((c) => (
              <MenuItem key={c} value={c} sx={{ fontSize: "0.85rem" }}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Legal advice for this offence */}
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Legal advice for this offence</InputLabel>
          <Select value={form.legalAdvice} label="Legal advice for this offence"
            onChange={(e) => set("legalAdvice", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select advice given</em></MenuItem>
            {LEGAL_ADVICE_OPTIONS.map((a) => (
              <MenuItem key={a} value={a} sx={{ fontSize: "0.85rem" }}>{a}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── 1. Initial Position ─────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="1">Initial Position / Instructions</SectionLabel>
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Initial position *</InputLabel>
          <Select value={form.initialPosition} label="Initial position *"
            onChange={(e) => set("initialPosition", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select initial position</em></MenuItem>
            {INITIAL_POSITION_OPTIONS.map((o) => (
              <MenuItem key={o} value={o} sx={{ fontSize: "0.85rem" }}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── 2. Stage ────────────────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="2">Stage of Police Process</SectionLabel>
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Stage *</InputLabel>
          <Select value={form.stage} label="Stage *"
            onChange={(e) => set("stage", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select stage</em></MenuItem>
            {STAGE_OPTIONS.map((o) => (
              <MenuItem key={o} value={o} sx={{ fontSize: "0.85rem" }}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── 3. Disclosure ───────────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="3">Disclosure & Evidence Assessment</SectionLabel>
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Disclosure *</InputLabel>
          <Select value={form.disclosure} label="Disclosure *"
            onChange={(e) => set("disclosure", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select disclosure level</em></MenuItem>
            {DISCLOSURE_OPTIONS.map((o) => (
              <MenuItem key={o} value={o} sx={{ fontSize: "0.85rem" }}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── 4. Evidence Types ───────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="4">Evidence Types (multi-select)</SectionLabel>
        <CheckboxGrid items={EVIDENCE_TYPES} selected={form.evidenceTypes}
          onToggle={(v) => toggleCheck("evidenceTypes", v)} />
        <Typography variant="caption" sx={{ color: "#9CA3AF", mt: 0.75, display: "block" }}>
          Defaults to "Unknown evidence type" if none selected.
        </Typography>
      </Box>

      {/* ── 5. Interview Outcome ────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="5">Interview Outcome</SectionLabel>
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Interview outcome *</InputLabel>
          <Select value={form.interviewOutcome} label="Interview outcome *"
            onChange={(e) => set("interviewOutcome", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select interview outcome</em></MenuItem>
            {INTERVIEW_OUTCOME_OPTIONS.map((o) => (
              <MenuItem key={o} value={o} sx={{ fontSize: "0.85rem" }}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── 6. Post-Interview ───────────────────────────────────────────── */}
      <Box>
        <SectionLabel num="6">Post-Interview Outcome</SectionLabel>
        <FormControl fullWidth size="small">
          <InputLabel sx={labelSx}>Post-interview outcome *</InputLabel>
          <Select value={form.postInterviewOutcome} label="Post-interview outcome *"
            onChange={(e) => set("postInterviewOutcome", e.target.value)} sx={selectSx}>
            <MenuItem value=""><em style={{ color: "#9CA3AF" }}>Select post-interview outcome</em></MenuItem>
            {POST_INTERVIEW_OPTIONS.map((o) => (
              <MenuItem key={o} value={o} sx={{ fontSize: "0.85rem" }}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* ── Optional Risk Modifiers ─────────────────────────────────────── */}
      <Box>
        <SectionLabel>Optional Risk Modifiers</SectionLabel>
        <CheckboxGrid items={RISK_MODIFIERS} selected={form.riskModifiers}
          onToggle={(v) => toggleCheck("riskModifiers", v)} />
      </Box>

      {/* ── Error + Generate button ─────────────────────────────────────── */}
      <Box sx={{ pt: 0.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5, fontSize: "0.82rem" }}
            onClose={() => setError("")}>{error}</Alert>
        )}
        <Button fullWidth variant="contained" onClick={handleGenerate} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Wand2 size={16} />}
          sx={{
            bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
            "&.Mui-disabled": { bgcolor: "#D1D5DB" },
            fontWeight: 700, textTransform: "none", fontSize: "0.9rem",
            py: 1.25, borderRadius: 1.5,
          }}>
          {loading ? "Generating…" : "Generate Reasons for Advice"}
        </Button>
      </Box>
    </Box>
  );

  // ── Right panel ──────────────────────────────────────────────────────────────

  const rightPanel = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: isMobile ? 320 : 0 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, pb: 1.5, borderBottom: "1px solid #E5E7EB" }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>
          Reasons for Advice
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => setResult("")} disabled={!result}
            sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", fontSize: "0.78rem", minWidth: 0 }}>
            Clear
          </Button>
          <Button size="small" variant="contained" onClick={handleCopy} disabled={!result}
            startIcon={copied ? <Check size={13} /> : <Copy size={13} />}
            sx={{
              bgcolor: copied ? "#16A34A" : "#395B45",
              "&:hover": { bgcolor: copied ? "#15803D" : "#2D4A38" },
              "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" },
              fontWeight: 600, textTransform: "none", fontSize: "0.78rem", borderRadius: 1,
            }}>
            {copied ? "Copied!" : "Copy Final Text"}
          </Button>
        </Box>
      </Box>

      {/* Editable output */}
      <TextField
        multiline fullWidth
        value={result}
        onChange={(e) => setResult(e.target.value)}
        placeholder="Generated text will appear here. You can edit it freely before copying."
        sx={{
          flex: 1,
          "& .MuiOutlinedInput-root": {
            height: "100%", alignItems: "flex-start",
            bgcolor: result ? "#fff" : "#FAFAFA",
            fontSize: "0.85rem", lineHeight: 1.75,
            "& fieldset": { borderColor: "#E5E7EB" },
            "&:hover fieldset": { borderColor: "#D1D5DB" },
            "&.Mui-focused fieldset": { borderColor: "#395B45" },
          },
          "& .MuiInputBase-inputMultiline": { height: "100% !important", overflowY: "auto !important" },
        }}
      />

      {/* Reset */}
      <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" startIcon={<RotateCcw size={13} />} onClick={handleReset}
          sx={{ color: "#9CA3AF", fontWeight: 500, textTransform: "none", fontSize: "0.78rem" }}>
          Reset
        </Button>
      </Box>
    </Box>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isMobile ? 0 : 2.5,
            height: isMobile ? "100dvh" : "92vh",
            maxHeight: isMobile ? "100dvh" : "92vh",
            display: "flex", flexDirection: "column",
            m: isMobile ? 0 : undefined,
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 1.5, pt: 2, px: 3, flexShrink: 0, borderBottom: "1px solid #F3F4F6" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BookOpen size={19} color="#395B45" />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#111827", lineHeight: 1.2 }}>
                Phrase Builder
              </Typography>
              <Typography variant="caption" sx={{ color: "#6B7280" }}>
                Fill in case details to generate reasons for advice
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} disabled={loading} size="small" sx={{ color: "#9CA3AF" }}>
            <X size={18} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 0, flex: 1, overflow: "hidden", display: "flex" }}>
        {isMobile ? (
          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2.5, display: "flex", flexDirection: "column", gap: 3 }}>
            {leftPanel}
            <Box sx={{ borderTop: "2px solid #E5E7EB", pt: 2.5, minHeight: 320 }}>
              {rightPanel}
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
            {/* Left — scrollable */}
            <Box sx={{
              overflowY: "auto", px: 3, py: 2.5, borderRight: "1px solid #E5E7EB",
              "&::-webkit-scrollbar": { width: 5 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#D1D5DB", borderRadius: 3 },
            }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, mb: 2 }}>
                Case inputs
              </Typography>
              {leftPanel}
            </Box>

            {/* Right — fixed height, textarea fills it */}
            <Box sx={{ display: "flex", flexDirection: "column", px: 3, py: 2.5, overflow: "hidden" }}>
              {rightPanel}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
