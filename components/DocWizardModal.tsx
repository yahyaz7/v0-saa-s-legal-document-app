"use client";

import {
  useRef, useState, useCallback, useMemo, useEffect,
} from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, CircularProgress, Alert,
  Chip, Paper, LinearProgress, Select, MenuItem,
  FormControl, InputLabel, Divider, IconButton,
  List, ListItem, ListItemText, TextField,
  Tooltip, useMediaQuery, useTheme, Skeleton,
} from "@mui/material";
import {
  Wand2, X, Upload, FileText, CheckCircle, AlertCircle,
  ArrowRight, Layers, ChevronDown, Trash2, Link2, Link2Off, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LLMMapping } from "@/app/api/llm-map/route";
import type { ApplyValues, TplField, RepeaterSubField } from "@/components/AutoFillUploader";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string;
}

interface ParseResponse {
  raw_text: string;
  extraction_method: string;
  warning?: string;
}

type FileStatus = "pending" | "parsing" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  result: ParseResponse | null;
  error: string;
}

type WizardStep = 0 | 1 | 2 | 3;

interface MappingTarget {
  assignedKey: string;
  label: string;
  fieldKey: string;
  fieldType: string;
  repeaterKey?: string;
  subFieldName?: string;
  subFieldType?: RepeaterSubField["type"];
  repeaterLabel?: string;
}

interface MappingRow {
  pairIndex: number;
  label: string;
  value: string;
  suggestedKey: string;
  suggestedConfidence: number;
  suggestedReasoning: string;
  assignedKey: string;
}

export interface DocWizardResult {
  templateId: string;
  templateName: string;
  values: ApplyValues;
  autoFilledKeys: Set<string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: DocWizardResult) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";
const IGNORE_VALUE = "" as const;
const REPEATER_SEP = "::";

const STEP_LABELS = [
  { id: 0, label: "Template & Files" },
  { id: 1, label: "Processing"       },
  { id: 2, label: "Field Mapping"    },
  { id: 3, label: "Review"           },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string { return `wiz-${Date.now()}-${++_idCounter}`; }

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceLabel(c: number): string { return c >= 0.9 ? "High" : "Good"; }
function confidenceColor(c: number): "success" | "warning" { return c >= 0.9 ? "success" : "warning"; }

function parseSubFields(raw: TplField["field_options"]): RepeaterSubField[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] !== "object" || raw[0] === null) return [];
  const validTypes = ["text", "dropdown", "date", "offence_search"] as const;
  return (raw as RepeaterSubField[])
    .map((sf) => ({
      name:    sf.name  ?? "",
      label:   sf.label ?? sf.name ?? "",
      type:    validTypes.includes(sf.type) ? sf.type : "text",
      options: Array.isArray(sf.options) ? sf.options : [],
    }))
    .filter((sf) => sf.name !== "");
}

function buildMappingTargets(fields: TplField[]): MappingTarget[] {
  const targets: MappingTarget[] = [];
  for (const f of fields) {
    if (f.field_type === "repeater") {
      for (const sf of parseSubFields(f.field_options)) {
        targets.push({
          assignedKey:   `${f.field_key}${REPEATER_SEP}${sf.name}`,
          label:         `${f.field_label} → ${sf.label}`,
          fieldKey:      f.field_key,
          fieldType:     f.field_type,
          repeaterKey:   f.field_key,
          subFieldName:  sf.name,
          subFieldType:  sf.type,
          repeaterLabel: f.field_label,
        });
      }
    } else if (f.field_type !== "offence_search") {
      targets.push({
        assignedKey: f.field_key,
        label:       f.field_label,
        fieldKey:    f.field_key,
        fieldType:   f.field_type,
      });
    }
  }
  return targets;
}

function mergeResults(results: ParseResponse[]): ParseResponse {
  return {
    raw_text:          results.map((r) => r.raw_text ?? "").filter(Boolean).join("\n\n---\n\n"),
    extraction_method: [...new Set(results.map((r) => r.extraction_method))].join(", "),
    warning:           results.map((r) => r.warning).filter(Boolean).join(" ") || undefined,
  };
}

function buildMappingRows(targets: MappingTarget[], llmMappings: LLMMapping[]): MappingRow[] {
  return llmMappings.map((m, idx) => {
    const target = targets.find((t) => t.assignedKey === m.field_key || t.fieldKey === m.field_key);
    return {
      pairIndex:           idx,
      label:               target?.label ?? m.field_key,
      value:               m.value,
      suggestedKey:        target?.assignedKey ?? IGNORE_VALUE,
      suggestedConfidence: m.confidence,
      suggestedReasoning:  m.reasoning,
      assignedKey:         target?.assignedKey ?? IGNORE_VALUE,
    };
  });
}

