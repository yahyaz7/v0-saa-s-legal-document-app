"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Card,
  CardContent,
  Grid,
  LinearProgress,
} from "@mui/material";
import { Upload, FileText, ArrowLeft, ArrowRight, Check, X, Plus, Trash2, Edit2, Eye } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/app-context";

interface DetectedPlaceholder {
  id: string;
  placeholder: string;
  mappedField: string;
  fieldType: string;
  preview: string;
}

const fieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Long Text" },
  { value: "client", label: "Client (Auto)" },
  { value: "number", label: "Number" },
];

const steps = ["Upload Template", "Map Fields", "Configure & Save"];

export default function ManageTemplatesPage() {
  const { templates, addTemplate } = useAppContext();
  const [activeStep, setActiveStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<DetectedPlaceholder[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".docx") || file.name.endsWith(".doc"))) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setUploadedFile(file);
    setTemplateName(file.name.replace(/\.(docx?|doc)$/i, ""));
    
    // Mock placeholder detection - in real app, this would parse the DOCX
    const mockPlaceholders: DetectedPlaceholder[] = [
      { id: "1", placeholder: "{{CLIENT_NAME}}", mappedField: "Client Name", fieldType: "client", preview: "John Smith" },
      { id: "2", placeholder: "{{CASE_REF}}", mappedField: "Case Reference", fieldType: "text", preview: "CR-2024-001" },
      { id: "3", placeholder: "{{COURT_NAME}}", mappedField: "Court Name", fieldType: "text", preview: "Crown Court" },
      { id: "4", placeholder: "{{HEARING_DATE}}", mappedField: "Hearing Date", fieldType: "date", preview: "15/03/2024" },
      { id: "5", placeholder: "{{OFFENCE_TYPE}}", mappedField: "Offence Type", fieldType: "select", preview: "Theft" },
      { id: "6", placeholder: "{{DEFENDANT_ADDRESS}}", mappedField: "Defendant Address", fieldType: "textarea", preview: "123 Main Street, London" },
      { id: "7", placeholder: "{{MITIGATING_FACTORS}}", mappedField: "Mitigating Factors", fieldType: "textarea", preview: "First-time offender..." },
    ];
    setDetectedPlaceholders(mockPlaceholders);
    setActiveStep(1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handlePlaceholderChange = (id: string, field: keyof DetectedPlaceholder, value: string) => {
    setDetectedPlaceholders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleRemovePlaceholder = (id: string) => {
    setDetectedPlaceholders((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddPlaceholder = () => {
    const newId = String(Date.now());
    setDetectedPlaceholders((prev) => [
      ...prev,
      { id: newId, placeholder: "{{NEW_FIELD}}", mappedField: "New Field", fieldType: "text", preview: "" },
    ]);
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    addTemplate({
      name: templateName,
      category: templateCategory,
      description: templateDescription,
      fields: detectedPlaceholders.map((p) => ({
        name: p.mappedField,
        type: p.fieldType,
        placeholder: p.placeholder,
      })),
    });
    
    setSaving(false);
    setShowSuccess(true);
  };

  const handleReset = () => {
    setActiveStep(0);
    setUploadedFile(null);
    setTemplateName("");
    setTemplateCategory("");
    setTemplateDescription("");
    setDetectedPlaceholders([]);
    setShowSuccess(false);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <Button
          component={Link}
          href="/templates"
          variant="outlined"
          startIcon={<ArrowLeft size={16} />}
          sx={{ minWidth: "auto" }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: "#1A1A1A" }}>
            Template Manager
          </Typography>
          <Typography variant="body1" sx={{ color: "#666666" }}>
            Upload Word documents and map placeholders to form fields.
          </Typography>
        </Box>
      </Box>

      {showSuccess ? (
        <Alert
          severity="success"
          sx={{ mb: 4 }}
          action={
            <Button color="inherit" size="small" onClick={handleReset}>
              Add Another
            </Button>
          }
        >
          Template &quot;{templateName}&quot; has been saved successfully with {detectedPlaceholders.length} mapped fields.
        </Alert>
      ) : (
        <>
          {/* Stepper */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Upload */}
            {activeStep === 0 && (
              <Box>
                <Paper
                  sx={{
                    p: 6,
                    border: dragOver ? "2px dashed #395B45" : "2px dashed #E0E0E0",
                    backgroundColor: dragOver ? "rgba(57, 91, 69, 0.04)" : "#FAFAFA",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".doc,.docx"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
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
                    Upload Word Template
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#666666", mb: 1 }}>
                    Drop your .docx or .doc file here, or click to browse.
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#999999" }}>
                    Use placeholders like {"{{CLIENT_NAME}}"} or {"{{CASE_REF}}"} in your document.
                  </Typography>
                </Paper>

                <Box sx={{ mt: 4, p: 3, backgroundColor: "#F5F5F5", borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    How placeholders work:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            1. Add placeholders in Word
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666666" }}>
                            Use double curly braces: {"{{FIELD_NAME}}"}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            2. Upload and map fields
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666666" }}>
                            We detect placeholders and you assign field types.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            3. Generate documents
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666666" }}>
                            Fill the form and export populated DOCX files.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            )}

            {/* Step 2: Map Fields */}
            {activeStep === 1 && (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <FileText size={24} color="#395B45" />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {uploadedFile?.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666666" }}>
                      {detectedPlaceholders.length} placeholders detected
                    </Typography>
                  </Box>
                </Box>

                <TableContainer sx={{ mb: 3 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                        <TableCell sx={{ fontWeight: 600, color: "#666666", width: "25%" }}>Placeholder</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "#666666", width: "25%" }}>Field Label</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "#666666", width: "20%" }}>Field Type</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "#666666", width: "20%" }}>Preview</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "#666666", width: "10%" }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detectedPlaceholders.map((placeholder) => (
                        <TableRow key={placeholder.id}>
                          <TableCell>
                            <Chip
                              label={placeholder.placeholder}
                              size="small"
                              sx={{ 
                                fontFamily: "monospace", 
                                fontSize: 12,
                                backgroundColor: "rgba(57, 91, 69, 0.08)",
                                color: "#395B45",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={placeholder.mappedField}
                              onChange={(e) => handlePlaceholderChange(placeholder.id, "mappedField", e.target.value)}
                              fullWidth
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={placeholder.fieldType}
                                onChange={(e) => handlePlaceholderChange(placeholder.id, "fieldType", e.target.value)}
                              >
                                {fieldTypeOptions.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: "#666666", fontStyle: "italic" }}>
                              {placeholder.preview || "No preview"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleRemovePlaceholder(placeholder.id)}
                              sx={{ color: "#D32F2F" }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button
                  variant="outlined"
                  startIcon={<Plus size={16} />}
                  onClick={handleAddPlaceholder}
                >
                  Add Field Manually
                </Button>
              </Box>
            )}

            {/* Step 3: Configure & Save */}
            {activeStep === 2 && (
              <Box sx={{ maxWidth: 600 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Template Details
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Template Name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={templateCategory}
                        label="Category"
                        onChange={(e) => setTemplateCategory(e.target.value)}
                      >
                        <MenuItem value="Criminal Defence">Criminal Defence</MenuItem>
                        <MenuItem value="Civil Litigation">Civil Litigation</MenuItem>
                        <MenuItem value="Family Law">Family Law</MenuItem>
                        <MenuItem value="Corporate">Corporate</MenuItem>
                        <MenuItem value="Immigration">Immigration</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      multiline
                      rows={3}
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of when to use this template..."
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, p: 3, backgroundColor: "#F5F5F5", borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Summary
                  </Typography>
                  <Box sx={{ display: "flex", gap: 4 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#666666" }}>File</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{uploadedFile?.name}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#666666" }}>Fields</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{detectedPlaceholders.length}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#666666" }}>Category</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{templateCategory || "Not set"}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4, pt: 3, borderTop: "1px solid #E0E0E0" }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={activeStep === 0}
                startIcon={<ArrowLeft size={16} />}
              >
                Back
              </Button>
              <Box sx={{ display: "flex", gap: 2 }}>
                {activeStep < steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={activeStep === 0}
                    endIcon={<ArrowRight size={16} />}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !templateName || !templateCategory}
                    startIcon={saving ? null : <Check size={16} />}
                  >
                    {saving ? "Saving..." : "Save Template"}
                  </Button>
                )}
              </Box>
            </Box>

            {saving && <LinearProgress sx={{ mt: 2 }} />}
          </Paper>
        </>
      )}

      {/* Existing Templates */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Existing Templates ({templates.length})
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}>
                  <TableCell sx={{ fontWeight: 500 }}>{template.name}</TableCell>
                  <TableCell>
                    <Chip label={template.category} size="small" sx={{ fontSize: 12 }} />
                  </TableCell>
                  <TableCell sx={{ color: "#666666", maxWidth: 300 }}>
                    <Typography variant="body2" noWrap>
                      {template.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" sx={{ color: "#666666" }}>
                      <Eye size={16} />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "#666666" }}>
                      <Edit2 size={16} />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "#D32F2F" }}>
                      <Trash2 size={16} />
                    </IconButton>
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
