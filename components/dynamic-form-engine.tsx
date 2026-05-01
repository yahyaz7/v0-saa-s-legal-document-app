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
import dynamic from "next/dynamic";
const PhraseBankSidebar = dynamic(() => import("./phrase-bank-sidebar"), { ssr: false });

interface DynamicFormEngineProps {
  templateId?: string;
  initialData?: Record<string, FieldValue>;
  onDataChange?: (data: Record<string, FieldValue>) => void;
  readOnly?: boolean;
}

// Fields that get auto-filled when arrest_VA is set to V.A. or Arrest
const ARREST_VA_AUTOFILL_KEYS = new Set([
  "time_of_advice_call_to_client",
  "delay_over_45_mins",
  "reasons_for_delay",
  "left_details_with_custody",
  "requested_for_interview",
  "custody_record_checked",
]);

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

  // Tracks which field keys are currently locked by auto-fill
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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

      // Always pre-fill delay fields with N/A if they are empty
      if (!map["delay_over_45_mins"]) map["delay_over_45_mins"] = "N/A";
      if (!map["reasons_for_delay"]) map["reasons_for_delay"] = "N/A";

      setFormData(map);
    } catch {
      setError("Network error while loading form");
    } finally {
      setLoading(false);
    }
  }

  function validateField(key: string, value: FieldValue): string | null {
    if (typeof value !== "string" || !value.trim()) return null;

    let totalMinutes = 0;
    const timeMatch = value.match(/^(\d+):([0-5]\d)$/);

    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (m % 6 !== 0) return "Minutes must be a multiple of 6";
      totalMinutes = h * 60 + m;
    } else {
      const num = parseInt(value, 10);
      if (isNaN(num)) return "Invalid format (use minutes or H:MM)";
      if (num % 6 !== 0) return "Must be a multiple of 6 minutes";
      totalMinutes = num;
    }

    // Travel Time & Waiting
    if (key.match(/^travel_time_\d$/) || key.match(/^travel\s_time_\d$/) || key.match(/^waiting_\d$/)) {
      if (totalMinutes > 360) return "Maximum 6 hours allowed"; // User said max 6 hours for all?
    }

    // Advice: capped at 6 hours (360 mins)
    if (key.match(/^advice_inst_\d$/)) {
      if (totalMinutes > 360) return "Maximum 6 hours (360 mins) allowed";
    }

    return null;
  }

  function handleFieldChange(key: string, value: FieldValue) {
    let next = { ...formData, [key]: value };

    // Validation
    const errorMsg = validateField(key, value);
    setValidationErrors((prev) => ({
      ...prev,
      [key]: errorMsg ?? "",
    }));

    // Auto-populate and lock PACE form fields when arrest_VA changes
    const lowerKey = key.toLowerCase();
    if (lowerKey === "arrest_va") {
      const normalized = typeof value === "string" ? value.replace(/\./g, "").trim().toUpperCase() : "";
      if (normalized === "VA") {
        next = {
          ...next,
          time_of_advice_call_to_client: "Advice call not claimed – attendance was for voluntary interview; advice provided in person.",
          delay_over_45_mins: "N.A.",
          reasons_for_delay: "N.A.",
          left_details_with_custody: "N/A",
          requested_for_interview: "Yes",
          custody_record_checked: "N/A",
        };
        setLockedKeys(new Set(ARREST_VA_AUTOFILL_KEYS));
      } else if (normalized === "ARREST") {
        next = {
          ...next,
          time_of_advice_call_to_client: "Advice call completed @ [TIME] – client advised in respect of confidentiality, the PACE clock, and the procedure to be followed.",
          delay_over_45_mins: "N.A.",
          reasons_for_delay: "N.A.",
          left_details_with_custody: "N/A",
          requested_for_interview: "Yes",
          custody_record_checked: "Yes",
        };
        setLockedKeys(new Set(ARREST_VA_AUTOFILL_KEYS));
      } else {
        // User cleared the selection — unlock all auto-filled fields
        setLockedKeys(new Set());
      }
    }

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
                error={validationErrors[field.field_key]}
                readOnly={readOnly || (lockedKeys.has(field.field_key) && field.field_key !== "time_of_advice_call_to_client")}
                autoFilled={lockedKeys.has(field.field_key)}
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
