"use client";

import {
  useRef, useState, useCallback, useEffect, useMemo,
} from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, CircularProgress, Alert,
  Chip, TextField, Tooltip, IconButton, Paper,
  LinearProgress, List, ListItem, ListItemText,
  Tabs, Tab, Select, MenuItem, FormControl,
  Divider, useMediaQuery, useTheme,
} from "@mui/material";
import {
  Upload, X, FileText, CheckCircle, AlertCircle, Info,
  Wand2, Trash2, Eye, Camera, ZoomIn, ArrowRight,
  Link2, Link2Off, ChevronDown, Layers, Copy,
} from "lucide-react";
import type { LLMMapping } from "@/app/api/llm-map/route";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RepeaterSubField {
  name: string;
  label: string;
  type: "text" | "dropdown" | "date" | "offence_search";
  options?: string[];
}

export interface TplField {
  field_key: string;
  field_label: string;
  field_type: string;
  field_options?: RepeaterSubField[] | string[] | null;
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

/**
 * Flat assignable target derived from template fields.
 *   scalar  → assignedKey = "field_key"
 *   repeater → assignedKey = "repeaterKey::subFieldName"
 */
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

export type ApplyValues = Record<string, string | Record<string, string | string[]>[]>;

interface Props {
  open: boolean;
  onClose: () => void;
  templateFields: TplField[];
  onApply: (values: ApplyValues, autoFilledKeys: Set<string>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";
const IGNORE_VALUE = "" as const;
const REPEATER_SEP = "::";
type Phase = "upload" | "parsing" | "mapping" | "review";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function confidenceLabel(c: number): string {
  return c >= 0.9 ? "High" : "Good";
}

function confidenceColor(c: number): "success" | "warning" {
  return c >= 0.9 ? "success" : "warning";
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

let _idCounter = 0;
function uid(): string { return `f-${Date.now()}-${++_idCounter}`; }

function parseSubFields(raw: TplField["field_options"]): RepeaterSubField[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] !== "object" || raw[0] === null) return [];
  const validTypes = ["text", "dropdown", "date", "offence_search"] as const;
  return (raw as RepeaterSubField[])
    .map((sf) => ({
      name: sf.name ?? "",
      label: sf.label ?? sf.name ?? "",
      type: validTypes.includes(sf.type) ? sf.type : "text",
      options: Array.isArray(sf.options) ? sf.options : [],
    }))
    .filter((sf) => sf.name !== "");
}

function buildMappingTargets(templateFields: TplField[]): MappingTarget[] {
  const targets: MappingTarget[] = [];
  for (const f of templateFields) {
    if (f.field_type === "repeater") {
      for (const sf of parseSubFields(f.field_options)) {
        targets.push({
          assignedKey:  `${f.field_key}${REPEATER_SEP}${sf.name}`,
          label:        `${f.field_label} → ${sf.label}`,
          fieldKey:     f.field_key,
          fieldType:    f.field_type,
          repeaterKey:  f.field_key,
          subFieldName: sf.name,
          subFieldType: sf.type,
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

/**
 * Merge ParseResponse results from multiple files into one.
 * Raw pairs are deduplicated by normalised label.
 */
function mergeResults(results: ParseResponse[]): ParseResponse {
  const methods  = [...new Set(results.map((r) => r.extraction_method))].join(", ");
  const warnings = results.map((r) => r.warning).filter(Boolean) as string[];
  const rawText  = results.map((r) => r.raw_text ?? "").filter(Boolean).join("\n\n---\n\n");
  return {
    raw_text: rawText,
    extraction_method: methods,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

/**
 * Seed mapping rows from LLM suggestions.
 * One row per raw pair; LLM-suggested rows carry confidence and reasoning.
 * Offence sub-field pairs are mapped to the repeater target matching "offence" or offence_search.
 */
function buildMappingRows(
  targets: MappingTarget[],
  llmMappings: LLMMapping[],
): MappingRow[] {
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

// ─────────────────────────────────────────────────────────────────────────────
// Value assembly
// ─────────────────────────────────────────────────────────────────────────────

function coerceDateString(raw: string): string {
  const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return raw;
}

function normPairLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function assembleApplyValues(
  mappedRows: MappingRow[],
  editedValues: Record<string, string>,
  excluded: Set<string>,
  targets: MappingTarget[],
): { values: ApplyValues; autoKeys: Set<string> } {
  const values: ApplyValues = {};
  const autoKeys = new Set<string>();
  const targetMap = new Map(targets.map((t) => [t.assignedKey, t]));

  // Collect repeater sub-field assignments grouped by parent key
  const repeaterSubValues = new Map<string, Record<string, string>>();

  for (const row of mappedRows) {
    if (excluded.has(row.assignedKey)) continue;
    const val = (editedValues[row.assignedKey] ?? row.value).trim();
    if (!val) continue;

    const target = targetMap.get(row.assignedKey);
    if (!target) continue;

    if (target.repeaterKey && target.subFieldName) {
      if (!repeaterSubValues.has(target.repeaterKey)) {
        repeaterSubValues.set(target.repeaterKey, {});
      }
      repeaterSubValues.get(target.repeaterKey)![target.subFieldName] = val;
      autoKeys.add(target.repeaterKey);
    } else {
      values[target.fieldKey] = val;
      autoKeys.add(target.fieldKey);
    }
  }

  // Expand repeater sub-values into rows, splitting " | " into multiple rows
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
      for (const [sfName, parts] of Object.entries(segmented)) {
        row[sfName] = parts[r] ?? parts[0] ?? "";
      }
      rows.push(row);
    }
    values[repKey] = rows;
  }

  return { values, autoKeys };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_STEPS: { id: Phase; label: string }[] = [
  { id: "upload",  label: "Upload"  },
  { id: "parsing", label: "Extract" },
  { id: "mapping", label: "Map"     },
  { id: "review",  label: "Review"  },
];

function StepIndicator({ current }: { current: Phase }) {
  const currentIdx = PHASE_STEPS.findIndex((s) => s.id === current);
  return (
    <Box sx={{ display: "flex", alignItems: "center", mt: 1.5 }}>
      {PHASE_STEPS.map((step, idx) => {
        const done   = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <Box key={step.id} sx={{ display: "flex", alignItems: "center", flex: idx < PHASE_STEPS.length - 1 ? 1 : "none" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: done || active ? "#395B45" : "#E5E7EB",
                flexShrink: 0, transition: "background-color 0.2s",
              }}>
                {done
                  ? <CheckCircle size={12} color="#fff" />
                  : <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: active ? "#fff" : "#9CA3AF" }}>{idx + 1}</Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: "0.72rem", fontWeight: active ? 700 : 500,
                color: done || active ? "#374151" : "#9CA3AF", whiteSpace: "nowrap",
              }}>
                {step.label}
              </Typography>
            </Box>
            {idx < PHASE_STEPS.length - 1 && (
              <Box sx={{ flex: 1, height: "1px", bgcolor: done ? "#395B45" : "#E5E7EB", mx: 1, transition: "background-color 0.2s" }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload phase
// ─────────────────────────────────────────────────────────────────────────────

interface UploadPhaseProps {
  files: FileEntry[];
  uploadTab: "file" | "camera";
  capturedPhotos: Array<{ id: string; dataUrl: string; file: File }>;
  cameraActive: boolean;
  cameraError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onTabChange: (tab: "file" | "camera") => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  onDrop: (e: React.DragEvent) => void;
  onCapturePhoto: () => void;
  onRemoveCapture: (id: string) => void;
  onClearCaptures: () => void;
  onRetryCamera: () => void;
}

function UploadPhase({
  files, uploadTab, capturedPhotos, cameraActive, cameraError,
  videoRef, canvasRef, inputRef,
  onTabChange, onAddFiles, onRemoveFile, onClearFiles,
  onDrop, onCapturePhoto, onRemoveCapture, onClearCaptures,
  onRetryCamera,
}: UploadPhaseProps) {
  return (
    <>
      <Tabs value={uploadTab} onChange={(_, v) => onTabChange(v)}
        sx={{
          mb: 2, minHeight: 36,
          "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 600, fontSize: "0.85rem" },
          "& .MuiTabs-indicator": { bgcolor: "#395B45" },
          "& .Mui-selected": { color: "#395B45 !important" },
        }}
      >
        <Tab value="file" label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Upload size={15} />Upload Files
            {files.length > 0 && <Chip label={files.length} size="small" sx={{ height: 18, fontSize: "0.65rem", ml: 0.5, bgcolor: "#395B45", color: "#fff" }} />}
          </Box>
        } />
        <Tab value="camera" label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Camera size={15} />Camera
            {capturedPhotos.length > 0 && <Chip label={capturedPhotos.length} size="small" sx={{ height: 18, fontSize: "0.65rem", ml: 0.5, bgcolor: "#395B45", color: "#fff" }} />}
          </Box>
        } />
      </Tabs>

      {uploadTab === "file" && (
        <>
          <Paper variant="outlined" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            sx={{
              border: "2px dashed", borderRadius: 2,
              borderColor: files.length > 0 ? "#395B45" : "#D1D5DB",
              bgcolor: files.length > 0 ? "rgba(57,91,69,0.04)" : "#FAFAFA",
              p: { xs: 3, sm: 2.5 }, textAlign: "center", cursor: "pointer", transition: "all 0.2s",
              "&:hover": { borderColor: "#395B45", bgcolor: "rgba(57,91,69,0.04)" },
            }}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.length) onAddFiles(e.target.files); e.target.value = ""; }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ bgcolor: "#F3F4F6", borderRadius: "50%", p: 1.25, display: "flex" }}>
                <Upload size={22} color="#9CA3AF" />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, color: "#374151", fontSize: "0.9rem" }}>
                  Drop files here or click to browse
                </Typography>
                <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", mt: 0.25 }}>
                  PDF, DOCX, TXT, JPG, PNG · multiple files · max 10 MB each
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
                <Button size="small" onClick={onClearFiles} sx={{ color: "#9CA3AF", textTransform: "none", fontSize: "0.75rem" }}>
                  Clear all
                </Button>
              </Box>
              <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {files.map((entry) => (
                  <ListItem key={entry.id} disablePadding
                    sx={{ bgcolor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 1.5, px: 1.5, py: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                    <FileText size={16} color="#6B7280" style={{ flexShrink: 0 }} />
                    <ListItemText primary={entry.file.name} secondary={formatBytes(entry.file.size)}
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

          <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: "#F0F9FF", borderRadius: 1.5, border: "1px solid #BAE6FD", display: "flex", flexWrap: "wrap", gap: { xs: 0.25, sm: 1.5 }, alignItems: "flex-start" }}>
            <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 700, whiteSpace: "nowrap" }}>Tip:</Typography>
            <Typography variant="caption" sx={{ color: "#0369A1" }}>Upload custody record + interview notes together for best results. DOCX/TXT files extract most accurately.</Typography>
          </Box>
        </>
      )}

      {uploadTab === "camera" && (
        <Box>
          {cameraError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: "0.85rem", mb: 1 }}>{cameraError}</Typography>
              <Button size="small" variant="outlined" onClick={onRetryCamera}
                sx={{ textTransform: "none", fontWeight: 600, color: "#DC2626", borderColor: "#DC2626", minHeight: 36, "&:hover": { bgcolor: "rgba(220,38,38,0.06)" } }}>
                Retry Camera
              </Button>
            </Alert>
          )}
          {!cameraError && (
            <Box sx={{ position: "relative", width: "100%", bgcolor: "#111827", borderRadius: 2, overflow: "hidden", mb: 1.5, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box component="video" ref={videoRef} autoPlay playsInline muted
                sx={{ width: "100%", height: "100%", objectFit: "cover", display: cameraActive ? "block" : "none" }} />
              {!cameraActive && (
                <Box sx={{ textAlign: "center", color: "#9CA3AF" }}>
                  <CircularProgress size={32} sx={{ color: "#9CA3AF", mb: 1 }} />
                  <Typography variant="body2">Starting camera…</Typography>
                </Box>
              )}
              {cameraActive && (
                <Box sx={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)" }}>
                  <Tooltip title="Take photo">
                    <IconButton onClick={onCapturePhoto}
                      sx={{ bgcolor: "#fff", width: 56, height: 56, border: "3px solid #395B45", "&:hover": { bgcolor: "#F0FDF4", transform: "scale(1.08)" }, transition: "all 0.15s" }}>
                      <Camera size={26} color="#395B45" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {capturedPhotos.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#374151" }}>
                  {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? "s" : ""} captured
                </Typography>
                <Button size="small" onClick={onClearCaptures} sx={{ color: "#9CA3AF", textTransform: "none", fontSize: "0.75rem" }}>Clear all</Button>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {capturedPhotos.map((p) => (
                  <Box key={p.id} sx={{ position: "relative", width: 96, height: 72, borderRadius: 1.5, overflow: "hidden", border: "2px solid #BBF7D0", flexShrink: 0 }}>
                    <Box component="img" src={p.dataUrl} alt="capture" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <IconButton size="small" onClick={() => onRemoveCapture(p.id)}
                      sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(0,0,0,0.55)", color: "#fff", width: 20, height: 20, "&:hover": { bgcolor: "rgba(220,38,38,0.8)" } }}>
                      <X size={11} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 1, px: 1.5, py: 1, bgcolor: "#F0F9FF", borderRadius: 1.5, border: "1px solid #BAE6FD", display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "flex-start" }}>
            <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 700, whiteSpace: "nowrap" }}>Tip:</Typography>
            <Typography variant="caption" sx={{ color: "#0369A1" }}>Hold document flat with even lighting. Capture each page separately, then tap "Add Photos".</Typography>
          </Box>
        </Box>
      )}

    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing phase
// ─────────────────────────────────────────────────────────────────────────────

function ParsingPhase({
  files,
  llmPending,
  onViewDebug,
}: {
  files: FileEntry[];
  llmPending: boolean;
  onViewDebug: (e: FileEntry) => void;
}) {
  const parsed  = files.filter((f) => f.status === "done").length;
  const errored = files.filter((f) => f.status === "error").length;
  const total   = files.length;

  return (
    <Box>
      <Box sx={{ textAlign: "center", py: 3 }}>
        <CircularProgress sx={{ color: "#395B45", mb: 1.5 }} size={40} />
        <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>
          {llmPending ? "Matching fields…" : `Analysing ${total} file${total !== 1 ? "s" : ""}…`}
        </Typography>
        <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
          {llmPending
            ? "Matching extracted content to form fields…"
            : `${parsed} of ${total} complete${errored > 0 ? ` · ${errored} failed` : ""}`}
        </Typography>
        {!llmPending && (
          <LinearProgress
            variant="determinate"
            value={total > 0 ? ((parsed + errored) / total) * 100 : 0}
            sx={{ mt: 2, mx: "auto", maxWidth: 320, borderRadius: 4, bgcolor: "#E5E7EB", "& .MuiLinearProgress-bar": { bgcolor: "#395B45" } }}
          />
        )}
      </Box>
      <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {files.map((entry) => (
          <ListItem key={entry.id} disablePadding
            sx={{
              bgcolor: "#F9FAFB", border: "1px solid",
              borderColor: entry.status === "done" ? "#BBF7D0" : entry.status === "error" ? "#FECACA" : entry.status === "parsing" ? "#BAE6FD" : "#E5E7EB",
              borderRadius: 1.5, px: 1.5, py: 0.75, gap: 1,
            }}>
            <Box sx={{ flexShrink: 0 }}>
              {entry.status === "done"    && <CheckCircle size={16} color="#16A34A" />}
              {entry.status === "error"   && <AlertCircle size={16} color="#DC2626" />}
              {entry.status === "parsing" && <CircularProgress size={16} sx={{ color: "#0284C7" }} />}
              {entry.status === "pending" && <FileText size={16} color="#9CA3AF" />}
            </Box>
            <ListItemText
              primary={entry.file.name}
              secondary={
                entry.status === "error"   ? entry.error
                : entry.status === "done"    ? "Text extracted"
                : entry.status === "parsing" ? "Extracting text…"
                : "Waiting…"
              }
              primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", noWrap: true }}
              secondaryTypographyProps={{ fontSize: "0.72rem", color: entry.status === "error" ? "#DC2626" : entry.status === "done" ? "#16A34A" : "#6B7280" }}
            />
            {entry.status === "done" && entry.result?.raw_text && (
              <Tooltip title="View extracted text">
                <IconButton size="small" onClick={() => onViewDebug(entry)}
                  sx={{ color: "#6B7280", "&:hover": { color: "#395B45" }, flexShrink: 0 }}>
                  <Eye size={15} />
                </IconButton>
              </Tooltip>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping phase
// ─────────────────────────────────────────────────────────────────────────────

interface MappingPhaseProps {
  rows: MappingRow[];
  targets: MappingTarget[];
  assignedKeys: Set<string>;
  onAssign: (pairIndex: number, assignedKey: string) => void;
  files: FileEntry[];
  onViewDebug: (e: FileEntry) => void;
}

function MappingPhase({ rows, targets, assignedKeys, onAssign, files, onViewDebug }: MappingPhaseProps) {
  const mappedCount  = rows.filter((r) => r.assignedKey !== IGNORE_VALUE).length;
  const ignoredCount = rows.length - mappedCount;

  const { scalarTargets, repeaterGroups } = useMemo(() => {
    const scalars = targets.filter((t) => !t.repeaterKey).sort((a, b) => a.label.localeCompare(b.label));
    const groupMap = new Map<string, { label: string; items: MappingTarget[] }>();
    for (const t of targets) {
      if (!t.repeaterKey) continue;
      if (!groupMap.has(t.repeaterKey)) groupMap.set(t.repeaterKey, { label: t.repeaterLabel!, items: [] });
      groupMap.get(t.repeaterKey)!.items.push(t);
    }
    return { scalarTargets: scalars, repeaterGroups: Array.from(groupMap.values()) };
  }, [targets]);

  return (
    <Box>
      {/* Source file chips + stats in one compact row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        {files.filter((f) => f.status === "done").map((entry) => (
          <Chip key={entry.id} icon={<CheckCircle size={12} />}
            label={entry.file.name}
            size="small" variant="outlined" color="success"
            onClick={entry.result?.raw_text ? () => onViewDebug(entry) : undefined}
            deleteIcon={entry.result?.raw_text ? <Eye size={12} /> : undefined}
            onDelete={entry.result?.raw_text ? () => onViewDebug(entry) : undefined}
            sx={{ fontSize: "0.7rem", height: 22 }}
          />
        ))}
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          {[
            { value: rows.length,  label: "pairs",  color: "#374151" },
            { value: mappedCount,  label: "mapped",  color: "#395B45" },
            { value: ignoredCount, label: "ignored", color: "#9CA3AF" },
          ].map(({ value, label, color }) => (
            <Box key={label} sx={{ textAlign: "center", px: 1 }}>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "1fr 28px 1fr", gap: 1, px: 1.5, mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Extracted from document
        </Typography>
        <Box />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Map to template field
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {rows.map((row) => {
          const isMapped     = row.assignedKey !== IGNORE_VALUE;
          const hasSuggestion = row.suggestedKey !== IGNORE_VALUE;
          const target       = targets.find((t) => t.assignedKey === row.assignedKey);
          const isRepeater   = Boolean(target?.repeaterKey);

          return (
            <Paper key={row.pairIndex} variant="outlined"
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 28px 1fr" },
                gap: 1, p: 1.25, borderRadius: 1.5,
                borderColor: isMapped ? (isRepeater ? "#C7D2FE" : "#BBF7D0") : "#E5E7EB",
                bgcolor: isMapped ? (isRepeater ? "#EEF2FF" : "#F0FDF4") : "#FAFAFA",
                alignItems: "center", transition: "all 0.15s",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", mb: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.label}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.value}
                </Typography>
                {row.suggestedReasoning && isMapped && row.assignedKey === row.suggestedKey && (
                  <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF", mt: 0.25, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.suggestedReasoning}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "center" }}>
                {isMapped
                  ? <Link2 size={15} color={isRepeater ? "#6366F1" : "#395B45"} />
                  : <Link2Off size={15} color="#D1D5DB" />
                }
              </Box>

              <FormControl fullWidth size="small">
                <Select
                  value={row.assignedKey}
                  onChange={(e) => onAssign(row.pairIndex, e.target.value)}
                  displayEmpty
                  IconComponent={ChevronDown}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                  sx={{
                    fontSize: "0.78rem", bgcolor: "#fff",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: isMapped ? (isRepeater ? "#C7D2FE" : "#BBF7D0") : "#E5E7EB" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
                  }}
                  renderValue={(val) => {
                    if (!val) return <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AF", fontStyle: "italic" }}>— Ignore —</Typography>;
                    const t = targets.find((t) => t.assignedKey === val);
                    return (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                        {t?.repeaterKey && <Layers size={12} color="#6366F1" style={{ flexShrink: 0 }} />}
                        <Typography sx={{ fontSize: "0.78rem", color: "#111827", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                    <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AF", fontStyle: "italic" }}>— Ignore —</Typography>
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
                          sx={{ fontSize: "0.78rem", opacity: inUse ? 0.4 : 1, bgcolor: t.assignedKey === row.suggestedKey && !inUse ? "rgba(57,91,69,0.06)" : "transparent", "&:hover": { bgcolor: "rgba(57,91,69,0.1)" } }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                            <Typography sx={{ fontSize: "0.78rem" }}>{t.label}</Typography>
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
                          sx={{ fontSize: "0.78rem", pl: 3, opacity: inUse ? 0.4 : 1, bgcolor: t.assignedKey === row.suggestedKey && !inUse ? "rgba(99,102,241,0.06)" : "transparent", "&:hover": { bgcolor: "rgba(99,102,241,0.1)" } }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                            <Typography sx={{ fontSize: "0.78rem" }}>{t.label.split(" → ")[1] ?? t.subFieldName}</Typography>
                            {inUse && <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF", flexShrink: 0 }}>in use</Typography>}
                          </Box>
                        </MenuItem>
                      );
                    }),
                  ])}
                </Select>
              </FormControl>
            </Paper>
          );
        })}
      </Box>

    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review phase
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewPhaseProps {
  mappedRows: MappingRow[];
  targets: MappingTarget[];
  editedValues: Record<string, string>;
  excluded: Set<string>;
  onEditValue: (assignedKey: string, value: string) => void;
  onToggleExclude: (assignedKey: string) => void;
  files: FileEntry[];
  onViewDebug: (e: FileEntry) => void;
  warning?: string;
}

function ReviewPhase({
  mappedRows, targets, editedValues, excluded,
  onEditValue, onToggleExclude,
  files, onViewDebug, warning,
}: ReviewPhaseProps) {
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
          p: 1.25, borderRadius: 1.5,
          borderColor: isExcluded ? "#E5E7EB" : isRepeater ? "#C7D2FE" : row.suggestedConfidence >= 0.9 ? "#BBF7D0" : "#FDE68A",
          bgcolor: isExcluded ? "#FAFAFA" : isRepeater ? "#EEF2FF" : row.suggestedConfidence >= 0.9 ? "#F0FDF4" : "#FFFBEB",
          opacity: isExcluded ? 0.55 : 1, transition: "all 0.15s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box component="input" type="checkbox" checked={!isExcluded}
            onChange={() => onToggleExclude(row.assignedKey)}
            sx={{ mt: 0.5, cursor: "pointer", accentColor: "#395B45", width: 15, height: 15, flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
              {isRepeater && <Layers size={13} color="#6366F1" style={{ flexShrink: 0 }} />}
              <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#111827" }}>
                {t?.label ?? row.assignedKey}
              </Typography>
              {isUserMap
                ? <Chip label="User mapped" size="small" variant="outlined"
                    sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, color: "#6B7280", borderColor: "#D1D5DB" }} />
                : <Chip label={confidenceLabel(row.suggestedConfidence)} size="small"
                    color={confidenceColor(row.suggestedConfidence)} variant="outlined"
                    sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
              }
              <Tooltip title={`From document label: "${row.label}"`}>
                <Typography variant="caption" sx={{ color: "#9CA3AF", cursor: "help", fontSize: "0.7rem" }}>
                  from "{row.label}"
                </Typography>
              </Tooltip>
            </Box>

            {fieldType === "textarea" ? (
              <TextField fullWidth size="small" multiline minRows={2}
                value={currentVal} disabled={isExcluded}
                onChange={(e) => onEditValue(row.assignedKey, e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.8rem" } }} />
            ) : (
              <TextField fullWidth size="small"
                type={fieldType === "date" ? "date" : "text"}
                value={currentVal} disabled={isExcluded}
                onChange={(e) => onEditValue(row.assignedKey, e.target.value)}
                slotProps={fieldType === "date" ? { inputLabel: { shrink: true } } : {}}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.8rem" } }} />
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

      {/* Compact source chips + stats */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        {files.filter((f) => f.status === "done").map((entry) => (
          <Chip key={entry.id} icon={<CheckCircle size={12} />}
            label={entry.file.name}
            size="small" variant="outlined" color="success"
            onClick={entry.result?.raw_text ? () => onViewDebug(entry) : undefined}
            deleteIcon={entry.result?.raw_text ? <Eye size={12} /> : undefined}
            onDelete={entry.result?.raw_text ? () => onViewDebug(entry) : undefined}
            sx={{ fontSize: "0.7rem", height: 22 }}
          />
        ))}
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          {[
            { value: mappedRows.length, label: "mapped",  color: "#395B45" },
            { value: highCount,         label: "high conf", color: "#16A34A" },
            { value: willApply,         label: "applying", color: "#374151" },
          ].map(({ value, label, color }) => (
            <Box key={label} sx={{ textAlign: "center", px: 1 }}>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.82rem" }}>Review values before applying</Typography>
        <Typography variant="caption" sx={{ color: "#9CA3AF", fontSize: "0.72rem" }}>Edit · uncheck to skip</Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {groups.scalars.map(renderRow)}
        {groups.repeaterGroups.map((group) => (
          <Box key={group.label}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, mb: 0.75 }}>
              <Layers size={15} color="#6366F1" />
              <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#6366F1" }}>{group.label}</Typography>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "#C7D2FE" }} />
              <Typography variant="caption" sx={{ color: "#818CF8", fontSize: "0.68rem", whiteSpace: "nowrap" }}>
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
// Debug viewer
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    const text = getText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <Tooltip title={copied ? "Copied!" : label}>
      <IconButton size="small" onClick={handleCopy}
        sx={{ color: copied ? "#16A34A" : "#6B7280", "&:hover": { color: "#395B45", bgcolor: "rgba(57,91,69,0.08)" }, transition: "color 0.15s" }}>
        {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
      </IconButton>
    </Tooltip>
  );
}

function DebugViewer({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, height: "85vh", display: "flex", flexDirection: "column" } } }}>
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F3F4F6" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Eye size={18} color="#395B45" />
            <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>Extracted Text</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#6B7280" }}>
            {entry.file.name} · {entry.result?.extraction_method} · {entry.result?.raw_text?.length ?? 0} chars
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#9CA3AF" }}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Box sx={{ px: 2, py: 1, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Raw OCR Text</Typography>
            <CopyButton label="Copy raw text" getText={() => entry.result?.raw_text ?? ""} />
          </Box>
          <Box component="pre" sx={{ flex: 1, overflowY: "auto", m: 0, p: 2, fontFamily: "monospace", fontSize: "0.78rem", lineHeight: 1.7, color: "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word", bgcolor: "#fff" }}>
            {entry.result?.raw_text || "(no text extracted)"}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: "1px solid #F3F4F6", justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
          Use this view to verify OCR quality and check that field labels are parsed correctly
        </Typography>
        <Button onClick={onClose} sx={{ color: "#374151", textTransform: "none", fontWeight: 500 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

export default function AutoFillUploader({ open, onClose, templateFields, onApply }: Props) {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // < 600px

  const inputRef  = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase,       setPhase]       = useState<Phase>("upload");
  const [uploadTab,   setUploadTab]   = useState<"file" | "camera">("file");
  const [files,       setFiles]       = useState<FileEntry[]>([]);
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ id: string; dataUrl: string; file: File }>>([]);
  const [cameraActive,  setCameraActive]  = useState(false);
  const [cameraError,   setCameraError]   = useState("");
  const [mergedResult,  setMergedResult]  = useState<ParseResponse | null>(null);
  const [globalError,   setGlobalError]   = useState("");
  const [mappingRows,   setMappingRows]   = useState<MappingRow[]>([]);
  const [editedValues,  setEditedValues]  = useState<Record<string, string>>({});
  const [excluded,      setExcluded]      = useState<Set<string>>(new Set());
  const [debugFile,     setDebugFile]     = useState<FileEntry | null>(null);
  const [llmPending,    setLlmPending]    = useState(false);

  const targets = useMemo(() => buildMappingTargets(templateFields), [templateFields]);

  const assignedKeys = useMemo<Set<string>>(
    () => new Set(mappingRows.map((r) => r.assignedKey).filter(Boolean)),
    [mappingRows],
  );

  const mappedRows = useMemo(
    () => mappingRows.filter((r) => r.assignedKey !== IGNORE_VALUE),
    [mappingRows],
  );

  const parsedCount = files.filter((f) => f.status === "done").length;
  const errorCount  = files.filter((f) => f.status === "error").length;
  const totalCount  = files.length;

  // ── Camera ────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (fallback = false) => {
    setCameraError("");
    setCameraActive(false);
    try {
      const constraints: MediaStreamConstraints = fallback
        ? { video: true }
        : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Tap the camera icon in your browser's address bar to allow access, then tap Retry.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError("No camera found on this device. Use the Upload Files tab to add photos from your gallery instead.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCameraError("Camera is in use by another app. Close it and tap Retry.");
      } else if ((name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") && !fallback) {
        // Retry without constraints — some devices reject HD resolution
        startCamera(true);
        return;
      } else if (name === "NotSupportedError" || name === "TypeError") {
        setCameraError("Your browser doesn't support camera access. Try uploading a photo from your gallery instead.");
      } else {
        setCameraError(`Could not start camera. Try refreshing the page, or upload a photo from your gallery.`);
      }
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (uploadTab === "camera" && phase === "upload") startCamera(); else stopCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadTab, open, phase]);

  useEffect(() => { if (!open) stopCamera(); }, [open, stopCamera]);

  // ── Camera actions ────────────────────────────────────────────────────────

  function capturePhoto() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || !cameraActive) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Guard: video stream not ready yet
    if (!vw || !vh) {
      setCameraError("Camera isn't ready yet — please wait a moment and try again.");
      return;
    }

    // Guard: image too small to be useful (< 100 × 100 px)
    if (vw < 100 || vh < 100) {
      setCameraError("Camera resolution is too low. Please try a different camera or move to better lighting.");
      return;
    }

    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    canvas.toBlob((blob) => {
      // Guard: blob was empty (frame not yet populated)
      if (!blob || blob.size < 1000) {
        setCameraError("Photo capture failed — the image was blank or too small. Please try again.");
        return;
      }
      const id = uid();
      setCapturedPhotos((prev) => [...prev, {
        id,
        dataUrl,
        file: new File([blob], `capture-${id}.jpg`, { type: "image/jpeg" }),
      }]);
    }, "image/jpeg", 0.92);
  }

  function confirmCaptures() {
    if (!capturedPhotos.length) return;
    addFiles(capturedPhotos.map((p) => p.file));
    stopCamera(); setCapturedPhotos([]); setUploadTab("file");
  }

  // ── File actions ──────────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    setFiles((prev) => [...prev, ...Array.from(incoming).map((f) => ({ id: uid(), file: f, status: "pending" as FileStatus, result: null, error: "" }))]);
    setGlobalError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (phase !== "upload" || !e.dataTransfer.files.length) return;
    addFiles(e.dataTransfer.files);
  }

  // ── Extraction + LLM mapping ──────────────────────────────────────────────

  const handleParseAll = useCallback(async () => {
    if (!files.length || !templateFields.length) return;
    stopCamera();
    setPhase("parsing");
    setGlobalError("");
    setLlmPending(false);

    const completed: ParseResponse[] = [];

    // Step 1: Extract text from all files
    for (const entry of files) {
      setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "parsing" } : e));
      try {
        const body = new FormData();
        body.append("file", entry.file);

        const res = await fetch("/api/parse-document", { method: "POST", body });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let json: any;
        try { json = await res.json(); } catch {
          const text = await res.text().catch(() => "");
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: `Server error (${res.status}): ${text.slice(0, 200) || "no details"}` } : e));
          continue;
        }

        if (!res.ok) {
          const rawError: string = json?.error ?? `Server error ${res.status}`;
          // Map known server-side error patterns to friendly per-file messages
          const friendlyError = /not configured|credential|document.?ai/i.test(rawError)
            ? "This file type is not supported for extraction — upload as DOCX or TXT instead."
            : /blank|unreadable|no content/i.test(rawError)
            ? "No readable text found — the image may be blurry or low quality."
            : rawError;
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: friendlyError } : e));
        } else {
          const data: ParseResponse = json.data;
          completed.push(data);
          setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "done", result: data } : e));
        }
      } catch (err) {
        setFiles((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: err instanceof Error ? err.message : "Unexpected error." } : e));
      }
    }

    if (!completed.length) {
      const IMAGE_EXTS = /\.(jpe?g|png|bmp|tiff?|webp)$/i;
      const PDF_EXT    = /\.pdf$/i;
      const failedFiles = files.filter((f) => f.status === "error");

      const allImageFails = failedFiles.length > 0 && failedFiles.every((f) => IMAGE_EXTS.test(f.file.name));
      const allPdfFails   = failedFiles.length > 0 && failedFiles.every((f) => PDF_EXT.test(f.file.name));
      const hasCredentialError = failedFiles.some((f) =>
        /credential|document.?ai|google|ocr|not.?configured|not configured/i.test(f.error ?? ""),
      );
      const hasQualityError = failedFiles.some((f) =>
        /blank|unreadable|no content|scanned|empty/i.test(f.error ?? ""),
      );

      if (hasCredentialError && (allImageFails || allPdfFails)) {
        setGlobalError(
          "Image and PDF extraction is not available on this server. " +
          "Please upload the document as a DOCX or TXT file instead — these work without any additional setup.",
        );
      } else if (allImageFails && hasQualityError) {
        setGlobalError(
          "The image could not be read — the text may be too blurry, low-contrast, or the photo was taken in poor lighting. " +
          "Try again with better lighting and hold the camera steady, or scan the document as a PDF/DOCX.",
        );
      } else if (allImageFails) {
        setGlobalError(
          "The image could not be processed. Make sure it is a clear, well-lit photo of the document. " +
          "For the most reliable results, upload a DOCX or PDF version instead.",
        );
      } else {
        setGlobalError("No files could be parsed. Check the individual file errors above and try again.");
      }
      setPhase("upload");
      return;
    }

    const merged = mergeResults(completed);
    setMergedResult(merged);

    // Step 2: Call LLM to generate field mappings from raw text
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
      } else {
        console.warn("[AutoFillUploader] LLM mapping failed — proceeding without AI suggestions");
      }
    } catch (e) {
      console.warn("[AutoFillUploader] LLM mapping error:", e);
    }
    setLlmPending(false);

    setMappingRows(buildMappingRows(targets, llmMappings));
    setPhase("mapping");
  }, [files, templateFields, targets, stopCamera]);

  // ── Mapping actions ───────────────────────────────────────────────────────

  function handleAssign(pairIndex: number, assignedKey: string) {
    setMappingRows((prev) => prev.map((r) => r.pairIndex === pairIndex ? { ...r, assignedKey } : r));
  }

  function handleConfirmMapping() {
    const initial: Record<string, string> = {};
    const targetMap = new Map(targets.map((t) => [t.assignedKey, t]));
    for (const row of mappingRows) {
      if (!row.assignedKey || row.assignedKey === IGNORE_VALUE) continue;
      const target = targetMap.get(row.assignedKey);
      const fieldType = target?.subFieldType ?? target?.fieldType ?? "text";
      let val = row.value;
      if (fieldType === "date") val = coerceDateString(val);
      initial[row.assignedKey] = val;
    }
    setEditedValues(initial);
    setExcluded(new Set());
    setPhase("review");
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  function handleApply() {
    const { values, autoKeys } = assembleApplyValues(
      mappedRows, editedValues, excluded, targets
    );
    onApply(values, autoKeys);
    handleClose();
  }

  // ── Reset / close ─────────────────────────────────────────────────────────

  function reset() {
    stopCamera();
    setPhase("upload"); setUploadTab("file");
    setFiles([]); setMergedResult(null); setGlobalError("");
    setMappingRows([]); setEditedValues({}); setExcluded(new Set());
    setDebugFile(null); setCapturedPhotos([]); setCameraError(""); setLlmPending(false);
  }

  function handleClose() { reset(); onClose(); }

  // ── Render ────────────────────────────────────────────────────────────────

  // Derived counts needed for footer buttons
  const mappedCount = mappingRows.filter((r) => r.assignedKey !== IGNORE_VALUE).length;
  const willApply   = mappedRows.filter((r) => !excluded.has(r.assignedKey)).length;

  return (
    <>
      <Dialog
        open={open}
        onClose={phase === "parsing" ? undefined : handleClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        slotProps={{
          paper: {
            sx: {
              borderRadius: isMobile ? 0 : 2.5,
              // Desktop: fixed height so only DialogContent scrolls
              height: isMobile ? "100dvh" : "82vh",
              maxHeight: isMobile ? "100dvh" : "82vh",
              display: "flex",
              flexDirection: "column",
              m: isMobile ? 0 : undefined,
              overflow: "hidden",
            },
          },
        }}
      >
        {/* ── Pinned header ─────────────────────────────────────────────── */}
        <DialogTitle sx={{ pb: 0, pt: 2.5, px: { xs: 2, sm: 3 }, flexShrink: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Wand2 size={20} color="#395B45" />
                <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, color: "#111827" }}>
                  Auto-fill from Documents
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "#6B7280", display: { xs: "none", sm: "block" } }}>
                Upload files · extract text · match fields · review values
              </Typography>
            </Box>
            <IconButton onClick={handleClose} disabled={phase === "parsing"} size="small"
              sx={{ color: "#9CA3AF", mt: -0.5, minWidth: 36, minHeight: 36 }}>
              <X size={18} />
            </IconButton>
          </Box>
          <StepIndicator current={phase} />
        </DialogTitle>

        {/* ── Scrollable body — only this area scrolls ───────────────────── */}
        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pt: 2,
            pb: 1,
            flex: 1,
            overflowY: "auto",
            // Custom scrollbar on desktop
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
            "&::-webkit-scrollbar-thumb": { bgcolor: "#D1D5DB", borderRadius: 3 },
            "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9CA3AF" },
          }}
        >
          {globalError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setGlobalError("")}>
              {globalError}
            </Alert>
          )}

