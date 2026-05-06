"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Checkbox, Chip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Tooltip, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress,
} from "@mui/material";
import {
  Upload, Download, Trash2, FileText, AlertCircle,
  CheckSquare, Square, CalendarDays, HardDrive,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuditFile {
  id: string;
  display_name: string;
  mime_type: string | null;
  file_size: number;
  expires_at: string | null;
  created_at: string;
  storage_path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b < 1024)            return `${b} B`;
  if (b < 1024 * 1024)     return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload dialog
// ─────────────────────────────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (file: AuditFile) => void;
}

function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const inputRef                      = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName]   = useState("");
  const [expiresAt, setExpiresAt]       = useState("");
  const [uploading, setUploading]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [error, setError]               = useState("");

  function handleClose() {
    if (uploading) return;
    setSelectedFile(null);
    setDisplayName("");
    setExpiresAt("");
    setError("");
    setProgress(0);
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    setSelectedFile(f);
    // Pre-fill display name from file name (without extension)
    if (!displayName) {
      setDisplayName(f.name.replace(/\.[^.]+$/, ""));
    }
    e.target.value = "";
  }

  async function handleUpload() {
    if (!selectedFile || !displayName.trim()) return;
    setError("");
    setUploading(true);
    setProgress(10);

    try {
      const token = await getToken();
      const body  = new FormData();
      body.append("file", selectedFile);
      body.append("display_name", displayName.trim());
      if (expiresAt) body.append("expires_at", expiresAt);

      setProgress(40);

      const res = await fetch("/api/admin/audit-files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      setProgress(90);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }

      setProgress(100);
      onUploaded(json.data as AuditFile);
      handleClose();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}
    >
      {/* ── Header ── */}
      <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: "1px solid #F3F4F6" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: "#395B45", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Upload size={19} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: "#111827", lineHeight: 1.2 }}>
                Upload Audit File
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: "#6B7280", mt: 0.25 }}>
                Files are stored privately for your firm only
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Body ── */}
      <DialogContent sx={{ px: 3, py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>{error}</Alert>
        )}

        {/* File picker */}
        <Box
          onClick={() => !uploading && inputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderColor: selectedFile ? "#395B45" : "#D1D5DB",
            borderRadius: 2.5,
            bgcolor: selectedFile ? "rgba(57,91,69,0.04)" : "#FAFAFA",
            p: 4,
            mb: 3,
            textAlign: "center",
            cursor: uploading ? "default" : "pointer",
            transition: "all 0.2s",
            "&:hover": uploading ? {} : { borderColor: "#395B45", bgcolor: "rgba(57,91,69,0.04)" },
          }}
        >
          <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: "50%",
              bgcolor: selectedFile ? "rgba(57,91,69,0.12)" : "#F3F4F6",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              <FileText size={24} color={selectedFile ? "#395B45" : "#9CA3AF"} />
            </Box>
            {selectedFile ? (
              <Box>
                <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem", mb: 0.25 }}>
                  {selectedFile.name}
                </Typography>
                <Chip
                  label={formatBytes(selectedFile.size)}
                  size="small"
                  sx={{ height: 20, fontSize: "0.72rem", bgcolor: "#F0FDF4", color: "#15803D", fontWeight: 600 }}
                />
                <Typography sx={{ fontSize: "0.75rem", color: "#9CA3AF", mt: 0.75 }}>
                  Click to change file
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontWeight: 600, color: "#374151", fontSize: "0.95rem", mb: 0.25 }}>
                  Click to select a file
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AF" }}>
                  Any file type — up to 50 MB
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Display name */}
        <TextField
          label="Display name"
          fullWidth
          size="small"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={uploading}
          placeholder="e.g. Q1 2026 Internal Audit Report"
          helperText="This name appears in the list and is used as the filename when downloading."
          sx={{
            mb: 2.5,
            "& .MuiOutlinedInput-root": {
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
            },
            "& .MuiInputLabel-root.Mui-focused": { color: "#395B45" },
          }}
        />

        {/* Expiry date */}
        <TextField
          label="Expiry date (optional)"
          fullWidth
          size="small"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          disabled={uploading}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Leave blank if the file does not expire."
          sx={{
            "& .MuiOutlinedInput-root": {
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#395B45" },
            },
            "& .MuiInputLabel-root.Mui-focused": { color: "#395B45" },
          }}
        />

        {/* Upload progress */}
        {uploading && (
          <Box sx={{ mt: 3, px: 0.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>Uploading…</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: "#6B7280" }}>{progress}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ borderRadius: 4, height: 7, bgcolor: "#E5E7EB", "& .MuiLinearProgress-bar": { bgcolor: "#395B45", borderRadius: 4 } }}
            />
          </Box>
        )}
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions sx={{ px: 3, py: 2.5, borderTop: "1px solid #F3F4F6", gap: 1, bgcolor: "#FAFAFA" }}>
        <Button
          onClick={handleClose}
          disabled={uploading}
          sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none", minHeight: 40 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || !displayName.trim() || uploading}
          startIcon={uploading ? <CircularProgress size={15} color="inherit" /> : <Upload size={15} />}
          sx={{
            bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" },
            fontWeight: 600, textTransform: "none",
            minWidth: 130, minHeight: 40, boxShadow: "none",
          }}
        >
          {uploading ? "Uploading…" : "Upload File"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  files: AuditFile[];
  onClose: () => void;
  onDeleted: (ids: string[]) => void;
}

