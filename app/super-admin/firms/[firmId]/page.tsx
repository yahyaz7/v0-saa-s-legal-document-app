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

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Banner messages
  const [successMsg, setSuccessMsg] = useState("");

  const loadFirm = useCallback(async () => {
    setLoadingFirm(true);
    const token = await getToken();
    if (!token) { setLoadingFirm(false); return; }

    // Fetch from the firms API to stay consistent and bypass RLS concerns
    const res = await fetch("/api/super-admin/firms", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const all: Firm[] = await res.json();
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
    if (res.ok) setUsers((await res.json()) as FirmUser[]);
    setLoadingUsers(false);
  }, [firmId]);

  useEffect(() => {
    loadFirm();
    loadUsers();
  }, [loadFirm, loadUsers]);

  function resetDialog() {
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setCreateError("");
  }

  async function handleCreateAdmin() {
    if (!newEmail || !newPassword) {
      setCreateError("Email and password are required.");
      return;
    }
    setCreating(true);
    setCreateError("");

    const token = await getToken();
    const res = await fetch("/api/super-admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: newEmail, password: newPassword, fullName: newFullName, firmId }),
    });

    const json = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateError(json.error || "Failed to create admin.");
      return;
    }

    setSuccessMsg(`Admin ${json.email} created for ${firm?.name}.`);
    resetDialog();
    setDialogOpen(false);
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setDeleting(true);
    setDeleteError("");

    const token = await getToken();
    const res = await fetch(`/api/super-admin/users?userId=${deleteUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setDeleteError(json.error || "Failed to delete user.");
      return;
    }

    setDeleteUserId(null);
    setSuccessMsg("User removed successfully.");
    loadUsers();
  }

  const roleColor: Record<string, string> = { admin: "#6366F1", staff: "#16A34A" };
  const roleBg: Record<string, string> = { admin: "#EEF2FF", staff: "#F0FDF4" };

  return (
    <Box>
      {/* Back + Firm header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
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

      {/* Banners */}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg("")}>
          {successMsg}
        </Alert>
      )}

      {/* Users table */}
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
              onClick={() => { resetDialog(); setDialogOpen(true); }}
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
                            onClick={() => { setDeleteError(""); setDeleteUserId(u.id); }}
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

      {/* Create Admin Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add Admin to {firm?.name}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Full Name"
              fullWidth
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              autoFocus
            />
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="sarah@firmname.co.uk"
            />
            <TextField
              label="Temporary Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="At least 8 characters. The admin should change this on first login."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateAdmin}
            disabled={creating || !newEmail || !newPassword}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
          >
            {creating ? "Creating…" : "Create Admin"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteUserId)} onClose={() => setDeleteUserId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Remove User</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently delete the user from both the firm and the authentication system.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteUserId(null)} disabled={deleting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteUser}
            disabled={deleting}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" } }}
          >
            {deleting ? "Removing…" : "Remove User"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
