"use client";

import { Box, Typography, Card, CardContent, Button } from "@mui/material";
import { FileText, Plus } from "lucide-react";

export default function AdminTemplatesPage() {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
            Templates
          </Typography>
          <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
            Create and manage document templates for your firm
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          disabled
          sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" }, fontWeight: 600 }}
        >
          New Template
        </Button>
      </Box>

      <Card
        elevation={0}
        sx={{ border: "1px dashed #D1D5DB", borderRadius: 2, p: 6, textAlign: "center" }}
      >
        <Box sx={{ bgcolor: "#F0FDF4", p: 2, borderRadius: "50%", display: "inline-flex", mb: 2 }}>
          <FileText size={32} color="#395B45" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, color: "#111827", mb: 1 }}>
          Template Management
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", maxWidth: 400, mx: "auto" }}>
          Build and manage document templates with dynamic fields. Staff will use these
          to generate documents such as Magistrates Attendance Notes, Client Care Letters, and more.
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "inline-block",
            mt: 3,
            px: 2,
            py: 0.75,
            bgcolor: "#FEF3C7",
            color: "#92400E",
            borderRadius: 2,
            fontWeight: 500,
          }}
        >
          Coming in next phase
        </Typography>
      </Card>
    </Box>
  );
}
