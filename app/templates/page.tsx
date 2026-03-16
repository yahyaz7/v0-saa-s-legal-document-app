"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Template {
  id: string;
  name: string;
  description: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    console.log("[v0] Fetching templates from Supabase...");
    supabase
      .from("templates")
      .select("id, name, description")
      .order("name")
      .then(({ data, error }: { data: any, error: any }) => {
        console.log("[v0] Templates response:", { data, error });
        if (error) {
          console.error("[v0] Templates error:", error);
          setError(`Failed to load templates: ${error.message}`);
        } else {
          setTemplates(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
            Templates
          </Typography>
          <Typography variant="body1" sx={{ color: "#666666" }}>
            Select a template to create a new document.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/templates/manage"
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
        >
          Add Template
        </Button>
      </Box>

      {/* States */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Template Grid */}
      {!loading && !error && (
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "box-shadow 0.2s ease",
                  "&:hover": {
                    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        backgroundColor: "rgba(57, 91, 69, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={20} color="#395B45" />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16, mb: 0.5 }}>
                        {template.name}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: "#666666", lineHeight: 1.6 }}>
                    {template.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 1 }}>
                  <Button
                    component={Link}
                    href={`/new-document?template=${template.id}`}
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ py: 1 }}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}

          {templates.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ color: "#666666", textAlign: "center", py: 6 }}>
                No templates found. Add one to get started.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
