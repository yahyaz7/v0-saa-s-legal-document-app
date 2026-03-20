"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Fade,
} from "@mui/material";
import { DynamicField, TemplateFieldDef, FieldValue } from "./dynamic-field";
import PhraseBankSidebar from "./phrase-bank-sidebar";

interface DynamicFormEngineProps {
  templateId?: string;
  initialData?: Record<string, FieldValue>;
  onDataChange?: (data: Record<string, FieldValue>) => void;
  readOnly?: boolean;
}

export default function DynamicFormEngine({
  templateId,
  initialData = {},
  onDataChange,
  readOnly = false,
}: DynamicFormEngineProps) {
  const [fields, setFields] = useState<TemplateFieldDef[]>([]);
  const [formData, setFormData] = useState<Record<string, FieldValue>>(initialData);
  const [loading, setLoading] = useState(!!templateId);
  const [error, setError] = useState<string | null>(null);

  // Phrase Bank focus management
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (templateId) fetchFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  async function fetchFields() {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/fields`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Failed to load form definitions");
        return;
      }

      // API returns { data: TemplateFieldDef[] }
      const fieldList: TemplateFieldDef[] = json.data ?? json;

      setFields(fieldList);

      // Initialise form data — only set keys not already present in initialData
      const map: Record<string, FieldValue> = { ...initialData };
      fieldList.forEach((f) => {
        if (map[f.field_key] === undefined) {
          map[f.field_key] = f.field_type === "checkbox" ? false : "";
        }
      });
      setFormData(map);
    } catch {
      setError("Network error while loading form");
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(key: string, value: FieldValue) {
    const next = { ...formData, [key]: value };
    setFormData(next);
    onDataChange?.(next);
  }

  function handleFocus(key: string) {
    const field = fields.find((f) => f.field_key === key);
    if (field?.supports_phrase_bank) {
      setFocusedFieldKey(key);
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }

  function handleInsertPhrase(content: string) {
    if (!focusedFieldKey) return;
    const current = (formData[focusedFieldKey] as string) || "";
    handleFieldChange(focusedFieldKey, current ? `${current}\n${content}` : content);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={32} thickness={5} sx={{ color: "#395B45" }} />
        <Typography variant="body2" sx={{ color: "#6B7280" }}>
          Loading form layout…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, bgcolor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 3 }}>
        <Typography color="error" variant="subtitle2" sx={{ fontWeight: 600 }}>
          Error Loading Form
        </Typography>
        <Typography color="error" variant="body2">{error}</Typography>
      </Paper>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", gap: 0, position: "relative", minHeight: 400 }}>
      {/* Form fields */}
      <Box sx={{ flexGrow: 1, p: 1 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {fields.map((field) => (
            <Box
              key={field.field_key}
              sx={{ width: field.field_type === "textarea" ? "100%" : { xs: "100%", md: "calc(50% - 12px)" } }}
            >
              <DynamicField
                field={field}
                value={formData[field.field_key]}
                onChange={handleFieldChange}
                onFocus={handleFocus}
                readOnly={readOnly}
              />
            </Box>
          ))}

          {fields.length === 0 && (
            <Box sx={{ width: "100%", py: 6, textAlign: "center", border: "1px dashed #D1D5DB", borderRadius: 4 }}>
              <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
                This template has no input fields configured.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Phrase Bank Sidebar */}
      <Fade in={sidebarOpen}>
        <Box
          sx={{
            width: sidebarOpen ? 320 : 0,
            transition: "width 0.3s ease",
            overflow: "hidden",
            position: "sticky",
            top: 0,
            height: "fit-content",
            maxHeight: "80vh",
            ml: 2,
            zIndex: 10,
          }}
        >
          <PhraseBankSidebar
            onInsert={handleInsertPhrase}
            onClose={() => setSidebarOpen(false)}
          />
        </Box>
      </Fade>
    </Box>
  );
}
