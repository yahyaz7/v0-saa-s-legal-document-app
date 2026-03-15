"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { Building2, Users, Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Firm = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  userCount: number;
};

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function SuperAdminOverview() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firmSlug, setFirmSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const router = useRouter();

  const loadFirms = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const res = await fetch("/api/super-admin/firms", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) setFirms(((await res.json()).data ?? []) as Firm[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadFirms(); }, [loadFirms]);

  function handleNameChange(value: string) {
    setFirmName(value);
    setFirmSlug(
      value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    );
  }

  async function handleCreateFirm() {
    if (!firmName.trim() || !firmSlug.trim()) {
      setCreateError("Both name and slug are required.");
      return;
    }
    setCreating(true);
    setCreateError("");

    const token = await getToken();
    const res = await fetch("/api/super-admin/firms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: firmName.trim(), slug: firmSlug.trim() }),
    });

    const json = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateError(json.error || "Failed to create firm.");
      return;
    }

    setDialogOpen(false);
    setFirmName("");
    setFirmSlug("");
    router.push(`/super-admin/firms/${json.data.id}`);
  }

  const totalUsers = firms.reduce((sum, f) => sum + f.userCount, 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Platform Overview
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Manage law firms and their administrators
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setDialogOpen(true)}
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600 }}
        >
          New Firm
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        {[
          { label: "Total Firms", value: firms.length, icon: <Building2 size={22} color="#6366F1" />, bg: "#EEF2FF" },
          { label: "Total Users", value: totalUsers, icon: <Users size={22} color="#16A34A" />, bg: "#F0FDF4" },
        ].map((stat) => (
          <Card key={stat.label} elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "0 1 240px" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ bgcolor: stat.bg, p: 1.5, borderRadius: 1.5 }}>{stat.icon}</Box>
                <Box>
                  {loading ? (
                    <Skeleton width={40} height={36} />
                  ) : (
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
                      {stat.value}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ color: "#6B7280" }}>{stat.label}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Firms list */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: "#374151" }}>
        All Firms
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : firms.length === 0 ? (
        <Card elevation={0} sx={{ border: "1px dashed #D1D5DB", borderRadius: 2, p: 5, textAlign: "center" }}>
          <Building2 size={40} color="#9CA3AF" style={{ marginBottom: 12 }} />
          <Typography sx={{ color: "#6B7280", mb: 2 }}>
            No firms yet. Create the first firm to get started.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: "#395B45" }}
          >
            Create First Firm
          </Button>
        </Card>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {firms.map((firm) => (
            <Card
              key={firm.id}
              elevation={0}
              onClick={() => router.push(`/super-admin/firms/${firm.id}`)}
              sx={{
                border: "1px solid #E5E7EB",
                borderRadius: 2,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                "&:hover": { borderColor: "#395B45", bgcolor: "#F0FFF4" },
              }}
            >
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: "14px !important" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ bgcolor: "#F0FDF4", p: 1.25, borderRadius: 1.5 }}>
                    <Building2 size={18} color="#395B45" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#111827" }}>
                      {firm.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                      {firm.slug}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Chip
                    label={`${firm.userCount} user${firm.userCount !== 1 ? "s" : ""}`}
                    size="small"
                    sx={{ bgcolor: "#F3F4F6", color: "#374151", fontSize: "0.75rem" }}
                  />
                  <ArrowRight size={16} color="#9CA3AF" />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create Firm Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Firm</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Firm Name"
              fullWidth
              value={firmName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Smith & Partners Solicitors"
              helperText="The full legal name of the firm"
              autoFocus
            />
            <TextField
              label="URL Slug"
              fullWidth
              value={firmSlug}
              onChange={(e) => setFirmSlug(e.target.value)}
              placeholder="e.g. smith-partners"
              helperText="Unique identifier — auto-generated, but editable"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => { setDialogOpen(false); setCreateError(""); setFirmName(""); setFirmSlug(""); }}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFirm}
            disabled={creating || !firmName.trim() || !firmSlug.trim()}
            sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
          >
            {creating ? "Creating…" : "Create Firm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
