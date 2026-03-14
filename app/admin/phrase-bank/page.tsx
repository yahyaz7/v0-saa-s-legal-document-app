"use client";

import { Box, Typography, Card } from "@mui/material";
import { BookOpen } from "lucide-react";

export default function AdminPhraseBankPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
          Phrase Bank
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
          Manage reusable legal phrases your staff can insert into documents
        </Typography>
      </Box>

      <Card
        elevation={0}
        sx={{ border: "1px dashed #D1D5DB", borderRadius: 2, p: 6, textAlign: "center" }}
      >
        <Box sx={{ bgcolor: "#F0FDF4", p: 2, borderRadius: "50%", display: "inline-flex", mb: 2 }}>
          <BookOpen size={32} color="#395B45" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, color: "#111827", mb: 1 }}>
          Phrase Bank Management
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", maxWidth: 440, mx: "auto" }}>
          Organise commonly used legal phrases into categories such as Offence Description,
          Police Interview Notes, Client Instructions, and Court Outcome. Staff can insert
          these directly into document fields while filling forms.
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
