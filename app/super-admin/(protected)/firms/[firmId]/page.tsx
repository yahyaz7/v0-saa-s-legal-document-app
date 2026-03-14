"use client";

import { use, useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Skeleton,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ArrowLeft,
  UserPlus,
  Users,
  Building2,
  Shield,
  User,
  CheckCircle,
  XCircle,
  Trash2,
  Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Firm = { id: string; name: string; slug: string; created_at: string };

type FirmUser = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  roles: { name: string } | null;
};

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function FirmDetailPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = use(params);
  const router = useRouter();

  const [firm, setFirm] = useState<Firm | null>(null);
  const [users, setUsers] = useState<FirmUser[]>([]);
  const [loadingFirm, setLoadingFirm] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // ── Add Admin dialog ─────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Delete user dialog ───────────────────────────────────────
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState("");

  // ── Edit firm dialog ─────────────────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Delete firm dialog ───────────────────────────────────────
  const [deleteFirmOpen, setDeleteFirmOpen] = useState(false);
  const [deletingFirm, setDeletingFirm] = useState(false);
  const [deleteFirmError, setDeleteFirmError] = useState("");
  const [confirmFirmName, setConfirmFirmName] = useState("");

  // ── Banners ──────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState("");

  const loadFirm = useCallback(async () => {
    setLoadingFirm(true);
    const token = await getToken();
    if (!token) { setLoadingFirm(false); return; }

    const res = await fetch("/api/super-admin/firms", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { data: all }: { data: Firm[] } = await res.json();
      setFirm(all.find((f) => f.id === firmId) ?? null);
    }
    setLoadingFirm(false);
  }, [firmId]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const token = await getToken();
    if (!token) { setLoadingUsers(false); return; }

    const res = await fetch(`/api/super-admin/users?firmId=${firmId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUsers(((await res.json()).data ?? []) as FirmUser[]);
    setLoadingUsers(false);
  }, [firmId]);

  useEffect(() => {
    loadFirm();
    loadUsers();
  }, [loadFirm, loadUsers]);

  // ── Handlers ─────────────────────────────────────────────────

  function openAddDialog() {
    setNewEmail(""); setNewPassword(""); setNewFullName(""); setCreateError("");
    setAddDialogOpen(true);
  }

  function openEditDialog() {
    setEditName(firm?.name ?? "");
    setEditSlug(firm?.slug ?? "");
    setEditError("");
    setEditDialogOpen(true);
  }

  async function handleCreateAdmin() {
    if (!newEmail || !newPassword) { setCreateError("Email and password are required."); return; }
    setCreating(true); setCreateError("");

    const token = await getToken();
    const res = await fetch("/api/super-admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: newEmail, password: newPassword, fullName: newFullName, firmId }),
    });

    const json = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(json.error || "Failed to create admin."); return; }

    setSuccessMsg(`Admin ${json.data.email} created for ${firm?.name}.`);
    setAddDialogOpen(false);
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setDeletingUser(true); setDeleteUserError("");

    const token = await getToken();
    const res = await fetch(`/api/super-admin/users?userId=${deleteUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    setDeletingUser(false);
    if (!res.ok) { setDeleteUserError(json.error || "Failed to delete user."); return; }

    setDeleteUserId(null);
    setSuccessMsg("User removed successfully.");
    loadUsers();
  }

  async function handleEditFirm() {
    if (!editName.trim() || !editSlug.trim()) { setEditError("Name and slug are required."); return; }
    setEditSaving(true); setEditError("");

    const token = await getToken();
    const res = await fetch(`/api/super-admin/firms?firmId=${firmId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: editName.trim(), slug: editSlug.trim() }),
    });

    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) { setEditError(json.error || "Failed to update firm."); return; }

    setEditDialogOpen(false);
    setSuccessMsg("Firm updated successfully.");
    loadFirm();
  }

  async function handleDeleteFirm() {
    if (confirmFirmName !== firm?.name) { setDeleteFirmError("Firm name does not match."); return; }
    setDeletingFirm(true); setDeleteFirmError("");

    const token = await getToken();
    const res = await fetch(`/api/super-admin/firms?firmId=${firmId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    setDeletingFirm(false);
    if (!res.ok) { setDeleteFirmError(json.error || "Failed to delete firm."); return; }

    router.push("/super-admin");
  }

  const roleColor: Record<string, string> = { admin: "#6366F1", staff: "#16A34A" };
  const roleBg: Record<string, string> = { admin: "#EEF2FF", staff: "#F0FDF4" };

  return (
    <Box>
      {/* ── Header ───────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => router.push("/super-admin")} size="small">
            <ArrowLeft size={18} />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#F0FDF4", p: 1, borderRadius: 1.5 }}>
              <Building2 size={18} color="#395B45" />
            </Box>
            {loadingFirm ? (
              <Skeleton width={200} height={28} />
            ) : (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                  {firm?.name}
                </Typography>
                <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                  {firm?.slug}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Firm actions */}
        {!loadingFirm && firm && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Edit firm details">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Pencil size={14} />}
                onClick={openEditDialog}
                sx={{ borderColor: "#D1D5DB", color: "#374151", textTransform: "none", fontWeight: 500 }}
              >
                Edit Firm
              </Button>
            </Tooltip>
            <Tooltip title="Permanently delete this firm">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Trash2 size={14} />}
                onClick={() => { setConfirmFirmName(""); setDeleteFirmError(""); setDeleteFirmOpen(true); }}
                sx={{ borderColor: "#FECACA", color: "#DC2626", textTransform: "none", fontWeight: 500,
                  "&:hover": { bgcolor: "rgba(220,38,38,0.04)", borderColor: "#DC2626" } }}
              >
                Delete Firm
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* ── Banner ───────────────────────────────────────────── */}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg("")}>
          {successMsg}
        </Alert>
      )}

      {/* ── Users table ──────────────────────────────────────── */}
      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Users size={18} color="#374151" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
                Firm Admins
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<UserPlus size={15} />}
              onClick={openAddDialog}
              sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600 }}
            >
              Add Admin
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {loadingUsers ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
              ))}
            </Box>
          ) : users.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Shield size={36} color="#D1D5DB" style={{ marginBottom: 8 }} />
              <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                No admins yet. Add an admin to get this firm started.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#374151" }}>Joined</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const roleName = u.roles?.name ?? "admin";
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ color: "#111827", fontWeight: 500 }}>{u.name}</TableCell>
                      <TableCell sx={{ color: "#6B7280" }}>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={roleName}
                          size="small"
                          icon={roleName === "admin" ? <Shield size={12} /> : <User size={12} />}
                          sx={{
                            bgcolor: roleBg[roleName] ?? "#F3F4F6",
                            color: roleColor[roleName] ?? "#374151",
                            fontWeight: 600,
                            fontSize: "0.7rem",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={u.is_active ? "Active" : "Inactive"}>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            {u.is_active
                              ? <CheckCircle size={16} color="#16A34A" />
                              : <XCircle size={16} color="#DC2626" />}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ color: "#9CA3AF", fontSize: "0.8rem" }}>
                        {new Date(u.created_at).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove user">
                          <IconButton
                            size="small"
                            onClick={() => { setDeleteUserError(""); setDeleteUserId(u.id); }}
                            sx={{ color: "#9CA3AF", "&:hover": { color: "#DC2626" } }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add Admin Dialog ─────────────────────────────────── */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>Add Admin to {firm?.name}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField label="Full Name" fullWidth value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="e.g. Sarah Johnson" autoFocus />
            <TextField label="Email Address" type="email" fullWidth value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="sarah@firmname.co.uk" />
            <TextField label="Temporary Password" type="password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} helperText="At least 8 characters." />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAddDialogOpen(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAdmin} disabled={creating || !newEmail || !newPassword}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none" }}>
            {creating ? "Creating…" : "Create Admin"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove User Dialog ───────────────────────────────── */}
      <Dialog open={Boolean(deleteUserId)} onClose={() => setDeleteUserId(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>Remove User</DialogTitle>
        <DialogContent>
          {deleteUserError && <Alert severity="error" sx={{ mb: 2 }}>{deleteUserError}</Alert>}
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently delete the user from both the firm and the authentication system. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteUserId(null)} disabled={deletingUser}>Cancel</Button>
          <Button variant="contained" onClick={handleDeleteUser} disabled={deletingUser}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, textTransform: "none" }}>
            {deletingUser ? "Removing…" : "Remove User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Firm Dialog ─────────────────────────────────── */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
          <Pencil size={18} color="#395B45" /> Edit Firm
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Firm Name"
              fullWidth
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              helperText="The full legal name of the firm"
            />
            <TextField
              label="URL Slug"
              fullWidth
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              helperText="Unique identifier used in URLs"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleEditFirm} disabled={editSaving || !editName.trim() || !editSlug.trim()}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, textTransform: "none", fontWeight: 600 }}>
            {editSaving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Firm Dialog ───────────────────────────────── */}
      <Dialog open={deleteFirmOpen} onClose={() => setDeleteFirmOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600, color: "#DC2626", display: "flex", alignItems: "center", gap: 1 }}>
          <Trash2 size={18} /> Delete Firm
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          {deleteFirmError && <Alert severity="error" sx={{ mb: 2 }}>{deleteFirmError}</Alert>}
          <Alert severity="warning" sx={{ mb: 2.5 }}>
            This will permanently delete <strong>{firm?.name}</strong> and <strong>all its users</strong>. This cannot be undone.
          </Alert>
          <TextField
            fullWidth
            label={`Type "${firm?.name}" to confirm`}
            value={confirmFirmName}
            onChange={(e) => setConfirmFirmName(e.target.value)}
            size="small"
            error={confirmFirmName.length > 0 && confirmFirmName !== firm?.name}
            helperText={confirmFirmName.length > 0 && confirmFirmName !== firm?.name ? "Name does not match" : ""}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteFirmOpen(false)} disabled={deletingFirm}>Cancel</Button>
          <Button variant="contained" onClick={handleDeleteFirm} disabled={deletingFirm || confirmFirmName !== firm?.name}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, textTransform: "none", fontWeight: 600 }}>
            {deletingFirm ? "Deleting…" : "Delete Firm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
