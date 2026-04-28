"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, CircularProgress, Alert,
  Chip, TextField, Tooltip, IconButton, Paper,
  LinearProgress, List, ListItem, ListItemText,
  Tabs, Tab,
} from "@mui/material";
import {
  Upload, X, FileText, CheckCircle, AlertCircle,
  Info, Sparkles, Trash2, Eye, Camera, ZoomIn,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TplField {
  field_key: string;
  field_label: string;
  field_type: string;
}

interface MatchedField {
  field_key: string;
  field_label: string;
  field_type: string;
  value: string;
  confidence: number;
  source_label: string;
}

interface ParseResponse {
  matched: MatchedField[];
  unmatched_template_keys: string[];
  raw_pairs: Array<{ label: string; value: string }>;
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

interface Props {
  open: boolean;
  onClose: () => void;
  templateFields: TplField[];
  onApply: (values: Record<string, string>, autoFilledKeys: Set<string>) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceLabel(c: number): string {
  if (c >= 0.9) return "High";
  if (c >= 0.75) return "Good";
  if (c >= 0.6) return "Low";
  return "Weak";
}

function confidenceColor(c: number): "success" | "warning" | "error" {
  if (c >= 0.9) return "success";
  if (c >= 0.75) return "warning";
  return "error";
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

let _idCounter = 0;
function uid(): string {
  return `f-${Date.now()}-${++_idCounter}`;
}

function mergeResults(results: ParseResponse[], templateFields: TplField[]): ParseResponse {
  const best = new Map<string, MatchedField>();

  for (const r of results) {
    for (const m of r.matched) {
      const existing = best.get(m.field_key);
      if (!existing || m.confidence > existing.confidence) {
        best.set(m.field_key, m);
      }
    }
  }

  const matched = Array.from(best.values());
  const matchedKeys = new Set(matched.map((m) => m.field_key));
  const unmatched_template_keys = templateFields
    .filter((f) => f.field_type !== "repeater" && f.field_type !== "offence_search")
    .filter((f) => !matchedKeys.has(f.field_key))
    .map((f) => f.field_key);

  const allPairs = results.flatMap((r) => r.raw_pairs);
  const methods = [...new Set(results.map((r) => r.extraction_method))].join(", ");
  const warnings = results.map((r) => r.warning).filter(Boolean) as string[];
  const rawText = results.map((r) => r.raw_text ?? "").filter(Boolean).join("\n\n---\n\n");

  return {
    matched,
    unmatched_template_keys,
    raw_pairs: allPairs,
    raw_text: rawText,
    extraction_method: methods,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutoFillUploader({ open, onClose, templateFields, onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Phase: "upload" → "parsing" → "review"
  const [phase, setPhase] = useState<"upload" | "parsing" | "review">("upload");

  // Upload-mode tab: "file" | "camera"
  const [uploadTab, setUploadTab] = useState<"file" | "camera">("file");

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [mergedResult, setMergedResult] = useState<ParseResponse | null>(null);
  const [globalError, setGlobalError] = useState<string>("");

  // Review-phase state
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Debug viewer
  const [debugFile, setDebugFile] = useState<FileEntry | null>(null);

  // ── Camera state ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ id: string; dataUrl: string; file: File }>>([]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permission in your browser and try again."
          : e instanceof DOMException && e.name === "NotFoundError"
          ? "No camera found on this device."
          : `Could not access camera: ${e instanceof Error ? e.message : String(e)}`;
      setCameraError(msg);
      setCameraActive(false);
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  // Start/stop camera when switching tabs
  useEffect(() => {
    if (!open) return;
    if (uploadTab === "camera" && phase === "upload") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadTab, open, phase]);

  // Always stop camera when modal closes
  useEffect(() => {
    if (!open) stopCamera();
  }, [open, stopCamera]);

  // Capture a photo from the video feed
  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraActive) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const id = uid();
        const file = new File([blob], `capture-${id}.jpg`, { type: "image/jpeg" });
        setCapturedPhotos((prev) => [...prev, { id, dataUrl, file }]);
      },
      "image/jpeg",
      0.92
    );
  }

  function removeCapture(id: string) {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  // Add captured photos to the file list and switch to parsing
  function confirmCaptures() {
    if (capturedPhotos.length === 0) return;
    addFiles(capturedPhotos.map((p) => p.file));
    stopCamera();
    setCapturedPhotos([]);
    setUploadTab("file");
  }

  // ── File management ───────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    const newEntries: FileEntry[] = Array.from(incoming).map((f) => ({
      id: uid(),
      file: f,
      status: "pending",
      result: null,
      error: "",
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    setGlobalError("");
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((e) => e.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (phase !== "upload") return;
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  // ── Parse all files sequentially ─────────────────────────────────────────

  const handleParseAll = useCallback(async () => {
    if (files.length === 0 || templateFields.length === 0) return;
    stopCamera();
    setPhase("parsing");
    setGlobalError("");

    const fieldsJson = JSON.stringify(
      templateFields.map(({ field_key, field_label, field_type }) => ({
        field_key, field_label, field_type,
      }))
    );

    const completedResults: ParseResponse[] = [];

    for (const entry of files) {
      setFiles((prev) =>
        prev.map((e) => e.id === entry.id ? { ...e, status: "parsing" } : e)
      );

      try {
        const body = new FormData();
        body.append("file", entry.file);
        body.append("templateFields", fieldsJson);

        const res = await fetch("/api/parse-document", { method: "POST", body });

        let json: any;
        try {
          json = await res.json();
        } catch {
          const text = await res.text().catch(() => "");
          const msg = `Server error (${res.status}): ${text.slice(0, 200) || "no details"}`;
          console.error("[AutoFill] non-JSON response:", res.status, text.slice(0, 500));
          setFiles((prev) =>
            prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: msg } : e)
          );
          continue;
        }

        if (!res.ok) {
          const msg = json?.error ?? json?.message ?? `Server error ${res.status}`;
          setFiles((prev) =>
            prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: msg } : e)
          );
        } else {
          const data: ParseResponse = json.data;
          completedResults.push(data);
          setFiles((prev) =>
            prev.map((e) => e.id === entry.id ? { ...e, status: "done", result: data } : e)
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error.";
        setFiles((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: msg } : e)
        );
      }
    }

    if (completedResults.length === 0) {
      setGlobalError("No files could be parsed successfully. Check the errors below and try again.");
      setPhase("upload");
      return;
    }

    const merged = mergeResults(completedResults, templateFields);
    setMergedResult(merged);

    const initial: Record<string, string> = {};
    for (const m of merged.matched) initial[m.field_key] = m.value;
    setEditedValues(initial);
    setExcluded(new Set());

    setPhase("review");
  }, [files, templateFields, stopCamera]);

  // ── Apply ─────────────────────────────────────────────────────────────────

  function handleApply() {
    if (!mergedResult) return;
    const values: Record<string, string> = {};
    const autoKeys = new Set<string>();

    for (const m of mergedResult.matched) {
      if (excluded.has(m.field_key)) continue;
      const val = editedValues[m.field_key] ?? m.value;
      if (val.trim()) {
        values[m.field_key] = val;
        autoKeys.add(m.field_key);
      }
    }

    onApply(values, autoKeys);
    handleClose();
  }

  function reset() {
    stopCamera();
    setPhase("upload");
    setUploadTab("file");
    setFiles([]);
    setMergedResult(null);
    setGlobalError("");
    setEditedValues({});
    setExcluded(new Set());
    setDebugFile(null);
    setCapturedPhotos([]);
    setCameraError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const highCount = mergedResult?.matched.filter(
    (m) => m.confidence >= 0.9 && !excluded.has(m.field_key)
  ).length ?? 0;
  const willApply = mergedResult
    ? Math.max(0, mergedResult.matched.length - excluded.size)
    : 0;

  const parsedCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const totalCount = files.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <Dialog
      open={open}
      onClose={phase === "parsing" ? undefined : handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2.5, minHeight: "60vh" } } }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 0, pt: 2.5, px: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Sparkles size={20} color="#395B45" />
            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#111827" }}>
              Auto-fill from Documents
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#6B7280" }}>
            Upload files or capture photos — custody records, interview notes, or any structured document
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={phase === "parsing"}
          size="small"
          sx={{ color: "#9CA3AF", mt: -0.5 }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 2 }}>

        {/* Global error */}
        {globalError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setGlobalError("")}>
            {globalError}
          </Alert>
        )}

        {/* Extraction warnings */}
        {mergedResult?.warning && (
          <Alert severity="warning" icon={<Info size={16} />} sx={{ mb: 2, borderRadius: 1.5 }}>
            {mergedResult.warning}
          </Alert>
        )}

        {/* ── PHASE: Upload ─────────────────────────────────────────────────── */}
        {phase === "upload" && (
          <>
            {/* Mode tabs */}
            <Tabs
              value={uploadTab}
              onChange={(_, v) => { setCameraError(""); setUploadTab(v); }}
              sx={{
                mb: 2,
                minHeight: 36,
                "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 600, fontSize: "0.85rem" },
                "& .MuiTabs-indicator": { bgcolor: "#395B45" },
                "& .Mui-selected": { color: "#395B45 !important" },
              }}
            >
              <Tab
                value="file"
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Upload size={15} />
                    Upload Files
                    {files.length > 0 && (
                      <Chip label={files.length} size="small" sx={{ height: 18, fontSize: "0.65rem", ml: 0.5, bgcolor: "#395B45", color: "#fff" }} />
                    )}
                  </Box>
                }
              />
              <Tab
                value="camera"
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Camera size={15} />
                    Camera
                    {capturedPhotos.length > 0 && (
                      <Chip label={capturedPhotos.length} size="small" sx={{ height: 18, fontSize: "0.65rem", ml: 0.5, bgcolor: "#395B45", color: "#fff" }} />
                    )}
                  </Box>
                }
              />
            </Tabs>

            {/* ── File upload tab ── */}
            {uploadTab === "file" && (
              <>
                <Paper
                  variant="outlined"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  sx={{
                    border: "2px dashed",
                    borderColor: files.length > 0 ? "#395B45" : "#D1D5DB",
                    borderRadius: 2,
                    bgcolor: files.length > 0 ? "rgba(57,91,69,0.04)" : "#FAFAFA",
                    p: 3,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": { borderColor: "#395B45", bgcolor: "rgba(57,91,69,0.04)" },
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED}
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <Box sx={{ bgcolor: "#F3F4F6", borderRadius: "50%", p: 1.5, display: "flex" }}>
                      <Upload size={24} color="#9CA3AF" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: "#374151", fontSize: "0.95rem" }}>
                        Drop files here or click to browse
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", mt: 0.25 }}>
                        PDF, DOCX, TXT, JPG, PNG — multiple files supported — max 10 MB each
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
                      <Button
                        size="small"
                        onClick={() => setFiles([])}
                        sx={{ color: "#9CA3AF", textTransform: "none", fontSize: "0.75rem", fontWeight: 500 }}
                      >
                        Clear all
                      </Button>
                    </Box>
                    <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {files.map((entry) => (
                        <ListItem
                          key={entry.id}
                          disablePadding
                          sx={{
                            bgcolor: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                            borderRadius: 1.5,
                            px: 1.5,
                            py: 0.75,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <FileText size={16} color="#6B7280" style={{ flexShrink: 0 }} />
                          <ListItemText
                            primary={entry.file.name}
                            secondary={formatBytes(entry.file.size)}
                            primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", noWrap: true }}
                            secondaryTypographyProps={{ fontSize: "0.72rem", color: "#9CA3AF" }}
                            sx={{ overflow: "hidden" }}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                            sx={{ color: "#9CA3AF", "&:hover": { color: "#EF4444" }, flexShrink: 0 }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                <Box sx={{ mt: 2, p: 1.5, bgcolor: "#F0F9FF", borderRadius: 1.5, border: "1px solid #BAE6FD" }}>
                  <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 600, display: "block", mb: 0.5 }}>
                    For best results:
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#0369A1", display: "block" }}>
                    • Upload both custody record and interview notes together — fields from both will be merged
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#0369A1", display: "block" }}>
                    • DOCX and TXT give the most accurate extraction — PDFs and images use OCR
                  </Typography>
                </Box>
              </>
            )}

            {/* ── Camera tab ── */}
            {uploadTab === "camera" && (
              <Box>
                {/* Camera error */}
                {cameraError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                    {cameraError}
                    <Button
                      size="small"
                      onClick={startCamera}
                      sx={{ ml: 1, textTransform: "none", fontWeight: 600, color: "#DC2626" }}
                    >
                      Retry
                    </Button>
                  </Alert>
                )}

                {/* Video preview */}
                {!cameraError && (
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      bgcolor: "#111827",
                      borderRadius: 2,
                      overflow: "hidden",
                      mb: 1.5,
                      aspectRatio: "16/9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      component="video"
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: cameraActive ? "block" : "none",
                      }}
                    />
                    {!cameraActive && (
                      <Box sx={{ textAlign: "center", color: "#9CA3AF" }}>
                        <CircularProgress size={32} sx={{ color: "#9CA3AF", mb: 1 }} />
                        <Typography variant="body2">Starting camera…</Typography>
                      </Box>
                    )}

                    {/* Capture button overlay */}
                    {cameraActive && (
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 16,
                          left: "50%",
                          transform: "translateX(-50%)",
                        }}
                      >
                        <Tooltip title="Take photo">
                          <IconButton
                            onClick={capturePhoto}
                            sx={{
                              bgcolor: "#fff",
                              width: 56,
                              height: 56,
                              border: "3px solid #395B45",
                              "&:hover": { bgcolor: "#F0FDF4", transform: "scale(1.08)" },
                              transition: "all 0.15s",
                            }}
                          >
                            <Camera size={26} color="#395B45" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {/* Captured photo thumbnails */}
                {capturedPhotos.length > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#374151" }}>
                        {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? "s" : ""} captured
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setCapturedPhotos([])}
                        sx={{ color: "#9CA3AF", textTransform: "none", fontSize: "0.75rem", fontWeight: 500 }}
                      >
                        Clear all
                      </Button>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {capturedPhotos.map((p) => (
                        <Box
                          key={p.id}
                          sx={{
                            position: "relative",
                            width: 96,
                            height: 72,
                            borderRadius: 1.5,
                            overflow: "hidden",
                            border: "2px solid #BBF7D0",
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            component="img"
                            src={p.dataUrl}
                            alt="capture"
                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => removeCapture(p.id)}
                            sx={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              bgcolor: "rgba(0,0,0,0.55)",
                              color: "#fff",
                              width: 20,
                              height: 20,
                              "&:hover": { bgcolor: "rgba(220,38,38,0.8)" },
                            }}
                          >
                            <X size={11} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Camera tip */}
                <Box sx={{ mt: 1, p: 1.5, bgcolor: "#F0F9FF", borderRadius: 1.5, border: "1px solid #BAE6FD" }}>
                  <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 600, display: "block", mb: 0.5 }}>
                    Camera tips:
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#0369A1", display: "block" }}>
                    • Hold the document flat and ensure even lighting for best OCR accuracy
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#0369A1", display: "block" }}>
                    • Capture each page separately — take multiple photos then press "Add to Queue"
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}

        {/* ── PHASE: Parsing ────────────────────────────────────────────────── */}
        {phase === "parsing" && (
          <Box>
            <Box sx={{ textAlign: "center", py: 3 }}>
              <CircularProgress sx={{ color: "#395B45", mb: 1.5 }} size={40} />
              <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>
                Analysing {totalCount} file{totalCount !== 1 ? "s" : ""}…
              </Typography>
              <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                {parsedCount} of {totalCount} complete
                {errorCount > 0 ? ` · ${errorCount} failed` : ""}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={totalCount > 0 ? ((parsedCount + errorCount) / totalCount) * 100 : 0}
                sx={{
                  mt: 2, mx: "auto", maxWidth: 320, borderRadius: 4,
                  bgcolor: "#E5E7EB",
                  "& .MuiLinearProgress-bar": { bgcolor: "#395B45" },
                }}
              />
            </Box>

            <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {files.map((entry) => (
                <ListItem
                  key={entry.id}
                  disablePadding
                  sx={{
                    bgcolor: "#F9FAFB",
                    border: "1px solid",
                    borderColor:
                      entry.status === "done" ? "#BBF7D0"
                      : entry.status === "error" ? "#FECACA"
                      : entry.status === "parsing" ? "#BAE6FD"
                      : "#E5E7EB",
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.75,
                    gap: 1,
                  }}
                >
                  <Box sx={{ flexShrink: 0 }}>
                    {entry.status === "done" && <CheckCircle size={16} color="#16A34A" />}
                    {entry.status === "error" && <AlertCircle size={16} color="#DC2626" />}
                    {entry.status === "parsing" && <CircularProgress size={16} sx={{ color: "#0284C7" }} />}
                    {entry.status === "pending" && <FileText size={16} color="#9CA3AF" />}
                  </Box>
                  <ListItemText
                    primary={entry.file.name}
                    secondary={
                      entry.status === "error" ? entry.error
                      : entry.status === "done" ? `${entry.result?.matched.length ?? 0} fields matched`
                      : entry.status === "parsing" ? "Extracting text…"
                      : "Waiting…"
                    }
                    primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", noWrap: true }}
                    secondaryTypographyProps={{
                      fontSize: "0.72rem",
                      color: entry.status === "error" ? "#DC2626" : entry.status === "done" ? "#16A34A" : "#6B7280",
                    }}
                  />
                  {entry.status === "done" && entry.result?.raw_text && (
                    <Tooltip title="View extracted text">
                      <IconButton
                        size="small"
                        onClick={() => setDebugFile(entry)}
                        sx={{ color: "#6B7280", "&:hover": { color: "#395B45" }, flexShrink: 0 }}
                      >
                        <Eye size={15} />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* ── PHASE: Review ────────────────────────────────────────────────── */}
        {phase === "review" && mergedResult && (
          <Box>
            <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
              {files.map((entry) => (
                <Chip
                  key={entry.id}
                  icon={
                    entry.status === "done"
                      ? <CheckCircle size={12} />
                      : <AlertCircle size={12} />
                  }
                  label={
                    entry.status === "done"
                      ? `${entry.file.name} · ${entry.result?.matched.length ?? 0} fields`
                      : `${entry.file.name} · failed`
                  }
                  size="small"
                  variant="outlined"
                  color={entry.status === "done" ? "success" : "error"}
                  onClick={entry.status === "done" && entry.result?.raw_text ? () => setDebugFile(entry) : undefined}
                  deleteIcon={entry.status === "done" && entry.result?.raw_text ? <Eye size={12} /> : undefined}
                  onDelete={entry.status === "done" && entry.result?.raw_text ? () => setDebugFile(entry) : undefined}
                  sx={{ fontSize: "0.7rem", height: 22, cursor: entry.result?.raw_text ? "pointer" : "default" }}
                />
              ))}
              {files.some((e) => e.result?.raw_text) && (
                <Typography variant="caption" sx={{ color: "#9CA3AF", fontSize: "0.7rem" }}>
                  click a chip to view extracted text
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 110, p: 1.5, borderRadius: 1.5, textAlign: "center" }}>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: "#395B45", lineHeight: 1 }}>
                  {mergedResult.matched.length}
                </Typography>
                <Typography variant="caption" sx={{ color: "#6B7280" }}>Fields matched</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 110, p: 1.5, borderRadius: 1.5, textAlign: "center" }}>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: "#16A34A", lineHeight: 1 }}>
                  {highCount}
                </Typography>
                <Typography variant="caption" sx={{ color: "#6B7280" }}>High confidence</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 110, p: 1.5, borderRadius: 1.5, textAlign: "center" }}>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: "#D97706", lineHeight: 1 }}>
                  {mergedResult.unmatched_template_keys.length}
                </Typography>
                <Typography variant="caption" sx={{ color: "#6B7280" }}>Need manual input</Typography>
              </Paper>
            </Box>

            {mergedResult.matched.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <AlertCircle size={40} color="#9CA3AF" style={{ margin: "0 auto 12px" }} />
                <Typography sx={{ fontWeight: 600, color: "#374151" }}>No fields matched</Typography>
                <Typography variant="body2" sx={{ color: "#9CA3AF", mt: 0.5 }}>
                  None of the uploaded documents contained recognisable field labels.
                  Try different files or fill fields manually.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.875rem" }}>
                    Review matched fields
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#6B7280" }}>
                    Edit values before applying · uncheck to skip a field
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {mergedResult.matched.map((m) => {
                    const isExcluded = excluded.has(m.field_key);
                    return (
                      <Paper
                        key={m.field_key}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          borderColor: isExcluded
                            ? "#E5E7EB"
                            : m.confidence >= 0.9 ? "#BBF7D0"
                            : m.confidence >= 0.75 ? "#FDE68A"
                            : "#FECACA",
                          bgcolor: isExcluded
                            ? "#FAFAFA"
                            : m.confidence >= 0.9 ? "#F0FDF4"
                            : m.confidence >= 0.75 ? "#FFFBEB"
                            : "#FFF5F5",
                          opacity: isExcluded ? 0.55 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                          <Box
                            component="input"
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() =>
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (next.has(m.field_key)) next.delete(m.field_key);
                                else next.add(m.field_key);
                                return next;
                              })
                            }
                            sx={{ mt: 0.5, cursor: "pointer", accentColor: "#395B45", width: 15, height: 15, flexShrink: 0 }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
                              <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#111827" }}>
                                {m.field_label}
                              </Typography>
                              <Chip
                                label={confidenceLabel(m.confidence)}
                                size="small"
                                color={confidenceColor(m.confidence)}
                                variant="outlined"
                                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                              />
                              <Tooltip title={`Matched from document label: "${m.source_label}"`}>
                                <Typography variant="caption" sx={{ color: "#9CA3AF", cursor: "help", fontSize: "0.7rem" }}>
                                  from "{m.source_label}"
                                </Typography>
                              </Tooltip>
                            </Box>

                            {m.field_type === "textarea" ? (
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                minRows={2}
                                value={editedValues[m.field_key] ?? m.value}
                                onChange={(e) =>
                                  setEditedValues((p) => ({ ...p, [m.field_key]: e.target.value }))
                                }
                                disabled={isExcluded}
                                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.8rem" } }}
                              />
                            ) : (
                              <TextField
                                fullWidth
                                size="small"
                                type={
                                  m.field_type === "date" ? "date"
                                  : m.field_type === "number" ? "number"
                                  : "text"
                                }
                                value={editedValues[m.field_key] ?? m.value}
                                onChange={(e) =>
                                  setEditedValues((p) => ({ ...p, [m.field_key]: e.target.value }))
                                }
                                disabled={isExcluded}
                                slotProps={m.field_type === "date" ? { inputLabel: { shrink: true } } : {}}
                                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontSize: "0.8rem" } }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>

                {mergedResult.unmatched_template_keys.length > 0 && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: "#FFF7ED", borderRadius: 1.5, border: "1px solid #FED7AA" }}>
                    <Typography variant="caption" sx={{ color: "#92400E", fontWeight: 600, display: "block", mb: 0.5 }}>
                      Fields not found in any document ({mergedResult.unmatched_template_keys.length}):
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#B45309" }}>
                      {mergedResult.unmatched_template_keys.join(" · ")}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 2, gap: 1, justifyContent: "space-between", borderTop: "1px solid #F3F4F6" }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={phase === "parsing"}
            sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none" }}
          >
            Cancel
          </Button>
          {phase === "review" && (
            <Button
              onClick={reset}
              variant="outlined"
              sx={{ borderColor: "#D1D5DB", color: "#374151", fontWeight: 500, textTransform: "none" }}
            >
              Try Different Files
            </Button>
          )}
        </Box>

        {phase === "upload" && (
          <Box sx={{ display: "flex", gap: 1 }}>
            {/* Camera tab: "Add to Queue" button */}
            {uploadTab === "camera" && capturedPhotos.length > 0 && (
              <Button
                variant="outlined"
                onClick={confirmCaptures}
                startIcon={<ZoomIn size={16} />}
                sx={{
                  borderColor: "#395B45", color: "#395B45",
                  fontWeight: 600, textTransform: "none",
                }}
              >
                Add {capturedPhotos.length} Photo{capturedPhotos.length !== 1 ? "s" : ""} to Queue
              </Button>
            )}

            <Button
              variant="contained"
              onClick={handleParseAll}
              disabled={files.length === 0}
              startIcon={<Sparkles size={16} />}
              sx={{
                bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
                fontWeight: 600, textTransform: "none", minWidth: 160,
              }}
            >
              Extract Fields ({files.length})
            </Button>
          </Box>
        )}

        {phase === "parsing" && (
          <Button
            variant="contained"
            disabled
            startIcon={<CircularProgress size={16} color="inherit" />}
            sx={{ bgcolor: "#395B45", fontWeight: 600, textTransform: "none", minWidth: 160 }}
          >
            Analysing…
          </Button>
        )}

        {phase === "review" && (
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={willApply === 0}
            startIcon={<CheckCircle size={16} />}
            sx={{
              bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
              fontWeight: 600, textTransform: "none", minWidth: 180,
            }}
          >
            Apply {willApply} Field{willApply !== 1 ? "s" : ""}
          </Button>
        )}
      </DialogActions>
    </Dialog>

    {/* ── Debug: Raw Extracted Text Viewer ─────────────────────────────────── */}
    {debugFile && (
      <Dialog
        open={!!debugFile}
        onClose={() => setDebugFile(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, height: "85vh", display: "flex", flexDirection: "column" } } }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F3F4F6" }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Eye size={18} color="#395B45" />
              <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>
                Extracted Text
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "#6B7280" }}>
              {debugFile.file.name} · {debugFile.result?.extraction_method} · {debugFile.result?.raw_text?.length ?? 0} chars
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={`${debugFile.result?.raw_pairs.length ?? 0} pairs extracted`}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
            <IconButton size="small" onClick={() => setDebugFile(null)} sx={{ color: "#9CA3AF" }}>
              <X size={18} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #E5E7EB" }}>
            <Box sx={{ px: 2, py: 1, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Raw OCR Text
              </Typography>
            </Box>
            <Box
              component="pre"
              sx={{
                flex: 1,
                overflowY: "auto",
                m: 0,
                p: 2,
                fontFamily: "monospace",
                fontSize: "0.78rem",
                lineHeight: 1.7,
                color: "#111827",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                bgcolor: "#fff",
              }}
            >
              {debugFile.result?.raw_text || "(no text extracted)"}
            </Box>
          </Box>

          <Box sx={{ width: 340, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <Box sx={{ px: 2, py: 1, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Parsed Key → Value Pairs
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {(debugFile.result?.raw_pairs ?? []).length === 0 ? (
                <Typography variant="caption" sx={{ color: "#9CA3AF", p: 1 }}>
                  No key:value pairs could be parsed from this text.
                </Typography>
              ) : (
                (debugFile.result?.raw_pairs ?? []).map((pair, i) => (
                  <Box
                    key={i}
                    sx={{
                      bgcolor: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: 1,
                      px: 1.25,
                      py: 0.75,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#374151", mb: 0.25 }}>
                      {pair.label}
                    </Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: "#6B7280", wordBreak: "break-word" }}>
                      {pair.value}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, borderTop: "1px solid #F3F4F6", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
            Use this view to verify OCR quality and check if field labels are parsed correctly
          </Typography>
          <Button
            onClick={() => setDebugFile(null)}
            sx={{ color: "#374151", textTransform: "none", fontWeight: 500 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )}
    </>
  );
}
