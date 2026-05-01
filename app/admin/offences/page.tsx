"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  Checkbox,
  Chip,
  Skeleton,
  Alert,
  InputAdornment,
} from "@mui/material";
import {
  Scale,
  Plus,
  Trash2,
  Edit2,
  Upload,
  AlertCircle,
  Search,
  FileSpreadsheet,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Offence {
  id: string;
  category: string;
  type: string;
  offence: string;
  uploaded_by: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  "Violence":        { bg: "#FEE2E2", color: "#991B1B" },
  "Theft":           { bg: "#FEF3C7", color: "#92400E" },
  "Drug Offences":   { bg: "#EDE9FE", color: "#5B21B6" },
  "Motoring":        { bg: "#DBEAFE", color: "#1E40AF" },
  "Public Order":    { bg: "#FCE7F3", color: "#9D174D" },
  "Sexual Offences": { bg: "#FFE4E6", color: "#9F1239" },
  "Fraud":           { bg: "#D1FAE5", color: "#065F46" },
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "#F3F4F6", color: "#374151" };
}

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminOffencesPage() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [offences, setOffences] = useState<Offence[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Filters — raw input values (instant) ────────────────────────────────────
  const [searchOffence, setSearchOffence] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchType, setSearchType] = useState("");

  // ── Debounced values — drive the actual filter (300 ms delay) ───────────────
  const [debouncedOffence, setDebouncedOffence] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");
  const [debouncedType, setDebouncedType] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedOffence(searchOffence); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchOffence]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedCategory(searchCategory); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchCategory]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedType(searchType); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchType]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // ── Add / Edit dialog ────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editOffence, setEditOffence] = useState<Partial<Offence>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Single delete dialog ─────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Offence | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Bulk delete dialog ───────────────────────────────────────────────────────
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Import dialog ────────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  useEffect(() => { fetchOffences(); }, []);

  async function fetchOffences() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offences");
      const json = await res.json();
      if (json.success) setOffences(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = offences;
    if (debouncedOffence.trim()) {
      const q = debouncedOffence.toLowerCase();
      list = list.filter((o) => o.offence.toLowerCase().includes(q));
    }
    if (debouncedCategory.trim()) {
      const q = debouncedCategory.toLowerCase();
      list = list.filter((o) => o.category.toLowerCase().includes(q));
    }
    if (debouncedType.trim()) {
      const q = debouncedType.toLowerCase();
      list = list.filter((o) => o.type.toLowerCase().includes(q));
    }
    return list;
  }, [offences, debouncedOffence, debouncedCategory, debouncedType]);

  const paginated = useMemo(
    () => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filtered, page, rowsPerPage]
  );

  function clearAllSearch() {
    setSearchOffence(""); setSearchCategory(""); setSearchType("");
    setDebouncedOffence(""); setDebouncedCategory(""); setDebouncedType("");
    setPage(0);
  }

  // ── Selection helpers ─────────────────────────────────────────────────────────

  // IDs visible on the current page
  const pageIds = useMemo(() => paginated.map((o) => o.id), [paginated]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id)) && !allPageSelected;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePageAll() {
    if (allPageSelected) {
      // deselect all on this page
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // select all on this page
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Add / Edit ───────────────────────────────────────────────────────────────

  function openAdd() {
    setEditOffence({ category: "", type: "", offence: "" });
    setSaveError("");
    setEditOpen(true);
  }

  function openEdit(o: Offence) {
    setEditOffence({ id: o.id, category: o.category, type: o.type, offence: o.offence });
    setSaveError("");
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editOffence.offence?.trim()) {
      setSaveError("Offence description is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const isEdit = !!editOffence.id;
      const res = await fetch(
        isEdit ? `/api/admin/offences/${editOffence.id}` : "/api/admin/offences",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({
            category: editOffence.category ?? "",
            type: editOffence.type ?? "",
            offence: editOffence.offence ?? "",
          }),
        }
      );
      if (!res.ok) {
        const j = await res.json();
        setSaveError(j.error || "Failed to save.");
        return;
      }
      await fetchOffences();
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Single delete ─────────────────────────────────────────────────────────────

  function openDelete(o: Offence) {
    setDeleteTarget(o);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/offences/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      // remove from selection if it was selected
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      await fetchOffences();
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/offences", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const j = await res.json();
        console.error("Bulk delete failed:", j.error);
        return;
      }
      clearSelection();
      await fetchOffences();
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function openImport() {
    setImportFile(null);
    setImportResult(null);
    setImportError("");
    setImportOpen(true);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/admin/offences/import", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setImportError(json.error || "Import failed.");
        return;
      }
      setImportResult(json.data);
      await fetchOffences();
    } finally {
      setImporting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <Box>
      {/* ── Page header ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: { xs: 2.5, sm: 4 }, gap: 1, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Offences Database
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage the global library of UK criminal offences available to all firms
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Upload size={14} />}
            onClick={openImport}
            sx={{
              color: "#395B45",
              borderColor: "#395B45",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
              fontSize: { xs: "0.72rem", sm: "0.8rem", md: "0.875rem" },
              px: { xs: 1, sm: 1.5, md: 2 },
              py: { xs: "4px", sm: "5px" },
              "&:hover": { bgcolor: "rgba(57,91,69,0.05)" },
            }}
          >
            Import Excel
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={openAdd}
            sx={{
              bgcolor: "#395B45",
              "&:hover": { bgcolor: "#2D4A38" },
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
              fontSize: { xs: "0.72rem", sm: "0.8rem", md: "0.875rem" },
              px: { xs: 1, sm: 1.5, md: 2 },
              py: { xs: "4px", sm: "5px" },
            }}
          >
            Add Offence
          </Button>
        </Box>
      </Box>

      {/* ── Table card ── */}
      <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 3, overflow: "hidden" }}>

        {/* ── Search toolbar ── */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: "1px solid #E5E7EB",
            bgcolor: "#FAFAFA",
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <TextField
            size="small"
            placeholder="Search offence…"
            value={searchOffence}
            onChange={(e) => setSearchOffence(e.target.value)}
            sx={{ flexGrow: 2, minWidth: 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><Search size={14} color="#9CA3AF" /></InputAdornment>
                ),
                sx: { bgcolor: "#fff", borderRadius: 1.5, fontSize: "0.875rem" },
              },
            }}
          />
          <TextField
            size="small"
            placeholder="Search category…"
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 160 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><Search size={14} color="#9CA3AF" /></InputAdornment>
                ),
                sx: { bgcolor: "#fff", borderRadius: 1.5, fontSize: "0.875rem" },
              },
            }}
          />
          <TextField
            size="small"
            placeholder="Search type…"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 160 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><Search size={14} color="#9CA3AF" /></InputAdornment>
                ),
                sx: { bgcolor: "#fff", borderRadius: 1.5, fontSize: "0.875rem" },
              },
            }}
          />
        </Box>

        {/* ── Bulk action bar — shown only when rows are selected ── */}
        {selectedCount > 0 && (
          <Box
            sx={{
              px: 2.5,
              py: 1.25,
              bgcolor: "#FEF2F2",
              borderBottom: "1px solid #FECACA",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#991B1B", flexGrow: 1 }}>
              {selectedCount} offence{selectedCount !== 1 ? "s" : ""} selected
            </Typography>
            <Button
              size="small"
              onClick={clearSelection}
              sx={{ textTransform: "none", color: "#6B7280", fontWeight: 500 }}
            >
              Clear selection
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Trash2 size={14} />}
              onClick={() => setBulkDeleteOpen(true)}
              sx={{
                bgcolor: "#EF4444",
                "&:hover": { bgcolor: "#DC2626" },
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 1.5,
              }}
            >
              Delete {selectedCount} selected
            </Button>
          </Box>
        )}

        {/* ── Table ── */}
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {/* Select-all checkbox — selects/deselects current page */}
              <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                <Checkbox
                  size="small"
                  checked={allPageSelected}
                  indeterminate={somePageSelected}
                  onChange={togglePageAll}
                  disabled={loading || paginated.length === 0}
                  sx={{
                    color: "#D1D5DB",
                    "&.Mui-checked": { color: "#395B45" },
                    "&.MuiCheckbox-indeterminate": { color: "#395B45" },
                  }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#374151", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.4 }}>
                Offence
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#374151", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.4, width: 200 }}>
                Category
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#374151", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.4, width: 180 }}>
                Type
              </TableCell>
              <TableCell sx={{ width: 88 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell padding="checkbox" sx={{ pl: 1.5 }}><Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: 0.5 }} /></TableCell>
                  <TableCell><Skeleton width="80%" /></TableCell>
                  <TableCell><Skeleton width={110} /></TableCell>
                  <TableCell><Skeleton width={110} /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ border: 0 }}>
                  <Box sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                    <Scale size={40} color="#D1D5DB" />
                    <Typography variant="body2" sx={{ color: "#9CA3AF", textAlign: "center" }}>
                      {offences.length === 0
                        ? "No offences yet — import an Excel file or add one manually."
                        : "No offences match your search. Try different terms."}
                    </Typography>
                    {(debouncedOffence || debouncedCategory || debouncedType) && (
                      <Button
                        size="small"
                        onClick={clearAllSearch}
                        sx={{ textTransform: "none", color: "#395B45", fontWeight: 600 }}
                      >
                        Clear search
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((o) => {
                const cs = categoryStyle(o.category);
                const isSelected = selected.has(o.id);
                return (
                  <TableRow
                    key={o.id}
                    selected={isSelected}
                    sx={{
                      cursor: "default",
                      "&.Mui-selected": { bgcolor: "rgba(57,91,69,0.06)" },
                      "&.Mui-selected:hover": { bgcolor: "rgba(57,91,69,0.09)" },
                      "&:hover": { bgcolor: "#F9FAFB" },
                      "&:last-child td": { border: 0 },
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => toggleRow(o.id)}
                        sx={{
                          color: "#D1D5DB",
                          "&.Mui-checked": { color: "#395B45" },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", color: "#111827", py: 1.25 }}>
                      {o.offence}
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      {o.category ? (
                        <Chip
                          label={o.category}
                          size="small"
                          sx={{ bgcolor: cs.bg, color: cs.color, fontWeight: 600, fontSize: "0.72rem", height: 22 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: "#D1D5DB" }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      {o.type ? (
                        <Typography variant="caption" sx={{ color: "#6B7280", fontWeight: 500 }}>{o.type}</Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: "#D1D5DB" }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.25, pr: 1.5 }}>
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(o)}
                          sx={{ color: "#6B7280", "&:hover": { bgcolor: "#F3F4F6" } }}
                        >
                          <Edit2 size={14} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => openDelete(o)}
                          sx={{ color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* ── Pagination ── */}
        {!loading && filtered.length > 0 && (
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{
              borderTop: "1px solid #F3F4F6",
              bgcolor: "#FAFAFA",
              fontSize: "0.8rem",
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
                fontSize: "0.8rem",
                color: "#6B7280",
              },
              "& .MuiTablePagination-select": { fontSize: "0.8rem" },
            }}
          />
        )}
      </Paper>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editOffence.id ? "Edit Offence" : "Add Offence"}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {saveError && <Alert severity="error" sx={{ borderRadius: 2 }}>{saveError}</Alert>}
          <TextField
            label="Offence"
            fullWidth
            value={editOffence.offence ?? ""}
            onChange={(e) => setEditOffence({ ...editOffence, offence: e.target.value })}
            placeholder="e.g. Theft Act 1968 s.1 — Theft"
            helperText="Required. The full offence description."
          />
          <TextField
            label="Category"
            fullWidth
            value={editOffence.category ?? ""}
            onChange={(e) => setEditOffence({ ...editOffence, category: e.target.value })}
            placeholder="e.g. Theft, Violence, Drug Offences"
          />
          <TextField
            label="Type"
            fullWidth
            value={editOffence.type ?? ""}
            onChange={(e) => setEditOffence({ ...editOffence, type: e.target.value })}
            placeholder="e.g. Either Way, Summary Only, Indictable Only"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editOffence.offence?.trim() || saving}
            onClick={handleSave}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
          >
            {saving ? "Saving…" : editOffence.id ? "Save Changes" : "Add Offence"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Single delete dialog ── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ bgcolor: "#FEF2F2", p: 1, borderRadius: 2, display: "flex" }}>
            <AlertCircle size={18} color="#EF4444" />
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Confirm Delete</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Are you sure you want to delete <strong>&quot;{deleteTarget?.offence}&quot;</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={deleting}
            onClick={handleDelete}
            sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, textTransform: "none", fontWeight: 600 }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk delete dialog ── */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ bgcolor: "#FEF2F2", p: 1, borderRadius: 2, display: "flex" }}>
            <AlertCircle size={18} color="#EF4444" />
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Confirm Bulk Delete</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            You are about to permanently delete{" "}
            <strong>{selectedCount} offence{selectedCount !== 1 ? "s" : ""}</strong>.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
            sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, textTransform: "none", fontWeight: 600 }}
          >
            {bulkDeleting ? "Deleting…" : `Delete ${selectedCount} offence${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Import Excel dialog ── */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Import Offences from Excel</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <Box sx={{ bgcolor: "#F0F5F1", border: "1px solid #C6D9CB", borderRadius: 2, p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#395B45", mb: 0.75 }}>
              Required Excel format
            </Typography>
            <Typography variant="caption" sx={{ color: "#4B5563", display: "block", lineHeight: 1.7 }}>
              Your spreadsheet must have these column headers in row 1:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
              <Typography component="li" variant="caption" sx={{ color: "#374151" }}>
                <strong>offence</strong> — required (e.g. "Theft Act 1968 s.1 — Theft")
              </Typography>
              <Typography component="li" variant="caption" sx={{ color: "#374151" }}>
                <strong>category</strong> — optional (e.g. "Theft")
              </Typography>
              <Typography component="li" variant="caption" sx={{ color: "#374151" }}>
                <strong>type</strong> — optional (e.g. "Either Way")
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "#6B7280", display: "block", mt: 0.75 }}>
              Headers are case-insensitive. Max file size: 5 MB.
            </Typography>
          </Box>

          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: importFile ? "#395B45" : "#D1D5DB",
              borderRadius: 2,
              py: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              bgcolor: importFile ? "rgba(57,91,69,0.04)" : "#FAFAFA",
              transition: "border-color 0.15s, background-color 0.15s",
              "&:hover": { borderColor: "#395B45", bgcolor: "rgba(57,91,69,0.04)" },
            }}
          >
            <FileSpreadsheet size={32} color={importFile ? "#395B45" : "#9CA3AF"} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: importFile ? "#395B45" : "#374151" }}>
              {importFile ? importFile.name : "Click to choose an Excel file"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              .xlsx or .xls accepted
            </Typography>
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setImportFile(f);
              setImportResult(null);
              setImportError("");
              e.target.value = "";
            }}
          />

          {importResult && (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Successfully imported <strong>{importResult.inserted}</strong> offence
              {importResult.inserted !== 1 ? "s" : ""}
              {importResult.skipped > 0
                ? ` — ${importResult.skipped} row${importResult.skipped !== 1 ? "s" : ""} skipped (missing offence value)`
                : ""}.
            </Alert>
          )}
          {importError && <Alert severity="error" sx={{ borderRadius: 2 }}>{importError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setImportOpen(false)} sx={{ color: "#6B7280", textTransform: "none" }}>
            {importResult ? "Close" : "Cancel"}
          </Button>
          {!importResult && (
            <Button
              variant="contained"
              disabled={!importFile || importing}
              onClick={handleImport}
              startIcon={<Upload size={15} />}
              sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
