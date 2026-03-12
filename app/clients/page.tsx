"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Alert,
  LinearProgress,
} from "@mui/material";
import { Upload, FileSpreadsheet, Check, Users } from "lucide-react";
import { useAppContext } from "@/lib/app-context";

interface UploadedColumn {
  header: string;
  sampleData: string[];
  mappedTo: string;
}

const fieldOptions = [
  { value: "", label: "Do not import" },
  { value: "name", label: "Client Name" },
  { value: "email", label: "Email Address" },
  { value: "company", label: "Company" },
  { value: "caseRef", label: "Case Reference" },
  { value: "phone", label: "Phone Number" },
  { value: "address", label: "Address" },
];

export default function ClientsPage() {
  const { clients, addClient } = useAppContext();
  const [uploadState, setUploadState] = useState<"idle" | "mapping" | "importing" | "complete">("idle");
  const [uploadedColumns, setUploadedColumns] = useState<UploadedColumn[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    // Mock file upload - simulate CSV parsing
    const mockColumns: UploadedColumn[] = [
      { header: "Full Name", sampleData: ["Alice Johnson", "Bob Wilson", "Carol Davis"], mappedTo: "name" },
      { header: "Email", sampleData: ["alice@example.com", "bob@example.com", "carol@example.com"], mappedTo: "email" },
      { header: "Organisation", sampleData: ["Johnson LLC", "Wilson Corp", "Davis Ltd"], mappedTo: "company" },
      { header: "Ref Number", sampleData: ["REF-001", "REF-002", "REF-003"], mappedTo: "caseRef" },
    ];
    setUploadedColumns(mockColumns);
    setUploadState("mapping");
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileSelect = () => {
    // Mock file selection
    const mockColumns: UploadedColumn[] = [
      { header: "Full Name", sampleData: ["Alice Johnson", "Bob Wilson", "Carol Davis"], mappedTo: "name" },
      { header: "Email", sampleData: ["alice@example.com", "bob@example.com", "carol@example.com"], mappedTo: "email" },
      { header: "Organisation", sampleData: ["Johnson LLC", "Wilson Corp", "Davis Ltd"], mappedTo: "company" },
      { header: "Ref Number", sampleData: ["REF-001", "REF-002", "REF-003"], mappedTo: "caseRef" },
    ];
    setUploadedColumns(mockColumns);
    setUploadState("mapping");
  };

  const handleMappingChange = (index: number, value: string) => {
    setUploadedColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, mappedTo: value } : col))
    );
  };

  const handleImport = () => {
    setUploadState("importing");
    
    // Simulate import process
    setTimeout(() => {
      // Add mock clients
      const newClients = [
        { name: "Alice Johnson", email: "alice@example.com", company: "Johnson LLC", caseRef: "REF-001" },
        { name: "Bob Wilson", email: "bob@example.com", company: "Wilson Corp", caseRef: "REF-002" },
        { name: "Carol Davis", email: "carol@example.com", company: "Davis Ltd", caseRef: "REF-003" },
      ];
      newClients.forEach((client) => addClient(client));
      setUploadState("complete");
    }, 1500);
  };

  const handleReset = () => {
    setUploadState("idle");
    setUploadedColumns([]);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Client List
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          Upload and manage your client database.
        </Typography>
      </Box>

      {/* Upload Section */}
      {uploadState === "idle" && (
        <Paper
          sx={{
            p: 6,
            mb: 4,
            border: dragOver ? "2px dashed #395B45" : "2px dashed #E0E0E0",
            backgroundColor: dragOver ? "rgba(57, 91, 69, 0.04)" : "#FAFAFA",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleFileSelect}
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
            Drop your file here
          </Typography>
          <Typography variant="body2" sx={{ color: "#666666", mb: 3 }}>
            or click to browse. Supports CSV and Excel files.
          </Typography>
          <Button variant="outlined" color="primary" startIcon={<FileSpreadsheet size={16} />}>
            Select File
          </Button>
        </Paper>
      )}

      {/* Mapping Section */}
      {uploadState === "mapping" && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Map Columns
          </Typography>
          <Typography variant="body2" sx={{ color: "#666666", mb: 3 }}>
            Match your file columns to the correct fields.
          </Typography>

          <TableContainer sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>File Column</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Sample Data</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Map To Field</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadedColumns.map((col, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 500 }}>{col.header}</TableCell>
                    <TableCell sx={{ color: "#666666" }}>{col.sampleData.slice(0, 2).join(", ")}...</TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                          value={col.mappedTo}
                          onChange={(e) => handleMappingChange(index, e.target.value)}
                        >
                          {fieldOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Import Summary */}
          <Card sx={{ backgroundColor: "#F5F5F5", mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Import Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: "#666666" }}>Total Rows</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>3</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: "#666666" }}>Mapped Fields</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {uploadedColumns.filter((c) => c.mappedTo).length}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" sx={{ color: "#666666" }}>Skipped Fields</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {uploadedColumns.filter((c) => !c.mappedTo).length}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="outlined" onClick={handleReset}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleImport}>
              Import Clients
            </Button>
          </Box>
        </Paper>
      )}

      {/* Importing State */}
      {uploadState === "importing" && (
        <Paper sx={{ p: 4, mb: 4, textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Importing clients...
          </Typography>
          <LinearProgress sx={{ maxWidth: 400, mx: "auto", mb: 2 }} />
          <Typography variant="body2" sx={{ color: "#666666" }}>
            Please wait while we process your data.
          </Typography>
        </Paper>
      )}

      {/* Complete State */}
      {uploadState === "complete" && (
        <Alert
          severity="success"
          sx={{ mb: 4 }}
          action={
            <Button color="inherit" size="small" onClick={handleReset}>
              Upload More
            </Button>
          }
        >
          Successfully imported 3 clients to your database.
        </Alert>
      )}

      {/* Existing Clients Table */}
      <Paper sx={{ overflow: "hidden" }}>
        <Box sx={{ p: 3, borderBottom: "1px solid #E0E0E0", display: "flex", alignItems: "center", gap: 2 }}>
          <Users size={20} color="#395B45" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            All Clients ({clients.length})
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Case Reference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}>
                  <TableCell sx={{ fontWeight: 500 }}>{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.company}</TableCell>
                  <TableCell>{client.caseRef}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
