"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Alert,
  Chip,
} from "@mui/material";
import { BarChart2, FileDown, Users, FileText } from "lucide-react";

interface UserStat {
  user_id: string;
  email: string;
  full_name: string;
  count: number;
}

interface TemplateStat {
  template_id: string;
  name: string;
  count: number;
}

interface Analytics {
  total: number;
  active_users: number;
  by_user: UserStat[];
  by_template: TemplateStat[];
}

function StatCard({ label, value, icon, color }: { label: string; value: number | null; icon: React.ReactNode; color: string }) {
  return (
    <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, p: 2.5, flex: "0 1 200px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ bgcolor: color, p: 1.5, borderRadius: 1.5, display: "flex" }}>{icon}</Box>
        <Box>
          {value === null ? (
            <Skeleton width={48} height={32} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
          )}
          <Typography variant="caption" sx={{ color: "#6B7280" }}>{label}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setAnalytics(json.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeUsers = analytics?.active_users ?? null;
  const uniqueTemplates = analytics?.by_template.length ?? null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <BarChart2 size={22} color="#395B45" />
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Document Analytics
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "#6B7280" }}>
          Track how many documents have been generated across your firm.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Stat cards */}
      <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
        <StatCard
          label="Total Generated"
          value={loading ? null : (analytics?.total ?? 0)}
          icon={<FileDown size={20} color="#395B45" />}
          color="rgba(57,91,69,0.1)"
        />
        <StatCard
          label="Active Users"
          value={loading ? null : activeUsers ?? 0}
          icon={<Users size={20} color="#6366F1" />}
          color="#EEF2FF"
        />
        <StatCard
          label="Templates Used"
          value={loading ? null : uniqueTemplates ?? 0}
          icon={<FileText size={20} color="#F59E0B" />}
          color="#FFFBEB"
        />
      </Box>

      {/* Two-column tables */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Per-user table */}
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: "#111827" }}>
            By User
          </Typography>
          <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#F9FAFB" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>User</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Documents</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton width="60%" /></TableCell>
                        <TableCell><Skeleton width={40} sx={{ ml: "auto" }} /></TableCell>
                      </TableRow>
                    ))
                  ) : (analytics?.by_user.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#9CA3AF", py: 4 }}>
                        No documents generated yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    analytics!.by_user.map((row) => (
                      <TableRow key={row.user_id} hover>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827" }}>
                            {row.full_name || row.email.split("@")[0]}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                            {row.email}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={row.count}
                            size="small"
                            sx={{ bgcolor: "rgba(57,91,69,0.1)", color: "#395B45", fontWeight: 700, minWidth: 36 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* Per-template table */}
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: "#111827" }}>
            By Template
          </Typography>
          <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden" }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#F9FAFB" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Template</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Documents</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton width="70%" /></TableCell>
                        <TableCell><Skeleton width={40} sx={{ ml: "auto" }} /></TableCell>
                      </TableRow>
                    ))
                  ) : (analytics?.by_template.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#9CA3AF", py: 4 }}>
                        No documents generated yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    analytics!.by_template.map((row) => (
                      <TableRow key={row.template_id} hover>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827" }}>
                            {row.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={row.count}
                            size="small"
                            sx={{ bgcolor: "#EEF2FF", color: "#6366F1", fontWeight: 700, minWidth: 36 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