function DeleteDialog({ files, onClose, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const token   = await getToken();
      const results = await Promise.allSettled(
        files.map((f) =>
          fetch(`/api/admin/audit-files/${f.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      const deleted = files.filter((_, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value.ok;
      });
      if (deleted.length === 0) {
        setError("Could not delete the selected file(s). Please try again.");
        return;
      }
      onDeleted(deleted.map((f) => f.id));
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setDeleting(false);
    }
  }

  const isBulk = files.length > 1;

  return (
    <Dialog open onClose={() => !deleting && onClose()} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2.5 } } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AlertCircle size={20} color="#DC2626" />
          <Typography sx={{ fontWeight: 700, color: "#111827" }}>
            {isBulk ? `Delete ${files.length} files?` : "Delete file?"}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>{error}</Alert>}
        <Typography sx={{ fontSize: "0.875rem", color: "#374151" }}>
          {isBulk
            ? `This will permanently delete ${files.length} files. This action cannot be undone.`
            : `"${files[0]?.display_name}" will be permanently deleted. This action cannot be undone.`}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: "1px solid #F3F4F6" }}>
        <Button onClick={onClose} disabled={deleting}
          sx={{ color: "#6B7280", fontWeight: 500, textTransform: "none" }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleDelete} disabled={deleting}
          startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
          sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, fontWeight: 600, textTransform: "none", boxShadow: "none" }}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AuditFilesPage() {
  const [files, setFiles]                 = useState<AuditFile[]>([]);
  const [loading, setLoading]             = useState(true);
  const [pageError, setPageError]         = useState("");
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen]       = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<AuditFile[] | null>(null);
  const [downloading, setDownloading]     = useState<Set<string>>(new Set());

  // ── Load files ──────────────────────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/audit-files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json  = await res.json();
      if (!res.ok) { setPageError(json.error ?? "Failed to load files."); return; }
      setFiles(json.data as AuditFile[]);
    } catch {
      setPageError("An unexpected error occurred while loading files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Selection helpers ────────────────────────────────────────────────────────

  const allSelected  = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(files.map((f) => f.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  async function downloadFile(file: AuditFile) {
    setDownloading((prev) => new Set(prev).add(file.id));
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/audit-files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json  = await res.json();
      if (!res.ok || !json.data?.url) {
        setPageError("Could not generate download link. Please try again.");
        return;
      }
      const a  = document.createElement("a");
      a.href   = json.data.url;
      a.download = json.data.display_name ?? file.display_name;
      a.click();
    } catch {
      setPageError("Download failed. Please try again.");
    } finally {
      setDownloading((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
    }
  }

  async function downloadSelected() {
    const targets = files.filter((f) => selected.has(f.id));
    for (const f of targets) {
      await downloadFile(f);
      // Small stagger to avoid browser popup blocking
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ── Delete callbacks ─────────────────────────────────────────────────────────

  function handleDeletedIds(ids: string[]) {
    setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedFiles = files.filter((f) => selected.has(f.id));

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", mb: 0.5 }}>
            Audit Vault
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#6B7280" }}>
            Store your audit files here. Files are private to your firm.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Upload size={16} />}
          onClick={() => setUploadOpen(true)}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", boxShadow: "none", minHeight: 42 }}
        >
          Upload File
        </Button>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError("")} sx={{ mb: 3, borderRadius: 1.5 }}>
          {pageError}
        </Alert>
      )}

      {/* ── Bulk action toolbar ───────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2, borderRadius: 1.5, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#F0FDF4", borderColor: "#BBF7D0", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#15803D", flex: 1 }}>
            {selected.size} file{selected.size !== 1 ? "s" : ""} selected
          </Typography>
          <Button
            size="small"
            startIcon={<Download size={14} />}
            onClick={downloadSelected}
            sx={{ fontWeight: 600, textTransform: "none", color: "#395B45", borderColor: "#395B45", "&:hover": { bgcolor: "rgba(57,91,69,0.06)" } }}
            variant="outlined"
          >
            Download Selected
          </Button>
          <Button
            size="small"
            startIcon={<Trash2 size={14} />}
            onClick={() => setDeleteTargets(selectedFiles)}
            sx={{ fontWeight: 600, textTransform: "none", color: "#DC2626", borderColor: "#DC2626", "&:hover": { bgcolor: "rgba(220,38,38,0.06)" } }}
            variant="outlined"
          >
            Delete Selected
          </Button>
        </Paper>
      )}

      {/* ── File table ───────────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress sx={{ color: "#395B45" }} />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ py: 10, textAlign: "center" }}>
            <Box sx={{ bgcolor: "#F3F4F6", borderRadius: "50%", p: 2, display: "inline-flex", mb: 2 }}>
              <FileText size={28} color="#9CA3AF" />
            </Box>
            <Typography sx={{ fontWeight: 600, color: "#374151", mb: 0.5 }}>
              No audit files yet
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: "#9CA3AF", mb: 2.5 }}>
              Upload your first audit file to get started.
            </Typography>
            <Button variant="contained" startIcon={<Upload size={15} />} onClick={() => setUploadOpen(true)}
              sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", boxShadow: "none" }}>
              Upload File
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                  {/* Select all */}
                  <TableCell padding="checkbox" sx={{ pl: 2, borderBottom: "1px solid #E5E7EB" }}>
                    <Tooltip title={allSelected ? "Deselect all" : "Select all"}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        size="small"
                        sx={{ color: "#9CA3AF", "&.Mui-checked": { color: "#395B45" }, "&.MuiCheckbox-indeterminate": { color: "#395B45" } }}
                        icon={<Square size={16} />}
                        checkedIcon={<CheckSquare size={16} />}
                        indeterminateIcon={<CheckSquare size={16} />}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #E5E7EB" }}>
                    File Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #E5E7EB" }}>
                    Size
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #E5E7EB" }}>
                    Uploaded
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #E5E7EB" }}>
                    Expires
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 2, fontWeight: 700, fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #E5E7EB" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {files.map((file, idx) => {
                  const expired     = isExpired(file.expires_at);
                  const expiringSoon = isExpiringSoon(file.expires_at);
                  const isSelected  = selected.has(file.id);
                  const isDownloading = downloading.has(file.id);

                  return (
                    <TableRow key={file.id}
                      hover
                      selected={isSelected}
                      sx={{
                        bgcolor: isSelected ? "rgba(57,91,69,0.04)" : "transparent",
                        borderBottom: idx < files.length - 1 ? "1px solid #F3F4F6" : "none",
                        "&:last-child td": { borderBottom: 0 },
                        "&.Mui-selected": { bgcolor: "rgba(57,91,69,0.06)" },
                        "&.Mui-selected:hover": { bgcolor: "rgba(57,91,69,0.09)" },
                      }}
                    >
                      {/* Checkbox */}
                      <TableCell padding="checkbox" sx={{ pl: 2 }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleOne(file.id)}
                          size="small"
                          sx={{ color: "#9CA3AF", "&.Mui-checked": { color: "#395B45" } }}
                          icon={<Square size={16} />}
                          checkedIcon={<CheckSquare size={16} />}
                        />
                      </TableCell>

                      {/* File name */}
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                          <Box sx={{ bgcolor: "#F3F4F6", borderRadius: 1, p: 0.75, display: "flex", flexShrink: 0 }}>
                            <FileText size={16} color="#6B7280" />
                          </Box>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                            {file.display_name}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Size */}
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <HardDrive size={13} color="#9CA3AF" />
                          <Typography sx={{ fontSize: "0.82rem", color: "#6B7280" }}>
                            {formatBytes(file.file_size)}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Uploaded */}
                      <TableCell>
                        <Typography sx={{ fontSize: "0.82rem", color: "#6B7280" }}>
                          {formatDate(file.created_at)}
                        </Typography>
                      </TableCell>

                      {/* Expires */}
                      <TableCell>
                        {file.expires_at ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <CalendarDays size={13} color={expired ? "#DC2626" : expiringSoon ? "#D97706" : "#9CA3AF"} />
                            <Chip
                              label={formatDate(file.expires_at)}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20, fontSize: "0.72rem", fontWeight: 600,
                                borderColor: expired ? "#FECACA" : expiringSoon ? "#FDE68A" : "#E5E7EB",
                                color:       expired ? "#DC2626" : expiringSoon ? "#D97706" : "#6B7280",
                                bgcolor:     expired ? "#FEF2F2" : expiringSoon ? "#FFFBEB" : "transparent",
                              }}
                            />
                            {expired && (
                              <Chip label="Expired" size="small"
                                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#FEF2F2", color: "#DC2626", border: "none" }} />
                            )}
                            {expiringSoon && !expired && (
                              <Chip label="Soon" size="small"
                                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#FFFBEB", color: "#D97706", border: "none" }} />
                            )}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.82rem", color: "#D1D5DB" }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right" sx={{ pr: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                          <Tooltip title="Download">
                            <span>
                              <IconButton size="small" onClick={() => downloadFile(file)} disabled={isDownloading}
                                sx={{ color: "#395B45", "&:hover": { bgcolor: "rgba(57,91,69,0.08)" } }}>
                                {isDownloading
                                  ? <CircularProgress size={15} sx={{ color: "#395B45" }} />
                                  : <Download size={16} />
                                }
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, height: 18, alignSelf: "center" }} />
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => setDeleteTargets([file])}
                              sx={{ color: "#9CA3AF", "&:hover": { color: "#DC2626", bgcolor: "rgba(220,38,38,0.06)" } }}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── File count footer ─────────────────────────────────────────────────── */}
      {!loading && files.length > 0 && (
        <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AF", mt: 1.5, textAlign: "right" }}>
          {files.length} file{files.length !== 1 ? "s" : ""} stored
        </Typography>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(f) => setFiles((prev) => [f, ...prev])}
      />

      {deleteTargets && (
        <DeleteDialog
          files={deleteTargets}
          onClose={() => setDeleteTargets(null)}
          onDeleted={handleDeletedIds}
        />
      )}
    </Box>
  );
}