          {phase === "upload" && (
            <UploadPhase
              files={files} uploadTab={uploadTab} capturedPhotos={capturedPhotos}
              cameraActive={cameraActive} cameraError={cameraError}
              videoRef={videoRef} canvasRef={canvasRef} inputRef={inputRef}
              onTabChange={(tab) => { setCameraError(""); setUploadTab(tab); }}
              onAddFiles={addFiles}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((e) => e.id !== id))}
              onClearFiles={() => setFiles([])}
              onDrop={handleDrop}
              onCapturePhoto={capturePhoto}
              onRemoveCapture={(id) => setCapturedPhotos((prev) => prev.filter((p) => p.id !== id))}
              onClearCaptures={() => setCapturedPhotos([])}
              onRetryCamera={startCamera}
            />
          )}

          {phase === "parsing" && (
            <ParsingPhase files={files} llmPending={llmPending} onViewDebug={setDebugFile} />
          )}

          {phase === "mapping" && (
            <MappingPhase
              rows={mappingRows} targets={targets} assignedKeys={assignedKeys}
              onAssign={handleAssign}
              files={files} onViewDebug={setDebugFile}
            />
          )}

          {phase === "review" && (
            <ReviewPhase
              mappedRows={mappedRows} targets={targets}
              editedValues={editedValues} excluded={excluded}
              onEditValue={(key, val) => setEditedValues((p) => ({ ...p, [key]: val }))}
              onToggleExclude={(key) => setExcluded((prev) => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })}
              files={files} onViewDebug={setDebugFile}
              warning={mergedResult?.warning}
            />
          )}
        </DialogContent>

        {/* ── Pinned footer — all action buttons live here ───────────────── */}
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            borderTop: "1px solid #F3F4F6",
            flexShrink: 0,
            gap: 1,
            flexWrap: "wrap",
            justifyContent:
              phase === "upload" ? "space-between"
              : phase === "parsing" ? "space-between"
              : phase === "mapping" ? "space-between"
              : "space-between",
          }}
        >
          {/* Upload phase footer */}
          {phase === "upload" && (
            <>
              <Button onClick={handleClose}
                sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
                Cancel
              </Button>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {uploadTab === "camera" && capturedPhotos.length > 0 && (
                  <Button variant="outlined" onClick={confirmCaptures} startIcon={<ZoomIn size={16} />}
                    sx={{ borderColor: "#395B45", color: "#395B45", fontWeight: 600, textTransform: "none", minHeight: 44 }}>
                    Add {capturedPhotos.length} Photo{capturedPhotos.length !== 1 ? "s" : ""}
                  </Button>
                )}
                <Button variant="contained" onClick={handleParseAll}
                  disabled={files.length === 0}
                  startIcon={<Wand2 size={16} />}
                  sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", minWidth: 160, minHeight: 44 }}>
                  Extract Fields ({files.length})
                </Button>
              </Box>
            </>
          )}

          {/* Parsing phase footer */}
          {phase === "parsing" && (
            <>
              <Typography variant="caption" sx={{ color: "#9CA3AF", alignSelf: "center" }}>
                {llmPending
                  ? "Matching fields…"
                  : `${parsedCount} of ${totalCount} complete${errorCount > 0 ? ` · ${errorCount} failed` : ""}`}
              </Typography>
              <Button variant="contained" disabled startIcon={<CircularProgress size={16} color="inherit" />}
                sx={{ bgcolor: "#395B45", fontWeight: 600, textTransform: "none", minWidth: 140, minHeight: 44 }}>
                {llmPending ? "Matching…" : "Analysing…"}
              </Button>
            </>
          )}

          {/* Mapping phase footer */}
          {phase === "mapping" && (
            <>
              <Button onClick={() => setPhase("upload")}
                sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
                ← Back
              </Button>
              <Button variant="contained" onClick={handleConfirmMapping} disabled={mappedCount === 0}
                endIcon={<ArrowRight size={16} />}
                sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", minWidth: 180, minHeight: 44 }}>
                Review {mappedCount} Field{mappedCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {/* Review phase footer */}
          {phase === "review" && (
            <>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button onClick={() => setPhase("mapping")}
                  sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
                  ← Back
                </Button>
                <Button onClick={reset} variant="outlined"
                  sx={{ borderColor: "#D1D5DB", color: "#374151", fontWeight: 500, textTransform: "none", minHeight: 44 }}>
                  Start Over
                </Button>
              </Box>
              <Button variant="contained" onClick={handleApply} disabled={willApply === 0}
                startIcon={<CheckCircle size={16} />}
                sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", minWidth: 180, minHeight: 44 }}>
                Apply {willApply} Field{willApply !== 1 ? "s" : ""}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {debugFile && <DebugViewer entry={debugFile} onClose={() => setDebugFile(null)} />}
    </>
  );
}
