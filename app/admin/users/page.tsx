"use client";

import { useEffect, useState, useCallback } from "react";
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
import { UserPlus, Users, User, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type StaffUser = {
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [successMsg, setSuccessMsg] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUsers(((await res.json()).data ?? []) as StaffUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function resetDialog() {
    setNewEmail(""); setNewPassword(""); setNewFullName(""); setCreateError("");
  }

  async function handleCreateUser() {
    if (!newEmail || !newPassword) { setCreateError("Email and password are required."); return; }
    setCreating(true);
    setCreateError("");

    const token = await getToken();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: newEmail, password: newPassword, fullName: newFullName }),
    });

    const json = await res.json();
    setCreating(false);

    if (!res.ok) { setCreateError(json.error || "Failed to create user."); return; }

    setSuccessMsg(`${json.data.email} added to your team.`);
    resetDialog();
    setDialogOpen(false);
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setDeleting(true);
    setDeleteError("");

    const token = await getToken();
    const res = await fetch(`/api/admin/users?userId=${deleteUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    setDeleting(false);

    if (!res.ok) { setDeleteError(json.error || "Failed to remove user."); return; }

    setDeleteUserId(null);
    setSuccessMsg("Team member removed.");
    loadUsers();
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>Team</Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage staff members in your firm
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserPlus size={16} />}
          onClick={() => { resetDialog(); setDialogOpen(true); }}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600 }}
        >
          Add Staff
        </Button>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>
      )}

      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Users size={18} color="#374151" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
              Staff Members
            </Typography>
            <Chip label={users.length} size="small" sx={{ bgcolor: "#F3F4F6", color: "#374151", fontSize: "0.75rem" }} />
          </Box>

          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />)}
            </Box>
          ) : users.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <User size={36} color="#D1D5DB" style={{ marginBottom: 8 }} />
              <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                No staff members yet. Add someone to get started.
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
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 500, color: "#111827" }}>{u.name}</TableCell>
                    <TableCell sx={{ color: "#6B7280" }}>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.roles?.name ?? "staff"}
                        size="small"
                        sx={{ bgcolor: "#F0FDF4", color: "#16A34A", fontWeight: 600, fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={u.is_active ? "Active" : "Inactive"}>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          {u.is_active ? <CheckCircle size={16} color="#16A34A" /> : <XCircle size={16} color="#DC2626" />}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ color: "#9CA3AF", fontSize: "0.8rem" }}>
                      {new Date(u.created_at).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove staff member">
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add Staff Member</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField label="Full Name" fullWidth value={newFullName} onChange={(e) => setNewFullName(e.target.value)} autoFocus />
            <TextField label="Email Address" type="email" fullWidth value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <TextField
              label="Temporary Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="At least 8 characters. Ask them to change it on first login."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={creating || !newEmail || !newPassword}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
          >
            {creating ? "Adding…" : "Add Staff"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteUserId)} onClose={() => setDeleteUserId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Remove Staff Member</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography variant="body2" sx={{ color: "#374151" }}>
            This will permanently remove the staff member from your firm and revoke their access. This cannot be undone.
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
            {deleting ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
