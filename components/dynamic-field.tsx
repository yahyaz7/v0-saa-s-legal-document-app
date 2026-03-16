"use client";

import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Mirrors the `template_fields` DB row that every API endpoint returns.
 * `field_key` is the snake_case DOCX placeholder name (e.g. "client_name")
 * and doubles as the form-state key.
 */
export interface TemplateFieldDef {
  field_key: string;
  field_label: string;
  field_type: "text" | "textarea" | "date" | "dropdown" | "checkbox";
  is_required: boolean;
  field_order: number;
  field_options: string[] | null;
  supports_phrase_bank: boolean;
}

export type FieldValue = string | boolean | Array<Record<string, string>>;

interface DynamicFieldProps {
  field: TemplateFieldDef;
  value: FieldValue;
  onChange: (key: string, value: FieldValue) => void;
  error?: string;
  readOnly?: boolean;
  /** Called when a textarea gains focus — used to auto-target the phrase panel. */
  onFocus?: (key: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DynamicField({
  field,
  value,
  onChange,
  error,
  readOnly,
  onFocus,
}: DynamicFieldProps) {
  const strValue = typeof value === "string" ? value : "";
  const boolValue = typeof value === "boolean" ? value : false;
  const labelText = field.field_label + (field.is_required ? " *" : "");

  if (field.field_type === "date") {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label={labelText}
          value={strValue ? dayjs(strValue) : null}
          onChange={(val) =>
            onChange(field.field_key, val ? val.format("YYYY-MM-DD") : "")
          }
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!error,
              helperText: error,
              disabled: readOnly,
            },
          }}
        />
      </LocalizationProvider>
    );
  }

  if (field.field_type === "dropdown") {
    return (
      <FormControl fullWidth error={!!error} disabled={readOnly}>
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={strValue}
          label={labelText}
          onChange={(e) => onChange(field.field_key, e.target.value)}
        >
          <MenuItem value="">
            <em>Select…</em>
          </MenuItem>
          {(field.field_options ?? []).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <FormControl error={!!error} component="fieldset" disabled={readOnly}>
        <FormControlLabel
          control={
            <Checkbox
              checked={boolValue}
              onChange={(e) => onChange(field.field_key, e.target.checked)}
              disabled={readOnly}
              sx={{ color: "#395B45", "&.Mui-checked": { color: "#395B45" } }}
            />
          }
          label={labelText}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <TextField
        fullWidth
        multiline
        rows={4}
        label={labelText}
        value={strValue}
        onChange={(e) => onChange(field.field_key, e.target.value)}
        onFocus={() => onFocus?.(field.field_key)}
        error={!!error}
        helperText={error}
        disabled={readOnly}
      />
    );
  }

  // text (default)
  return (
    <TextField
      fullWidth
      label={labelText}
      value={strValue}
      onChange={(e) => onChange(field.field_key, e.target.value)}
      error={!!error}
      helperText={error}
      disabled={readOnly}
    />
  );
}