function assembleApplyValues(
  mappingRows: MappingRow[],
  editedValues: Record<string, string>,
  excluded: Set<string>,
  targets: MappingTarget[],
): { values: ApplyValues; autoKeys: Set<string> } {
  const values: ApplyValues       = {};
  const autoKeys                  = new Set<string>();
  const targetMap                 = new Map(targets.map((t) => [t.assignedKey, t]));
  const repeaterSubValues         = new Map<string, Record<string, string>>();

  for (const row of mappingRows) {
    if (row.assignedKey === IGNORE_VALUE) continue;
    if (excluded.has(row.assignedKey)) continue;
    const val = (editedValues[row.assignedKey] ?? row.value).trim();
    if (!val) continue;
    const target = targetMap.get(row.assignedKey);
    if (!target) continue;

    if (target.repeaterKey && target.subFieldName) {
      if (!repeaterSubValues.has(target.repeaterKey)) repeaterSubValues.set(target.repeaterKey, {});
      repeaterSubValues.get(target.repeaterKey)![target.subFieldName] = val;
      autoKeys.add(target.repeaterKey);
    } else {
      values[target.fieldKey] = val;
      autoKeys.add(target.fieldKey);
    }
  }

  for (const [repKey, subMap] of repeaterSubValues) {
    let maxSegments = 1;
    const segmented: Record<string, string[]> = {};
    for (const [sfName, sfVal] of Object.entries(subMap)) {
      const parts = sfVal.split(" | ").map((s) => s.trim()).filter(Boolean);
      segmented[sfName] = parts;
      if (parts.length > maxSegments) maxSegments = parts.length;
    }
    const rows: Record<string, string>[] = [];
    for (let r = 0; r < maxSegments; r++) {
      const row: Record<string, string> = {};
      for (const [sfName, parts] of Object.entries(segmented)) row[sfName] = parts[r] ?? parts[0] ?? "";
      rows.push(row);
    }
    values[repKey] = rows;
  }

  return { values, autoKeys };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", mt: 2, mb: 0.5 }}>
      {STEP_LABELS.map((s, idx) => {
        const done   = idx < step;
        const active = idx === step;
        return (
          <Box key={s.id} sx={{ display: "flex", alignItems: "center", flex: idx < STEP_LABELS.length - 1 ? 1 : "none" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{
                width: 24, height: 24, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: done || active ? "#395B45" : "#E5E7EB",
                flexShrink: 0, transition: "background-color 0.2s",
              }}>
                {done
                  ? <CheckCircle size={13} color="#fff" />
                  : <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: active ? "#fff" : "#9CA3AF" }}>{idx + 1}</Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: { xs: "0.68rem", sm: "0.74rem" },
                fontWeight: active ? 700 : 500,
                color: done || active ? "#374151" : "#9CA3AF",
                whiteSpace: "nowrap",
                display: { xs: idx === step ? "block" : "none", sm: "block" },
              }}>
                {s.label}
              </Typography>
            </Box>
            {idx < STEP_LABELS.length - 1 && (
              <Box sx={{ flex: 1, height: "2px", bgcolor: done ? "#395B45" : "#E5E7EB", mx: { xs: 0.75, sm: 1.25 }, borderRadius: 1, transition: "background-color 0.2s" }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — Template selector + file upload
// ─────────────────────────────────────────────────────────────────────────────

interface Step0Props {
  templates: Template[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  files: FileEntry[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  error: string;
  onClearError: () => void;
}

function Step0({
  templates, loadingTemplates, selectedTemplateId, onSelectTemplate,
  files, onAddFiles, onRemoveFile, onClearFiles, inputRef, onDrop, error, onClearError,
}: Step0Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {error && (
        <Alert severity="error" onClose={onClearError} sx={{ borderRadius: 1.5 }}>{error}</Alert>
      )}

      {/* Template selector */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#395B45", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff" }}>1</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>
            Choose a template
          </Typography>
        </Box>
        {loadingTemplates ? (
          <Skeleton height={52} sx={{ borderRadius: 1.5 }} />
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel id="wiz-tpl-label">Select template…</InputLabel>
            <Select
              labelId="wiz-tpl-label"
              label="Select template…"
              value={selectedTemplateId}
              onChange={(e) => onSelectTemplate(e.target.value)}
              renderValue={(val) => {
                const t = templates.find((t) => t.id === val);
                return <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>{t?.name ?? String(val)}</Typography>;
              }}
              sx={{
                bgcolor: "#fff",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: selectedTemplateId ? "#395B45" : "#E5E7EB" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                "& .MuiSelect-select": { py: 1.5 },
              }}
            >
              {templates.length === 0 ? (
                <MenuItem disabled>
                  <Typography sx={{ fontSize: "0.85rem", color: "#9CA3AF" }}>No active templates found</Typography>
                </MenuItem>
              ) : (
                templates.map((t) => (
                  <MenuItem key={t.id} value={t.id} sx={{ py: 1.25 }}>
                    <Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>{t.name}</Typography>
                      {t.description && (
                        <Typography sx={{ fontSize: "0.75rem", color: "#6B7280", mt: 0.25 }}>{t.description}</Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* File upload */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#395B45", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff" }}>2</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>
            Upload source documents
          </Typography>
        </Box>

        <Paper
          variant="outlined"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: "2px dashed", borderRadius: 2,
            borderColor: files.length > 0 ? "#395B45" : "#D1D5DB",
            bgcolor: files.length > 0 ? "rgba(57,91,69,0.04)" : "#FAFAFA",
            p: { xs: 3, sm: 4 }, textAlign: "center", cursor: "pointer", transition: "all 0.2s",
            "&:hover": { borderColor: "#395B45", bgcolor: "rgba(57,91,69,0.04)" },
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) onAddFiles(e.target.files); e.target.value = ""; }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <Box sx={{ bgcolor: files.length > 0 ? "rgba(57,91,69,0.1)" : "#F3F4F6", borderRadius: "50%", p: 1.5, display: "flex", transition: "all 0.2s" }}>
              <Upload size={24} color={files.length > 0 ? "#395B45" : "#9CA3AF"} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, color: "#374151", fontSize: "0.95rem" }}>
                Drop files here or click to browse
              </Typography>
              <Typography sx={{ color: "#9CA3AF", fontSize: "0.8rem", mt: 0.5 }}>
                PDF, DOCX, TXT, JPG, PNG — up to 10 MB each
              </Typography>
            </Box>
          </Box>
        </Paper>

        {files.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#374151" }}>
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </Typography>
              <Button size="small" onClick={onClearFiles}
                sx={{ color: "#9CA3AF", textTransform: "none", fontSize: "0.75rem", minHeight: "unset", p: 0.5 }}>
                Clear all
              </Button>
            </Box>
            <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {files.map((entry) => (
                <ListItem key={entry.id} disablePadding
                  sx={{ bgcolor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 1.5, px: 1.5, py: 0.875, display: "flex", alignItems: "center", gap: 1 }}>
                  <FileText size={16} color="#6B7280" style={{ flexShrink: 0 }} />
                  <ListItemText
                    primary={entry.file.name}
                    secondary={formatBytes(entry.file.size)}
                    primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", noWrap: true }}
                    secondaryTypographyProps={{ fontSize: "0.72rem", color: "#9CA3AF" }}
                    sx={{ overflow: "hidden" }}
                  />
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemoveFile(entry.id); }}
                    sx={{ color: "#9CA3AF", "&:hover": { color: "#EF4444" }, flexShrink: 0 }}>
                    <Trash2 size={14} />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: "#F0F9FF", borderRadius: 1.5, border: "1px solid #BAE6FD", display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "flex-start" }}>
          <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 700, whiteSpace: "nowrap" }}>Tip:</Typography>
          <Typography variant="caption" sx={{ color: "#0369A1" }}>
            Upload custody records and interview notes together for best results. DOCX and TXT files extract most accurately.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Processing (extraction + field matching)
// ─────────────────────────────────────────────────────────────────────────────

function Step1({ files, llmPending }: { files: FileEntry[]; llmPending: boolean }) {
  const done    = files.filter((f) => f.status === "done").length;
  const errored = files.filter((f) => f.status === "error").length;
  const total   = files.length;
  const pct     = total > 0 ? Math.round(((done + errored) / total) * 100) : 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ textAlign: "center", py: 2 }}>
        <CircularProgress sx={{ color: "#395B45", mb: 2 }} size={44} thickness={4} />
        <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "1rem", mb: 0.5 }}>
          {llmPending ? "Matching fields…" : `Processing ${total} file${total !== 1 ? "s" : ""}…`}
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: "#6B7280" }}>
          {llmPending
            ? "Analysing extracted content and mapping to template fields"
            : `${done} of ${total} complete${errored > 0 ? ` · ${errored} failed` : ""}`}
        </Typography>
        {llmPending ? (
          <LinearProgress variant="indeterminate"
            sx={{ mt: 2, mx: "auto", maxWidth: 360, borderRadius: 4, height: 6, bgcolor: "#E5E7EB", "& .MuiLinearProgress-bar": { bgcolor: "#395B45" } }} />
        ) : (
          <LinearProgress variant="determinate" value={pct}
            sx={{ mt: 2, mx: "auto", maxWidth: 360, borderRadius: 4, height: 6, bgcolor: "#E5E7EB", "& .MuiLinearProgress-bar": { bgcolor: "#395B45" } }} />
        )}
      </Box>

      <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {files.map((entry) => (
          <ListItem key={entry.id} disablePadding
            sx={{
              bgcolor: "#F9FAFB", border: "1px solid",
              borderColor: entry.status === "done"    ? "#BBF7D0"
                         : entry.status === "error"   ? "#FECACA"
                         : entry.status === "parsing" ? "#BAE6FD"
                         : "#E5E7EB",
              borderRadius: 1.5, px: 1.5, py: 1, gap: 1.25,
            }}>
            <Box sx={{ flexShrink: 0, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {entry.status === "done"    && <CheckCircle size={16} color="#16A34A" />}
              {entry.status === "error"   && <AlertCircle size={16} color="#DC2626" />}
              {entry.status === "parsing" && <CircularProgress size={15} sx={{ color: "#0284C7" }} />}
              {entry.status === "pending" && <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#D1D5DB" }} />}
            </Box>
            <ListItemText
              primary={entry.file.name}
              secondary={
                entry.status === "error"   ? entry.error
                : entry.status === "done"    ? "Text extracted successfully"
                : entry.status === "parsing" ? "Extracting text…"
                : "Waiting…"
              }
              primaryTypographyProps={{ fontSize: "0.83rem", fontWeight: 600, color: "#111827", noWrap: true }}
              secondaryTypographyProps={{
                fontSize: "0.73rem",
                color: entry.status === "error"   ? "#DC2626"
                     : entry.status === "done"    ? "#16A34A"
                     : "#6B7280",
              }}
            />
          </ListItem>
        ))}
      </List>

      {llmPending && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, bgcolor: "#F0FDF4", borderRadius: 1.5, border: "1px solid #BBF7D0" }}>
          <Wand2 size={16} color="#395B45" style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.82rem", color: "#15803D", fontWeight: 500 }}>
            Analysing extracted text and matching to template fields…
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Field mapping confirmation
// ─────────────────────────────────────────────────────────────────────────────

interface Step2Props {
  rows: MappingRow[];
  targets: MappingTarget[];
  assignedKeys: Set<string>;
  onAssign: (pairIndex: number, key: string) => void;
  warning?: string;
}

function Step2({ rows, targets, assignedKeys, onAssign, warning }: Step2Props) {
  const mappedCount  = rows.filter((r) => r.assignedKey !== IGNORE_VALUE).length;
  const ignoredCount = rows.length - mappedCount;

  const { scalarTargets, repeaterGroups } = useMemo(() => {
    const scalars  = targets.filter((t) => !t.repeaterKey).sort((a, b) => a.label.localeCompare(b.label));
    const groupMap = new Map<string, { label: string; items: MappingTarget[] }>();
    for (const t of targets) {
      if (!t.repeaterKey) continue;
      if (!groupMap.has(t.repeaterKey!)) groupMap.set(t.repeaterKey!, { label: t.repeaterLabel!, items: [] });
      groupMap.get(t.repeaterKey!)!.items.push(t);
    }
    return { scalarTargets: scalars, repeaterGroups: Array.from(groupMap.values()) };
  }, [targets]);

  return (
    <Box>
      {warning && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>{warning}</Alert>
      )}

      {/* Stats bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          {[
            { value: rows.length,  label: "extracted", color: "#374151" },
            { value: mappedCount,  label: "mapped",    color: "#395B45" },
            { value: ignoredCount, label: "ignored",   color: "#9CA3AF" },
          ].map(({ value, label, color }) => (
            <Box key={label} sx={{ textAlign: "center", px: 1.5, py: 0.75, bgcolor: "#F9FAFB", borderRadius: 1.5, border: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF", mt: 0.25 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Column headers */}
      <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "1fr 28px 1fr", gap: 1, px: 1, mb: 1 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Extracted from document
        </Typography>
        <Box />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Map to template field
        </Typography>
      </Box>

      {rows.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <AlertCircle size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 10px" }} />
          <Typography sx={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
            No fields were extracted. Try a different document or format.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875 }}>
          {rows.map((row) => {
            const isMapped      = row.assignedKey !== IGNORE_VALUE;
            const target        = targets.find((t) => t.assignedKey === row.assignedKey);
            const isRepeater    = Boolean(target?.repeaterKey);
            const hasSuggestion = Boolean(row.suggestedKey);

            return (
              <Paper key={row.pairIndex} variant="outlined"
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 28px 1fr" },
                  gap: { xs: 1, sm: 1.25 },
                  p: 1.5, borderRadius: 1.5,
                  borderColor: isMapped ? (isRepeater ? "#C7D2FE" : "#BBF7D0") : "#E5E7EB",
                  bgcolor:     isMapped ? (isRepeater ? "#EEF2FF" : "#F0FDF4") : "#FAFAFA",
                  alignItems: "center", transition: "all 0.15s",
                }}
              >
                {/* Source value */}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.375 }}>
                    From document
                  </Typography>
                  <Typography sx={{ fontSize: "0.77rem", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.label}
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "#111827", fontWeight: 700, mt: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.value}
                  </Typography>
                  {hasSuggestion && isMapped && row.assignedKey === row.suggestedKey && row.suggestedReasoning && (
                    <Typography sx={{ fontSize: "0.68rem", color: "#9CA3AF", mt: 0.25, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.suggestedReasoning}
                    </Typography>
                  )}
                  {hasSuggestion && (
                    <Tooltip title={row.suggestedReasoning || ""} placement="bottom-start">
                      <span>
                        <Chip label={confidenceLabel(row.suggestedConfidence)} size="small"
                          color={confidenceColor(row.suggestedConfidence)} variant="outlined"
                          sx={{ mt: 0.5, height: 16, fontSize: "0.6rem", fontWeight: 700, cursor: "help" }} />
                      </span>
                    </Tooltip>
                  )}
                </Box>

                {/* Arrow */}
                <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "center" }}>
                  {isMapped
                    ? <Link2    size={15} color={isRepeater ? "#6366F1" : "#395B45"} />
                    : <Link2Off size={15} color="#D1D5DB" />
                  }
                </Box>

                {/* Target dropdown */}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.5, display: { xs: "block", sm: "none" } }}>
                    Map to field
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={row.assignedKey}
                      onChange={(e) => onAssign(row.pairIndex, e.target.value)}
                      displayEmpty
                      IconComponent={ChevronDown}
                      MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                      sx={{
                        fontSize: "0.82rem", bgcolor: "#fff",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: isMapped ? (isRepeater ? "#C7D2FE" : "#BBF7D0") : "#E5E7EB" },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                      }}
                      renderValue={(val) => {
                        if (!val) return <Typography sx={{ fontSize: "0.82rem", color: "#9CA3AF", fontStyle: "italic" }}>— Ignore —</Typography>;
                        const t = targets.find((t) => t.assignedKey === val);
                        return (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                            {t?.repeaterKey && <Layers size={12} color="#6366F1" style={{ flexShrink: 0 }} />}
                            <Typography sx={{ fontSize: "0.82rem", color: "#111827", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t?.label ?? val}
                            </Typography>
                            {hasSuggestion && val === row.suggestedKey && (
                              <Chip label={confidenceLabel(row.suggestedConfidence)} size="small"
                                color={confidenceColor(row.suggestedConfidence)} variant="outlined"
                                sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700, flexShrink: 0 }} />
                            )}
                          </Box>
                        );
                      }}
                    >
                      <MenuItem value={IGNORE_VALUE}>
                        <Typography sx={{ fontSize: "0.82rem", color: "#9CA3AF", fontStyle: "italic" }}>— Ignore —</Typography>
                      </MenuItem>

                      {scalarTargets.length > 0 && [
                        <Divider key="div-scalar" sx={{ my: 0.5 }} />,
                        <Box key="hdr-scalar" sx={{ px: 2, py: 0.5 }}>
                          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Standard Fields
                          </Typography>
                        </Box>,
                        ...scalarTargets.map((t) => {
                          const inUse = assignedKeys.has(t.assignedKey) && t.assignedKey !== row.assignedKey;
                          return (
                            <MenuItem key={t.assignedKey} value={t.assignedKey} disabled={inUse}
                              sx={{
                                fontSize: "0.82rem", opacity: inUse ? 0.4 : 1,
                                bgcolor: t.assignedKey === row.suggestedKey && !inUse ? "rgba(57,91,69,0.06)" : "transparent",
                                "&:hover": { bgcolor: "rgba(57,91,69,0.1)" },
                              }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                                <Typography sx={{ fontSize: "0.82rem" }}>{t.label}</Typography>
                                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                                  {t.assignedKey === row.suggestedKey && !inUse && (
                                    <Chip label={confidenceLabel(row.suggestedConfidence)} size="small"
                                      color={confidenceColor(row.suggestedConfidence)} variant="outlined"
                                      sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700 }} />
                                  )}
                                  {inUse && <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF" }}>in use</Typography>}
                                </Box>
                              </Box>
                            </MenuItem>
                          );
                        }),
                      ]}

                      {repeaterGroups.map((group) => [
                        <Divider key={`div-${group.label}`} sx={{ my: 0.5 }} />,
                        <Box key={`hdr-${group.label}`} sx={{ px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Layers size={13} color="#6366F1" />
                          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#6366F1", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {group.label}
                          </Typography>
                        </Box>,
                        ...group.items.map((t) => {
                          const inUse = assignedKeys.has(t.assignedKey) && t.assignedKey !== row.assignedKey;
                          return (
                            <MenuItem key={t.assignedKey} value={t.assignedKey} disabled={inUse}
                              sx={{
                                fontSize: "0.82rem", pl: 3, opacity: inUse ? 0.4 : 1,
                                bgcolor: t.assignedKey === row.suggestedKey && !inUse ? "rgba(99,102,241,0.06)" : "transparent",
                                "&:hover": { bgcolor: "rgba(99,102,241,0.1)" },
                              }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                                <Typography sx={{ fontSize: "0.82rem" }}>{t.label.split(" → ")[1] ?? t.subFieldName}</Typography>
                                {inUse && <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF", flexShrink: 0 }}>in use</Typography>}
                              </Box>
                            </MenuItem>
                          );
                        }),
                      ])}
                    </Select>
                  </FormControl>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Review & edit values before applying
// ─────────────────────────────────────────────────────────────────────────────

interface Step3Props {
  mappedRows: MappingRow[];
  targets: MappingTarget[];
  editedValues: Record<string, string>;
  excluded: Set<string>;
  onEditValue: (assignedKey: string, value: string) => void;
  onToggleExclude: (assignedKey: string) => void;
  warning?: string;
}

function Step3({ mappedRows, targets, editedValues, excluded, onEditValue, onToggleExclude, warning }: Step3Props) {
  const targetMap = useMemo(() => new Map(targets.map((t) => [t.assignedKey, t])), [targets]);
  const willApply = mappedRows.filter((r) => !excluded.has(r.assignedKey)).length;
  const highCount = mappedRows.filter((r) => r.suggestedConfidence >= 0.9 && !excluded.has(r.assignedKey)).length;

  const groups = useMemo(() => {
    const scalars: MappingRow[] = [];
    const byRepeater = new Map<string, { label: string; rows: MappingRow[] }>();
    for (const row of mappedRows) {
      const t = targetMap.get(row.assignedKey);
      if (!t) continue;
      if (t.repeaterKey) {
        if (!byRepeater.has(t.repeaterKey)) byRepeater.set(t.repeaterKey, { label: t.repeaterLabel!, rows: [] });
        byRepeater.get(t.repeaterKey)!.rows.push(row);
      } else {
        scalars.push(row);
      }
    }
    return { scalars, repeaterGroups: Array.from(byRepeater.values()) };
  }, [mappedRows, targetMap]);

  function renderRow(row: MappingRow) {
    const t          = targetMap.get(row.assignedKey);
    const isExcluded = excluded.has(row.assignedKey);
    const isUserMap  = row.assignedKey !== row.suggestedKey;
    const isRepeater = Boolean(t?.repeaterKey);
    const currentVal = editedValues[row.assignedKey] ?? row.value;
    const fieldType  = t?.subFieldType ?? t?.fieldType ?? "text";

    return (
      <Paper key={row.pairIndex} variant="outlined"
        sx={{
          p: 1.5, borderRadius: 1.5,
          borderColor: isExcluded ? "#E5E7EB" : isRepeater ? "#C7D2FE" : row.suggestedConfidence >= 0.9 ? "#BBF7D0" : "#FDE68A",
          bgcolor:     isExcluded ? "#FAFAFA" : isRepeater ? "#EEF2FF" : row.suggestedConfidence >= 0.9 ? "#F0FDF4" : "#FFFBEB",
          opacity: isExcluded ? 0.55 : 1, transition: "all 0.15s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box component="input" type="checkbox" checked={!isExcluded}
            onChange={() => onToggleExclude(row.assignedKey)}
            style={{ marginTop: 4, cursor: "pointer", accentColor: "#395B45", width: 15, height: 15, flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.875, flexWrap: "wrap" }}>
              {isRepeater && <Layers size={13} color="#6366F1" style={{ flexShrink: 0 }} />}
              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#111827" }}>
                {t?.label ?? row.assignedKey}
              </Typography>
              {isUserMap ? (
                <Chip label="User mapped" size="small" variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, color: "#6B7280", borderColor: "#D1D5DB" }} />
              ) : (
                <Chip label={confidenceLabel(row.suggestedConfidence)} size="small"
                  color={confidenceColor(row.suggestedConfidence)} variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
              )}
              <Tooltip title={`Extracted label: "${row.label}"`}>
                <Typography variant="caption" sx={{ color: "#9CA3AF", cursor: "help", fontSize: "0.7rem" }}>
                  from "{row.label}"
                </Typography>
              </Tooltip>
            </Box>

            {fieldType === "textarea" ? (
              <TextField fullWidth size="small" multiline minRows={2}
                value={currentVal} disabled={isExcluded}
                onChange={(e) => onEditValue(row.assignedKey, e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.82rem" } }}
              />
            ) : (
              <TextField fullWidth size="small"
                type={fieldType === "date" ? "date" : "text"}
                value={currentVal} disabled={isExcluded}
                onChange={(e) => onEditValue(row.assignedKey, e.target.value)}
                slotProps={fieldType === "date" ? { inputLabel: { shrink: true } } : {}}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.82rem" } }}
              />
            )}
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      {warning && (
        <Alert severity="warning" icon={<Info size={16} />} sx={{ mb: 2, borderRadius: 1.5 }}>{warning}</Alert>
      )}

      {/* Stats bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          {[
            { value: mappedRows.length, label: "mapped",     color: "#395B45" },
            { value: highCount,         label: "high conf",  color: "#16A34A" },
            { value: willApply,         label: "applying",   color: "#374151" },
          ].map(({ value, label, color }) => (
            <Box key={label} sx={{ textAlign: "center", px: 1.5, py: 0.75, bgcolor: "#F9FAFB", borderRadius: 1.5, border: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF", mt: 0.25 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
        <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.85rem" }}>
          Review values before applying
        </Typography>
        <Typography variant="caption" sx={{ color: "#9CA3AF", fontSize: "0.72rem" }}>
          Edit · uncheck to skip
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {groups.scalars.map(renderRow)}

        {groups.repeaterGroups.map((group) => (
          <Box key={group.label}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, mb: 0.875 }}>
              <Layers size={15} color="#6366F1" />
              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#6366F1" }}>{group.label}</Typography>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "#C7D2FE" }} />
              <Typography variant="caption" sx={{ color: "#818CF8", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                {(() => {
                  const maxRows = Math.max(1, ...group.rows.map((r) =>
                    (editedValues[r.assignedKey] ?? r.value).split(" | ").filter(Boolean).length
                  ));
                  return `Will create ${maxRows} row${maxRows !== 1 ? "s" : ""}`;
                })()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.rows.map(renderRow)}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

export default function DocWizardModal({ open, onClose, onConfirm }: Props) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Template list ──────────────────────────────────────────────────────────
  const [templates, setTemplates]               = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateFields, setTemplateFields]     = useState<TplField[]>([]);

  // ── Wizard state ───────────────────────────────────────────────────────────
  const [step, setStep]               = useState<WizardStep>(0);
  const [files, setFiles]             = useState<FileEntry[]>([]);
  const [llmPending, setLlmPending]   = useState(false);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mergedWarning, setMergedWarning] = useState<string | undefined>();
  const [error, setError]             = useState("");

  // ── Review state ───────────────────────────────────────────────────────────
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [excluded, setExcluded]         = useState<Set<string>>(new Set());

  const targets = useMemo(() => buildMappingTargets(templateFields), [templateFields]);

  const assignedKeys = useMemo<Set<string>>(
    () => new Set(mappingRows.map((r) => r.assignedKey).filter(Boolean)),
    [mappingRows],
  );

  const mappedRows = useMemo(
    () => mappingRows.filter((r) => r.assignedKey !== IGNORE_VALUE),
    [mappingRows],
  );

  const mappedCount  = mappingRows.filter((r) => r.assignedKey !== IGNORE_VALUE).length;
  const applyingCount = mappedRows.filter((r) => !excluded.has(r.assignedKey)).length;

  // ── Load templates on open ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    const supabase = createClient();
    supabase
      .from("templates")
      .select("id, name, description")
      .eq("is_active", true)
      .order("name")
      .then(
        (res: { data: Template[] | null; error: { message: string } | null }) => {
          if (!res.error && res.data) setTemplates(res.data);
          setLoadingTemplates(false);
        }
      );
  }, [open]);

  // ── Load fields when template changes ────────────────────────────────────

  useEffect(() => {
    if (!selectedTemplateId) { setTemplateFields([]); return; }
    fetch(`/api/templates/${selectedTemplateId}/fields`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setTemplateFields(j.data as TplField[]); })
      .catch(() => {});
  }, [selectedTemplateId]);

  // ── File helpers ──────────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    setFiles((prev) => [
      ...prev,
      ...Array.from(incoming).map((f) => ({ id: uid(), file: f, status: "pending" as FileStatus, result: null, error: "" })),
    ]);
    setError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (step !== 0 || !e.dataTransfer.files.length) return;
    addFiles(e.dataTransfer.files);
  }

  // ── Extraction + field matching ───────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    if (!files.length || !selectedTemplateId || !templateFields.length) return;
    setStep(1);
    setError("");
    setLlmPending(false);

    const completed: ParseResponse[] = [];
    const fileErrors = new Map<string, string>();

    for (const entry of files) {
      setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "parsing" } : e));
      try {
        const body = new FormData();
        body.append("file", entry.file);
        const res = await fetch("/api/parse-document", { method: "POST", body });

        let json: Record<string, unknown>;
        try {
          json = await res.json();
        } catch {
          const errMsg = res.status === 413
            ? "File too large — server rejected (HTTP 413). Try a smaller file."
            : `Upload failed with HTTP ${res.status}.`;
          fileErrors.set(entry.id, errMsg);
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: errMsg } : e));
          continue;
        }

        if (!res.ok) {
          const raw: string = (json?.error as string) ?? `Server error ${res.status}`;
          let friendly = raw;
          if (/not configured|credential|no-credentials/i.test(raw)) {
            friendly = "Image/PDF extraction not configured. Use DOCX or TXT instead.";
          } else if (/blank|unreadable|no content/i.test(raw)) {
            friendly = "No readable text found — the document may be blank or poor quality.";
          } else {
            friendly = `Error (${res.status}): ${raw.slice(0, 200)}`;
          }
          fileErrors.set(entry.id, friendly);
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: friendly } : e));
        } else {
          const data = (json as { data: ParseResponse }).data;
          completed.push(data);
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "done", result: data } : e));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error.";
        fileErrors.set(entry.id, msg);
        setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: msg } : e));
      }
    }

    if (!completed.length) {
      const first = files.find((f) => fileErrors.has(f.id));
      setError(fileErrors.get(first?.id ?? "") || "No files could be processed. Please check the file errors above.");
      setStep(0);
      return;
    }

    const merged = mergeResults(completed);
    setMergedWarning(merged.warning);

    setLlmPending(true);
    let llmMappings: LLMMapping[] = [];
    try {
      const llmRes = await fetch("/api/llm-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: merged.raw_text,
          template_fields: templateFields.map(({ field_key, field_label, field_type }) => ({
            field_key, field_label, field_type,
          })),
        }),
      });
      if (llmRes.ok) {
        const llmJson = await llmRes.json();
        llmMappings = llmJson.data?.mappings ?? [];
      }
    } catch { /* proceed without suggestions */ }
    setLlmPending(false);

    const rows = buildMappingRows(targets, llmMappings);
    setMappingRows(rows);
    // Pre-seed editedValues with extracted values for review step
    const initialEdits: Record<string, string> = {};
    for (const row of rows) {
      if (row.assignedKey !== IGNORE_VALUE) initialEdits[row.assignedKey] = row.value;
    }
    setEditedValues(initialEdits);
    setExcluded(new Set());
    setStep(2);
  }, [files, selectedTemplateId, templateFields, targets]);

  // ── Proceed from mapping → review ─────────────────────────────────────────

  function handleProceedToReview() {
    // Sync editedValues for any rows whose assignedKey changed during mapping
    setEditedValues((prev) => {
      const next = { ...prev };
      for (const row of mappingRows) {
        if (row.assignedKey !== IGNORE_VALUE && !(row.assignedKey in next)) {
          next[row.assignedKey] = row.value;
        }
      }
      return next;
    });
    setStep(3);
  }

  // ── Apply / confirm ───────────────────────────────────────────────────────

  function handleApply() {
    const { values, autoKeys } = assembleApplyValues(mappedRows, editedValues, excluded, targets);
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    onConfirm({
      templateId:     selectedTemplateId,
      templateName:   tpl?.name ?? "",
      values,
      autoFilledKeys: autoKeys,
    });
    handleClose();
  }

  // ── Reset / close ─────────────────────────────────────────────────────────

  function reset() {
    setStep(0);
    setFiles([]);
    setMappingRows([]);
    setMergedWarning(undefined);
    setError("");
    setLlmPending(false);
    setSelectedTemplateId("");
    setTemplateFields([]);
    setEditedValues({});
    setExcluded(new Set());
  }

  function handleClose() {
    if (step === 1) return;
    reset();
    onClose();
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const canExtract = files.length > 0 && Boolean(selectedTemplateId) && templateFields.length > 0;

  const tooltipTitle = !selectedTemplateId
    ? "Select a template first"
    : !files.length
    ? "Add at least one file"
    : templateFields.length === 0
    ? "Template has no fields configured"
    : "";

  return (
    <Dialog
      open={open}
      onClose={step === 1 ? undefined : handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius:  isMobile ? 0 : 3,
            height:        isMobile ? "100dvh" : "88vh",
            maxHeight:     isMobile ? "100dvh" : "88vh",
            display:       "flex",
            flexDirection: "column",
            m:             isMobile ? 0 : 2,
            overflow:      "hidden",
            boxShadow:     "0 25px 50px -12px rgba(0,0,0,0.18)",
          },
        },
      }}
    >
      {/* ── Pinned header ──────────────────────────────────────────────────── */}
      <DialogTitle
        component="div"
        sx={{ pb: 0, pt: { xs: 2, sm: 2.5 }, px: { xs: 2, sm: 3 }, flexShrink: 0, borderBottom: "1px solid #F3F4F6" }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box sx={{ bgcolor: "#395B45", borderRadius: 1.5, p: 0.875, display: "flex" }}>
              <Wand2 size={20} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, color: "#111827", lineHeight: 1.2 }}>
                Doc Wizard
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: "#6B7280", display: { xs: "none", sm: "block" }, mt: 0.25 }}>
                Upload documents · extract fields · confirm mappings · review
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} disabled={step === 1} size="small"
            sx={{ color: "#9CA3AF", mt: -0.25, width: 36, height: 36, "&:hover": { bgcolor: "#F3F4F6" } }}>
            <X size={18} />
          </IconButton>
        </Box>
        <StepIndicator step={step} />
      </DialogTitle>

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1,
          flex: 1, overflowY: "auto",
          "&::-webkit-scrollbar":            { width: 6 },
          "&::-webkit-scrollbar-track":      { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb":      { bgcolor: "#D1D5DB", borderRadius: 3 },
          "&::-webkit-scrollbar-thumb:hover":{ bgcolor: "#9CA3AF" },
        }}
      >
        {step === 0 && (
          <Step0
            templates={templates}
            loadingTemplates={loadingTemplates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={setSelectedTemplateId}
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={(id) => setFiles((prev) => prev.filter((e) => e.id !== id))}
            onClearFiles={() => setFiles([])}
            inputRef={inputRef}
            onDrop={handleDrop}
            error={error}
            onClearError={() => setError("")}
          />
        )}

        {step === 1 && (
          <Step1 files={files} llmPending={llmPending} />
        )}

        {step === 2 && (
          <Step2
            rows={mappingRows}
            targets={targets}
            assignedKeys={assignedKeys}
            onAssign={(pairIndex, key) =>
              setMappingRows((prev) => prev.map((r) => r.pairIndex === pairIndex ? { ...r, assignedKey: key } : r))
            }
            warning={mergedWarning}
          />
        )}

        {step === 3 && (
          <Step3
            mappedRows={mappedRows}
            targets={targets}
            editedValues={editedValues}
            excluded={excluded}
            onEditValue={(key, val) => setEditedValues((prev) => ({ ...prev, [key]: val }))}
            onToggleExclude={(key) =>
              setExcluded((prev) => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })
            }
            warning={mergedWarning}
          />
        )}
      </DialogContent>

      {/* ── Pinned footer ──────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 },
          borderTop: "1px solid #F3F4F6", flexShrink: 0,
          gap: 1, justifyContent: "space-between", bgcolor: "#FAFAFA",
        }}
      >
        {step === 0 && (
          <>
            <Button onClick={handleClose}
              sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
              Cancel
            </Button>
            <Tooltip title={tooltipTitle} disableHoverListener={canExtract}>
              <span>
                <Button variant="contained" onClick={handleExtract} disabled={!canExtract}
                  startIcon={<FileText size={16} />}
                  sx={{
                    bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
                    fontWeight: 600, textTransform: "none",
                    minWidth: { xs: 160, sm: 200 }, minHeight: 44, boxShadow: "none",
                  }}>
                  Process {files.length > 0 ? `${files.length} ` : ""}File{files.length !== 1 ? "s" : ""}
                </Button>
              </span>
            </Tooltip>
          </>
        )}

        {step === 1 && (
          <>
            <Typography variant="caption" sx={{ color: "#9CA3AF", alignSelf: "center" }}>
              {llmPending ? "Matching fields…" : "Extracting document text…"}
            </Typography>
            <Button variant="contained" disabled
              startIcon={<CircularProgress size={15} color="inherit" />}
              sx={{ bgcolor: "#395B45", fontWeight: 600, textTransform: "none", minWidth: 140, minHeight: 44, boxShadow: "none" }}>
              {llmPending ? "Matching…" : "Processing…"}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Button onClick={() => setStep(0)}
              startIcon={<ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />}
              sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
              Start Over
            </Button>
            <Button variant="contained" onClick={handleProceedToReview}
              disabled={mappedCount === 0}
              endIcon={<ArrowRight size={16} />}
              sx={{
                bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
                fontWeight: 600, textTransform: "none",
                minWidth: { xs: 160, sm: 200 }, minHeight: 44, boxShadow: "none",
              }}>
              Review {mappedCount} Field{mappedCount !== 1 ? "s" : ""}
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <Button onClick={() => setStep(2)}
              startIcon={<ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />}
              sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
              Back to Mapping
            </Button>
            <Button variant="contained" onClick={handleApply}
              disabled={applyingCount === 0}
              endIcon={<CheckCircle size={16} />}
              sx={{
                bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
                fontWeight: 600, textTransform: "none",
                minWidth: { xs: 160, sm: 210 }, minHeight: 44, boxShadow: "none",
              }}>
              Apply {applyingCount} Field{applyingCount !== 1 ? "s" : ""}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
