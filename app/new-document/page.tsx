"use client";

import { useState, Suspense } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { Plus, FileDown, Save, Sparkles, X } from "lucide-react";
import { useAppContext, ExtractedField } from "@/lib/app-context";
import { useSearchParams } from "next/navigation";

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ py: 2 }}>
      {value === index && children}
    </Box>
  );
}

function DocumentBuilderContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { templates, phrases, clients } = useAppContext();

  const selectedTemplate = templates.find((t) => t.id === templateId) || templates[0];

  const [tabValue, setTabValue] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [formData, setFormData] = useState({
    client: "",
    caseReference: "",
    courtName: "",
    hearingDate: null as Dayjs | null,
    offenceType: "",
    notes: "",
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExtractFields = () => {
    // Mock extraction
    const mockFields: ExtractedField[] = [
      { id: "1", fieldName: "Defendant Name", suggestedValue: "John Smith", confidence: 95, approved: false },
      { id: "2", fieldName: "Case Reference", suggestedValue: "CR-2024-001234", confidence: 88, approved: false },
      { id: "3", fieldName: "Court Name", suggestedValue: "Crown Court, London", confidence: 92, approved: false },
      { id: "4", fieldName: "Offence Date", suggestedValue: "15 January 2024", confidence: 85, approved: false },
    ];
    setExtractedFields(mockFields);
    setTabValue(2);
  };

  const handleFieldApproval = (id: string, approved: boolean) => {
    setExtractedFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, approved } : f))
    );
  };

  const handleFieldValueChange = (id: string, value: string) => {
    setExtractedFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, suggestedValue: value } : f))
    );
  };

  const getConfidenceColor = (confidence: number): "success" | "warning" | "error" => {
    if (confidence >= 90) return "success";
    if (confidence >= 70) return "warning";
    return "error";
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ pb: 10 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
            New Document
          </Typography>
          <Typography variant="body1" sx={{ color: "#666666" }}>
            Using template: <strong>{selectedTemplate?.name || "Defence Statement"}</strong>
          </Typography>
        </Box>

        {/* Main Grid Layout */}
        <Grid container spacing={3}>
          {/* LEFT Column - Form */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Document Details
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Client</InputLabel>
                    <Select
                      value={formData.client}
                      label="Client"
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    >
                      {clients.map((client) => (
                        <MenuItem key={client.id} value={client.id}>
                          {client.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Case Reference"
                    value={formData.caseReference}
                    onChange={(e) => setFormData({ ...formData, caseReference: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Court Name"
                    value={formData.courtName}
                    onChange={(e) => setFormData({ ...formData, courtName: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DatePicker
                    label="Hearing Date"
                    value={formData.hearingDate}
                    onChange={(value) => setFormData({ ...formData, hearingDate: value })}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <InputLabel>Offence Type</InputLabel>
                    <Select
                      value={formData.offenceType}
                      label="Offence Type"
                      onChange={(e) => setFormData({ ...formData, offenceType: e.target.value })}
                    >
                      <MenuItem value="theft">Theft</MenuItem>
                      <MenuItem value="assault">Assault</MenuItem>
                      <MenuItem value="fraud">Fraud</MenuItem>
                      <MenuItem value="driving">Driving Offence</MenuItem>
                      <MenuItem value="drugs">Drug Offence</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Document Content
              </Typography>

              <TextField
                fullWidth
                label="Notes / Additional Information"
                multiline
                rows={6}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Enter any additional notes or information for the document..."
              />
            </Paper>
          </Grid>

          {/* RIGHT Column - Phrase Bank & AI Tools */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 0, overflow: "hidden" }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  borderBottom: "1px solid #E0E0E0",
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: 13,
                  },
                }}
              >
                <Tab label="Suggested Phrases" />
                <Tab label="Paste Source" />
                <Tab label="Extracted Fields" />
              </Tabs>

              {/* Suggested Phrases Tab */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ px: 2, maxHeight: 500, overflow: "auto" }}>
                  {phrases.slice(0, 4).map((phrase) => (
                    <Card
                      key={phrase.id}
                      sx={{
                        mb: 2,
                        border: "1px solid #E0E0E0",
                        boxShadow: "none",
                      }}
                    >
                      <CardContent sx={{ pb: "12px !important" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 14 }}>
                            {phrase.title}
                          </Typography>
                          <Chip
                            label={`${phrase.confidence}%`}
                            size="small"
                            color={getConfidenceColor(phrase.confidence)}
                            sx={{ fontSize: 11, height: 20 }}
                          />
                        </Box>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                          {phrase.offenceTags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{
                                backgroundColor: "#F5F5F5",
                                fontSize: 10,
                                height: 18,
                              }}
                            />
                          ))}
                        </Box>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<Plus size={14} />}
                          fullWidth
                          sx={{ mt: 1 }}
                        >
                          Add to Document
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </TabPanel>

              {/* Paste Source Text Tab */}
              <TabPanel value={tabValue} index={1}>
                <Box sx={{ px: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={12}
                    placeholder="Paste source text here (e.g., case notes, previous statements)..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<Sparkles size={16} />}
                    onClick={handleExtractFields}
                    disabled={!sourceText.trim()}
                  >
                    Extract Fields
                  </Button>
                </Box>
              </TabPanel>

              {/* Extracted Fields Tab */}
              <TabPanel value={tabValue} index={2}>
                <Box sx={{ px: 2, maxHeight: 500, overflow: "auto" }}>
                  {extractedFields.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "#666666", textAlign: "center", py: 4 }}>
                      No extracted fields yet. Paste source text and click &quot;Extract Fields&quot;.
                    </Typography>
                  ) : (
                    extractedFields.map((field) => (
                      <Box
                        key={field.id}
                        sx={{
                          mb: 2,
                          p: 2,
                          border: "1px solid #E0E0E0",
                          borderRadius: 1,
                          backgroundColor: field.approved ? "rgba(57, 91, 69, 0.04)" : "transparent",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                            {field.fieldName}
                          </Typography>
                          <Chip
                            label={`${field.confidence}%`}
                            size="small"
                            color={getConfidenceColor(field.confidence)}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          value={field.suggestedValue}
                          onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                          sx={{ mb: 1 }}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.approved}
                              onChange={(e) => handleFieldApproval(field.id, e.target.checked)}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontSize: 12 }}>
                              Approve
                            </Typography>
                          }
                        />
                      </Box>
                    ))
                  )}
                </Box>
              </TabPanel>
            </Paper>
          </Grid>
        </Grid>

        {/* Bottom Fixed Action Bar */}
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 240,
            right: 0,
            p: 2,
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            borderTop: "1px solid #E0E0E0",
            zIndex: 1000,
          }}
        >
          <Button variant="outlined" color="primary" startIcon={<Save size={16} />}>
            Save Draft
          </Button>
          <Button variant="contained" color="primary" startIcon={<FileDown size={16} />}>
            Generate DOCX
          </Button>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}>Loading...</Box>}>
      <DocumentBuilderContent />
    </Suspense>
  );
}
