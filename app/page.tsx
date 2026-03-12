"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Plus, FileEdit } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface DraftRow {
  id: string;
  template_id: string;
  form_data: Record<string, unknown>;
  updated_at: string;
  // Supabase returns the related row as a single object for many-to-one joins,
  // but the inferred SDK type may show it as an array — handle both.
  templates: { name: string } | { name: string }[] | null;
}

export default function Dashboard() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("saved_form_drafts")
      .select("id, template_id, form_data, updated_at, templates(name)")
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data, error }: { data: any, error: any }) => {
        if (!error && data) {
          setDrafts(data as unknown as DraftRow[]);
        }
        setLoading(false);
      });
  }, []);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          Welcome back. Here&apos;s an overview of your recent activity.
        </Typography>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <Button
          component={Link}
          href="/templates"
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          sx={{ px: 3, py: 1.25 }}
        >
          New Document
        </Button>
      </Box>

      {/* Recent Drafts Table */}
      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ p: 3, borderBottom: "1px solid #E0E0E0" }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Drafts
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Last Updated</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drafts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      sx={{ textAlign: "center", py: 6, color: "#666666" }}
                    >
                      No drafts yet. Click &quot;New Document&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  drafts.map((draft) => {
                    const client = (draft.form_data.client as string) || "—";
                    const tmpl = draft.templates;
                    const templateName = Array.isArray(tmpl)
                      ? (tmpl[0]?.name ?? "Unknown Template")
                      : (tmpl?.name ?? "Unknown Template");
                    return (
                      <TableRow
                        key={draft.id}
                        sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>{client}</TableCell>
                        <TableCell>{templateName}</TableCell>
                        <TableCell>
                          {new Date(draft.updated_at).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label="Draft"
                            color="warning"
                            size="small"
                            sx={{ fontWeight: 500, fontSize: 12 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            component={Link}
                            href={`/new-document?template=${draft.template_id}&draft=${draft.id}`}
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<FileEdit size={14} />}
                            sx={{ fontSize: 13 }}
                          >
                            Open Draft
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
