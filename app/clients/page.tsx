"use client";

import { Box, Typography, Paper, Button } from "@mui/material";
import { Upload, Users } from "lucide-react";

export default function ClientsPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Client List
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          Upload and manage your client database.
        </Typography>
      </Box>

      {/* Upload area — coming soon */}
      <Paper
        sx={{
          p: 6,
          mb: 4,
          border: "2px dashed #E0E0E0",
          backgroundColor: "#FAFAFA",
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            backgroundColor: "rgba(57, 91, 69, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 2,
          }}
        >
          <Upload size={28} color="#395B45" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          CSV Import — Coming Soon
        </Typography>
        <Typography variant="body2" sx={{ color: "#666666", mb: 3 }}>
          Client import from CSV and Excel will be available in a future update.
        </Typography>
        <Button variant="outlined" startIcon={<Upload size={16} />} disabled>
          Select File
        </Button>
      </Paper>

      {/* Empty client list */}
      <Paper sx={{ overflow: "hidden" }}>
        <Box sx={{ p: 3, borderBottom: "1px solid #E0E0E0", display: "flex", alignItems: "center", gap: 2 }}>
          <Users size={20} color="#395B45" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            All Clients
          </Typography>
        </Box>
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Users size={36} color="#D1D5DB" style={{ display: "block", margin: "0 auto 8px" }} />
          <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
            No clients yet. Import a CSV file to get started.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
