"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Box, Typography, Button, Card, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Table,
  TableBody, TableCell, TableHead, TableRow, Skeleton,
  IconButton, Tooltip, InputAdornment, Divider, List,
  ListItem, ListItemText, LinearProgress, Collapse,
} from "@mui/material";
import {
  UserPlus, Users, Search, Edit2, Trash2, Paperclip,
  Upload, X, ChevronDown, ChevronUp, FileText, Download,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface Client {
  id: string;
  full_name: string;
  date_of_birth: string;
  address: string;
  ni_number: string;
  status: string | null;
  audit_trail: string[];
  created_at: string;
  updated_at: string;
  client_attachments: Attachment[];
}

type DialogMode = "add" | "edit" | "view";

interface FormState {
  full_name: string;
  date_of_birth: string;
  address: string;
  ni_number: string;
  status: string;
  audit_entry: string;
}

const EMPTY_FORM: FormState = {
  full_name: "", date_of_birth: "", address: "",
  ni_number: "", status: "", audit_entry: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}

function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [error, setError]             = useState("");
  const [successMsg, setSuccessMsg]   = useState("");

  // Dialog
  const [dialogMode, setDialogMode]   = useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // Attachments
  const [uploading, setUploading]     = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Attachment delete confirm
  const [attachDeleteTarget, setAttachDeleteTarget] = useState<{ clientId: string; attachmentId: string; fileName: string } | null>(null);
  const [attachDeleting, setAttachDeleting]         = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadClients = useCallback(async (q = "") => {
    setLoading(true);
    const params = q ? `?search=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/clients${params}`);
    if (res.ok) {
      const json = await res.json();
      setClients((json.data ?? []) as Client[]);
    } else {
      setError("Failed to load clients.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadClients(search), 350);
    return () => clearTimeout(t);
  }, [search, loadClients]);

  // ── Dialog helpers ───────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setActiveClient(null);
    setDialogError("");
    setDialogMode("add");
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setForm({
      full_name:     client.full_name,
      date_of_birth: client.date_of_birth,
      address:       client.address,
      ni_number:     client.ni_number,
      status:        client.status ?? "",
      audit_entry:   "",
    });
    setActiveClient(client);
    setDialogError("");
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function openView(client: Client) {
    setActiveClient(client);
    setDialogError("");
    setDialogMode("view");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setActiveClient(null);
    setForm(EMPTY_FORM);
    setDialogError("");
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  // ── Save (create / update) ───────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setDialogError("");

    const method = dialogMode === "add" ? "POST" : "PUT";
    const url    = dialogMode === "add" ? "/api/clients" : `/api/clients/${activeClient!.id}`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    if (!res.ok) {
      setDialogError(json.error ?? "Failed to save client.");
      setSaving(false);
      return;
    }

    closeDialog();
    await loadClients(search);
    showSuccess(dialogMode === "add" ? "Client added." : "Client updated.");
    setSaving(false);
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/clients/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      await loadClients(search);
      showSuccess("Client deleted.");
    } else {
      const json = await res.json();
      setError(json.error ?? "Failed to delete client.");
    }
    setDeleting(false);
  }

  // ── Attachment upload ────────────────────────────────────────────────────

  async function handleAttachmentUpload(clientId: string, files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const token = await getToken();

    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      await fetch(`/api/clients/${clientId}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
    }

    await loadClients(search);
    // Refresh active client in view dialog
    if (activeClient?.id === clientId) {
      const fresh = await fetch(`/api/clients/${clientId}`);
      if (fresh.ok) {
        const j = await fresh.json();
        setActiveClient(j.data as Client);
      }
    }
    setUploading(false);
  }

  // ── Attachment download (signed URL) ─────────────────────────────────────

  async function handleDownload(attachment: Attachment) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("client-attachments")
      .createSignedUrl(attachment.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  // ── Attachment delete ────────────────────────────────────────────────────

  async function confirmAttachmentDelete() {
    if (!attachDeleteTarget) return;
    setAttachDeleting(true);
    const { clientId, attachmentId } = attachDeleteTarget;
    const res = await fetch(
      `/api/clients/${clientId}/attachments?attachment_id=${attachmentId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setAttachDeleteTarget(null);
      await loadClients(search);
      if (activeClient?.id === clientId) {
        const fresh = await fetch(`/api/clients/${clientId}`);
        if (fresh.ok) setActiveClient((await fresh.json()).data as Client);
      }
      showSuccess("Attachment deleted.");
    } else {
      const json = await res.json().catch(() => ({}));
      setDialogError(json.error ?? "Failed to delete attachment.");
    }
    setAttachDeleting(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const skeletonRows = [1, 2, 3, 4, 5];

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3, gap: 1, flexWrap: "wrap" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Users size={20} color="#395B45" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
              Clients
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "#6B7280" }}>
            Manage client records, attachments and audit history.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserPlus size={16} />}
          onClick={openAdd}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", flexShrink: 0 }}
        >
          Add Client
        </Button>
      </Box>

      {/* ── Feedback ────────────────────────────────────────────────────── */}
      {error      && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by name or NI number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><Search size={16} color="#9CA3AF" /></InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><X size={14} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{ mb: 2, bgcolor: "#fff", borderRadius: 1 }}
      />

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["Name", "Date of Birth", "NI Number", "Status", "Attachments", "Updated", "Actions"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.78rem", color: "#374151", py: 1.5 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              skeletonRows.map((i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton height={20} /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <Users size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
                    <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 1.5 }}>
                      {search ? "No clients match your search." : "No clients yet."}
                    </Typography>
                    {!search && (
                      <Button
                        size="small"
                        startIcon={<UserPlus size={14} />}
                        onClick={openAdd}
                        sx={{ color: "#395B45", textTransform: "none", fontWeight: 600 }}
                      >
                        Add your first client
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  hover
                  sx={{ cursor: "pointer", "&:hover": { bgcolor: "#F9FAFB" } }}
                  onClick={() => openView(client)}
                >
                  <TableCell sx={{ fontWeight: 600, color: "#111827", fontSize: "0.85rem" }}>
                    {client.full_name}
                  </TableCell>
                  <TableCell sx={{ color: "#374151", fontSize: "0.82rem" }}>
                    {formatDate(client.date_of_birth)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={client.ni_number}
                      size="small"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem", bgcolor: "#F3F4F6", color: "#374151" }}
                    />
                  </TableCell>
                  <TableCell>
                    {client.status ? (
                      <Chip label={client.status} size="small" sx={{ bgcolor: "#EEF2FF", color: "#4338CA", fontWeight: 600, fontSize: "0.72rem" }} />
                    ) : (
                      <Typography sx={{ color: "#9CA3AF", fontSize: "0.78rem" }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.client_attachments.length > 0 ? (
                      <Chip
                        icon={<Paperclip size={11} />}
                        label={client.client_attachments.length}
                        size="small"
                        sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 600, fontSize: "0.72rem" }}
                      />
                    ) : (
                      <Typography sx={{ color: "#D1D5DB", fontSize: "0.78rem" }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "#6B7280", fontSize: "0.78rem" }}>
                    {formatDate(client.updated_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="Edit client">
                        <IconButton size="small" onClick={() => openEdit(client)} sx={{ color: "#6B7280", "&:hover": { color: "#395B45" } }}>
                          <Edit2 size={15} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete client">
                        <IconButton size="small" onClick={() => setDeleteId(client.id)} sx={{ color: "#6B7280", "&:hover": { color: "#DC2626" } }}>
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Add / Edit dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen && dialogMode !== "view"} onClose={closeDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {dialogMode === "add" ? "Add New Client" : "Edit Client"}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
          {dialogError && <Alert severity="error" sx={{ mb: 0 }}>{dialogError}</Alert>}

          <TextField
            label="Full Name *"
            fullWidth size="small"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Date of Birth *"
              type="date"
              fullWidth size="small"
              value={form.date_of_birth}
              onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="NI Number *"
              fullWidth size="small"
              placeholder="AB123456C"
              value={form.ni_number}
              onChange={(e) => setForm((p) => ({ ...p, ni_number: e.target.value.toUpperCase() }))}
              inputProps={{ style: { fontFamily: "monospace" } }}
            />
          </Box>
          <TextField
            label="Address *"
            fullWidth size="small"
            multiline rows={2}
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
          <TextField
            label="Status"
            fullWidth size="small"
            placeholder="e.g. Active, Closed, On bail…"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          />
          {dialogMode === "edit" && (
            <TextField
              label="Add Audit Note (optional)"
              fullWidth size="small"
              multiline rows={2}
              placeholder="e.g. Address updated following court appearance"
              value={form.audit_entry}
              onChange={(e) => setForm((p) => ({ ...p, audit_entry: e.target.value }))}
              helperText="This note will be appended to the audit trail with your name and timestamp."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={closeDialog} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.full_name.trim() || !form.date_of_birth || !form.address.trim() || !form.ni_number.trim()}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600, textTransform: "none", minWidth: 100 }}
          >
            {saving ? "Saving…" : dialogMode === "add" ? "Add Client" : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View dialog ──────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen && dialogMode === "view"} onClose={closeDialog} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        {activeClient && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#111827" }}>
                    {activeClient.full_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                    NI: {activeClient.ni_number} · DOB: {formatDate(activeClient.date_of_birth)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button size="small" startIcon={<Edit2 size={14} />}
                    onClick={() => { closeDialog(); openEdit(activeClient); }}
                    sx={{ color: "#395B45", textTransform: "none", fontWeight: 600 }}>
                    Edit
                  </Button>
                  <IconButton size="small" onClick={closeDialog} sx={{ color: "#9CA3AF" }}>
                    <X size={18} />
                  </IconButton>
                </Box>
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2.5 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

                {/* Core details */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  {[
                    { label: "Full Name",     value: activeClient.full_name },
                    { label: "Date of Birth", value: formatDate(activeClient.date_of_birth) },
                    { label: "NI Number",     value: activeClient.ni_number },
                    { label: "Status",        value: activeClient.status || "—" },
                  ].map(({ label, value }) => (
                    <Box key={label}>
                      <Typography variant="caption" sx={{ color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.68rem" }}>
                        {label}
                      </Typography>
                      <Typography sx={{ color: "#111827", fontWeight: 500, fontSize: "0.88rem", fontFamily: label === "NI Number" ? "monospace" : "inherit" }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <Typography variant="caption" sx={{ color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.68rem" }}>
                      Address
                    </Typography>
                    <Typography sx={{ color: "#111827", fontWeight: 500, fontSize: "0.88rem", whiteSpace: "pre-line" }}>
                      {activeClient.address}
                    </Typography>
                  </Box>
                </Box>

                <Divider />

                {/* Attachments */}
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Paperclip size={16} color="#395B45" />
                      <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem" }}>
                        Attachments
                      </Typography>
                      {activeClient.client_attachments.length > 0 && (
                        <Chip label={activeClient.client_attachments.length} size="small"
                          sx={{ bgcolor: "#F3F4F6", fontSize: "0.7rem", height: 18 }} />
                      )}
                    </Box>
                    <Button
                      size="small"
                      startIcon={uploading ? null : <Upload size={14} />}
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ color: "#395B45", textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
                    >
                      {uploading ? "Uploading…" : "Upload file"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => handleAttachmentUpload(activeClient.id, e.target.files)}
                    />
                  </Box>
                  {uploading && <LinearProgress sx={{ mb: 1.5, borderRadius: 2 }} />}
                  {activeClient.client_attachments.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 3, border: "2px dashed #E5E7EB", borderRadius: 2 }}>
                      <FileText size={24} color="#D1D5DB" style={{ display: "block", margin: "0 auto 6px" }} />
                      <Typography variant="caption" sx={{ color: "#9CA3AF" }}>No attachments yet</Typography>
                    </Box>
                  ) : (
                    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {activeClient.client_attachments.map((att) => (
                        <ListItem key={att.id} disablePadding
                          sx={{ bgcolor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 1.5, px: 1.5, py: 0.75, gap: 1 }}>
                          <FileText size={15} color="#6B7280" style={{ flexShrink: 0 }} />
                          <ListItemText
                            primary={att.file_name}
                            secondary={`${formatBytes(att.file_size)} · ${formatDate(att.created_at)}`}
                            primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", noWrap: true }}
                            secondaryTypographyProps={{ fontSize: "0.72rem", color: "#9CA3AF" }}
                            sx={{ overflow: "hidden" }}
                          />
                          <Tooltip title="Download">
                            <IconButton size="small" onClick={() => handleDownload(att)} sx={{ color: "#6B7280", "&:hover": { color: "#395B45" }, flexShrink: 0 }}>
                              <Download size={14} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete attachment">
                            <IconButton size="small"
                              onClick={() => setAttachDeleteTarget({ clientId: activeClient.id, attachmentId: att.id, fileName: att.file_name })}
                              sx={{ color: "#6B7280", "&:hover": { color: "#DC2626" }, flexShrink: 0 }}>
                              <Trash2 size={14} />
                            </IconButton>
                          </Tooltip>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>

                <Divider />

                {/* Audit trail */}
                <Box>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", userSelect: "none" }}
                    onClick={() => setExpandedAudit(expandedAudit === activeClient.id ? null : activeClient.id)}
                  >
                    <ClipboardList size={16} color="#395B45" />
                    <Typography sx={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem", flex: 1 }}>
                      Audit Trail
                    </Typography>
                    <Chip label={activeClient.audit_trail.length} size="small"
                      sx={{ bgcolor: "#F3F4F6", fontSize: "0.7rem", height: 18 }} />
                    {expandedAudit === activeClient.id
                      ? <ChevronUp size={16} color="#9CA3AF" />
                      : <ChevronDown size={16} color="#9CA3AF" />}
                  </Box>
                  <Collapse in={expandedAudit === activeClient.id}>
                    <Box sx={{ mt: 1.5, maxHeight: 220, overflowY: "auto" }}>
                      {activeClient.audit_trail.length === 0 ? (
                        <Typography variant="caption" sx={{ color: "#9CA3AF" }}>No audit entries yet.</Typography>
                      ) : (
                        [...activeClient.audit_trail].reverse().map((entry, i) => (
                          <Box key={i} sx={{ display: "flex", gap: 1.5, mb: 1 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#395B45", mt: 0.7, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.5 }}>
                              {entry}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Box>
                  </Collapse>
                </Box>

              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeDialog} sx={{ color: "#6B7280", textTransform: "none" }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── Delete client confirm dialog ─────────────────────────────────── */}
      <Dialog open={Boolean(deleteId)} onClose={() => !deleting && setDeleteId(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Client?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently delete the client record and all attachments. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteId(null)} disabled={deleting} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, fontWeight: 600, textTransform: "none" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete attachment confirm dialog ─────────────────────────────── */}
      <Dialog open={Boolean(attachDeleteTarget)} onClose={() => !attachDeleting && setAttachDeleteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Attachment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Are you sure you want to delete{" "}
            <Box component="span" sx={{ fontWeight: 600, color: "#111827" }}>
              {attachDeleteTarget?.fileName}
            </Box>
            ? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setAttachDeleteTarget(null)} disabled={attachDeleting} sx={{ color: "#6B7280", textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={confirmAttachmentDelete}
            disabled={attachDeleting}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, fontWeight: 600, textTransform: "none" }}
          >
            {attachDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
