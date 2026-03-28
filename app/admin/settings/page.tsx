"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
} from "@mui/material";
import { Building2, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Firm = { id: string; name: string; slug: string; created_at: string };

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadFirm = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const res = await fetch("/api/admin/firm", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (res.ok) {
      setFirm(json.data);
      setEditName(json.data.name ?? "");
      setEditSlug(json.data.slug ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFirm(); }, [loadFirm]);

  async function handleSave() {
    if (!editName.trim() || !editSlug.trim()) { setSaveError("Name and slug are required."); return; }
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    const token = await getToken();
    const res = await fetch("/api/admin/firm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: editName.trim(), slug: editSlug.trim() }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) { setSaveError(json.error || "Failed to save."); return; }
    setFirm(json.data);
    setSaveSuccess("Firm settings updated successfully.");
  }

  async function handleDeleteFirm() {
    if (deleteConfirm !== firm?.name) { setDeleteError(`Type the firm name exactly: "${firm?.name}"`); return; }
    setDeleting(true);
    setDeleteError("");

    const token = await getToken();
    const res = await fetch("/api/admin/firm", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    setDeleting(false);

    if (!res.ok) { setDeleteError(json.error || "Failed to delete firm."); return; }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>Firm Settings</Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
          Update your firm's details or delete the firm
        </Typography>
      </Box>

      {/* Firm info form */}
      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box sx={{ bgcolor: "#F0FDF4", p: 1, borderRadius: 1.5 }}>
              <Building2 size={18} color="#395B45" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
              General
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {saveSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess("")}>{saveSuccess}</Alert>}
          {saveError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError("")}>{saveError}</Alert>}

          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <TextField
                label="Firm Name"
                fullWidth
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                helperText="The full legal name of your firm"
              />
              <TextField
                label="URL Slug"
                fullWidth
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                helperText="Unique identifier used in URLs"
              />
              <Box>
                <Button
                  variant="contained"
                  startIcon={<Save size={16} />}
                  onClick={handleSave}
                  disabled={saving || !editName.trim() || !editSlug.trim()}
                  sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card elevation={0} sx={{ border: "1px solid #FCA5A5", borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#DC2626", mb: 1 }}>
            Danger Zone
          </Typography>
          <Divider sx={{ mb: 2, borderColor: "#FCA5A5" }} />
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "#374151" }}>
                Delete this firm
              </Typography>
              <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                Permanently deletes the firm and all associated users. This cannot be undone.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Trash2 size={15} />}
              onClick={() => { setDeleteConfirm(""); setDeleteError(""); setDeleteDialogOpen(true); }}
              sx={{ flexShrink: 0, borderColor: "#DC2626", color: "#DC2626", "&:hover": { bgcolor: "#FEF2F2" } }}
            >
              Delete Firm
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: "#DC2626" }}>Delete Firm</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography variant="body2" sx={{ color: "#374151", mb: 2 }}>
            This will permanently delete <strong>{firm?.name}</strong>, all its staff accounts, and all associated data.
            This action <strong>cannot be undone</strong>.
          </Typography>
          <TextField
            label={`Type "${firm?.name}" to confirm`}
            fullWidth
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteFirm}
            disabled={deleting || deleteConfirm !== firm?.name}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" } }}
          >
            {deleting ? "Deleting…" : "Permanently Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
