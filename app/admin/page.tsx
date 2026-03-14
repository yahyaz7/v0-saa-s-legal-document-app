"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Alert,
  Button,
} from "@mui/material";
import { Building2, Users, ArrowRight } from "lucide-react";
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

export default function AdminOverviewPage() {
  const router = useRouter();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFirm = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const res = await fetch("/api/admin/firm", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to load firm details."); setLoading(false); return; }
    setFirm(json.data as Firm);
    setLoading(false);
  }, []);

  useEffect(() => { loadFirm(); }, [loadFirm]);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
          Overview
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
          Manage your firm and team members
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Stat cards */}
      <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
        {[
          {
            label: "Firm Name",
            value: loading ? null : firm?.name ?? "—",
            icon: <Building2 size={22} color="#395B45" />,
            bg: "#F0FDF4",
          },
          {
            label: "Team Members",
            value: loading ? null : firm?.userCount ?? 0,
            icon: <Users size={22} color="#6366F1" />,
            bg: "#EEF2FF",
          },
        ].map((stat) => (
          <Card key={stat.label} elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "0 1 240px" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ bgcolor: stat.bg, p: 1.5, borderRadius: 1.5 }}>{stat.icon}</Box>
                <Box>
                  {stat.value === null ? (
                    <Skeleton width={80} height={28} />
                  ) : (
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
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

      {/* Quick actions */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: "#374151" }}>
        Quick Actions
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {[
          {
            title: "Manage Team",
            description: "Add or remove staff members",
            href: "/admin/users",
            icon: <Users size={18} color="#395B45" />,
          },
          {
            title: "Firm Settings",
            description: "Update firm name, slug, or delete the firm",
            href: "/admin/settings",
            icon: <Building2 size={18} color="#395B45" />,
          },
        ].map((action) => (
          <Card
            key={action.href}
            elevation={0}
            onClick={() => router.push(action.href)}
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
                <Box sx={{ bgcolor: "#F0FDF4", p: 1.25, borderRadius: 1.5 }}>{action.icon}</Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#111827" }}>
                    {action.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                    {action.description}
                  </Typography>
                </Box>
              </Box>
              <ArrowRight size={16} color="#9CA3AF" />
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Firm details */}
      {!loading && firm && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: "#374151" }}>
            Firm Details
          </Typography>
          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {[
                  { label: "Name", value: firm.name },
                  { label: "Slug", value: firm.slug },
                  { label: "Created", value: new Date(firm.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
                ].map((row) => (
                  <Box key={row.label} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="body2" sx={{ color: "#6B7280", minWidth: 80 }}>{row.label}</Typography>
                    <Chip label={row.value} size="small" sx={{ bgcolor: "#F3F4F6", color: "#374151", fontWeight: 500 }} />
                  </Box>
                ))}
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => router.push("/admin/settings")}
                sx={{ mt: 2, borderColor: "#395B45", color: "#395B45", "&:hover": { bgcolor: "#F0FDF4" } }}
              >
                Edit Settings
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
