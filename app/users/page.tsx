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
  Tooltip,
} from "@mui/material";
import { UserPlus, Users, User, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  roles: { name: string } | null;
};

export default function UsersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const role = session?.user?.app_metadata?.role;

    if (!token || role !== "admin") {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) setStaff(await res.json());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  function resetDialog() {
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setCreateError("");
  }

  async function handleCreateStaff() {
    if (!newEmail || !newPassword) {
      setCreateError("Email and password are required.");
      return;
    }
    setCreating(true);
    setCreateError("");

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        fullName: newFullName,
        // firmId is intentionally omitted — API derives it from the admin's JWT
      }),
    });

    const json = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateError(json.error || "Failed to create staff member.");
      return;
    }

    setCreateSuccess(`${json.email} added as staff.`);
    resetDialog();
    setDialogOpen(false);
    loadStaff();
  }

  if (accessDenied) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" sx={{ color: "#DC2626", mb: 1 }}>Access Denied</Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 3 }}>
          Only firm admins can manage team members.
        </Typography>
        <Button variant="outlined" onClick={() => router.push("/")}>Back to Dashboard</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Team Members
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage staff users for your firm
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

      {createSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setCreateSuccess("")}>
          {createSuccess}
        </Alert>
      )}

      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Users size={18} color="#374151" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
              Staff
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
              ))}
            </Box>
          ) : staff.length === 0 ? (
            <Box sx={{ py: 5, textAlign: "center" }}>
              <User size={38} color="#D1D5DB" style={{ marginBottom: 10 }} />
              <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 2 }}>
                No staff yet. Add your first team member.
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<UserPlus size={15} />}
                onClick={() => { resetDialog(); setDialogOpen(true); }}
                sx={{ bgcolor: "#395B45" }}
              >
                Add Staff
              </Button>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map((u) => {
                  const roleName = u.roles?.name ?? "staff";
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ color: "#111827", fontWeight: 500 }}>{u.name}</TableCell>
                      <TableCell sx={{ color: "#6B7280" }}>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={roleName}
                          size="small"
                          sx={{ bgcolor: "#F0FDF4", color: "#16A34A", fontWeight: 600, fontSize: "0.7rem" }}
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Staff Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add Staff Member</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Full Name"
              fullWidth
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="e.g. James Carter"
              autoFocus
            />
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="james@yourfirm.co.uk"
            />
            <TextField
              label="Temporary Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="At least 8 characters. They should change this on first login."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateStaff}
            disabled={creating || !newEmail || !newPassword}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
          >
            {creating ? "Creating…" : "Add Staff Member"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
