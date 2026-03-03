"use client";

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
} from "@mui/material";
import { Plus, Upload, Download } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import Link from "next/link";

function getStatusColor(status: string): "success" | "warning" | "default" {
  switch (status) {
    case "Complete":
      return "success";
    case "Pending Review":
      return "warning";
    default:
      return "default";
  }
}

export default function Dashboard() {
  const { documents } = useAppContext();

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
          href="/new-document"
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          sx={{ px: 3, py: 1.25 }}
        >
          Create New Document
        </Button>
        <Button
          component={Link}
          href="/clients"
          variant="outlined"
          color="primary"
          startIcon={<Upload size={18} />}
          sx={{ px: 3, py: 1.25 }}
        >
          Upload Client List
        </Button>
      </Box>

      {/* Recent Documents Table */}
      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ p: 3, borderBottom: "1px solid #E0E0E0" }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Documents
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Document</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Template</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{doc.name}</TableCell>
                  <TableCell>{doc.client}</TableCell>
                  <TableCell>{doc.template}</TableCell>
                  <TableCell>{new Date(doc.date).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <Chip
                      label={doc.status}
                      color={getStatusColor(doc.status)}
                      size="small"
                      sx={{
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<Download size={14} />}
                      sx={{ fontSize: 13 }}
                    >
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
