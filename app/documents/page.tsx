"use client";

import { useState } from "react";
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
  Chip,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
} from "@mui/material";
import { Search, Download, MoreVertical, Eye, Edit2, Trash2, Filter } from "lucide-react";
import { useAppContext } from "@/lib/app-context";

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

export default function DocumentsPage() {
  const { documents } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, docId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedDoc(docId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDoc(null);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Documents
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          View and manage all your generated documents.
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search documents..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: 280 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="#666666" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="Draft">Draft</MenuItem>
              <MenuItem value="Complete">Complete</MenuItem>
              <MenuItem value="Pending Review">Pending Review</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Documents Table */}
      <Paper sx={{ overflow: "hidden" }}>
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
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="body2" sx={{ color: "#666666" }}>
                      No documents found matching your criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}>
                    <TableCell sx={{ fontWeight: 500 }}>{doc.name}</TableCell>
                    <TableCell>{doc.client}</TableCell>
                    <TableCell>{doc.template}</TableCell>
                    <TableCell>{new Date(doc.date).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <Chip
                        label={doc.status}
                        color={getStatusColor(doc.status)}
                        size="small"
                        sx={{ fontWeight: 500, fontSize: 12 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<Download size={14} />}
                        sx={{ mr: 1, fontSize: 13 }}
                      >
                        Download
                      </Button>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, doc.id)}
                        sx={{ color: "#666666" }}
                      >
                        <MoreVertical size={18} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleMenuClose}>
          <Eye size={16} style={{ marginRight: 12 }} />
          View
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Edit2 size={16} style={{ marginRight: 12 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: "#D32F2F" }}>
          <Trash2 size={16} style={{ marginRight: 12 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
