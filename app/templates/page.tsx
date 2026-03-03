"use client";

import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
} from "@mui/material";
import { FileText } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import Link from "next/link";

export default function TemplatesPage() {
  const { templates } = useAppContext();

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Templates
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          Select a template to create a new document.
        </Typography>
      </Box>

      {/* Template Grid */}
      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={template.id}>
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
                    <Chip
                      label={template.category}
                      size="small"
                      sx={{
                        backgroundColor: "#F5F5F5",
                        color: "#666666",
                        fontSize: 11,
                        height: 22,
                      }}
                    />
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
      </Grid>
    </Box>
  );
}
