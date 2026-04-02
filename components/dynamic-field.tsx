"use client";

import { memo } from "react";
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Plus, Trash2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Sub-field definition stored inside a repeater field's `field_options`.
 * Each sub-field represents one column of the repeating table row.
 */
export interface RepeaterSubField {
  /** Snake_case key matching the {placeholder} in the DOCX template row. */
  name: string;
  /** Human-readable column label shown in the form table header. */
  label: string;
  /** Input type for this column. */
  type: "text" | "dropdown";
  /** Dropdown options (only used when type === "dropdown"). */
  options?: string[];
}

/**
 * Mirrors the `template_fields` DB row that every API endpoint returns.
 * `field_key` is the snake_case DOCX loop variable name (e.g. "offences")
 * and doubles as the form-state key.
 */
export interface TemplateFieldDef {
  field_key: string;
  field_label: string;
  field_type: "text" | "textarea" | "date" | "dropdown" | "checkbox" | "repeater";
  is_required: boolean;
  field_order: number;
  /**
   * For non-repeater fields: array of string dropdown options.
   * For repeater fields: array of RepeaterSubField definitions (stored as JSON).
   */
  field_options: string[] | RepeaterSubField[] | null;
  supports_phrase_bank: boolean;
  section_heading?: string | null;
}

/** A single row inside a repeater field. Values are always strings. */
export type RepeaterRow = Record<string, string>;

export type FieldValue = string | boolean | RepeaterRow[];

interface DynamicFieldProps {
  field: TemplateFieldDef;
  value: FieldValue;
  onChange: (key: string, value: FieldValue) => void;
  error?: string;
  readOnly?: boolean;
  /** Called when a textarea gains focus — used to auto-target the phrase panel. */
  onFocus?: (key: string) => void;
  /** Called when a textarea loses focus — reports cursor position for phrase insertion. */
  onBlur?: (key: string, start: number, end: number) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse field_options into RepeaterSubField[], returning [] on failure. */
function parseSubFields(raw: TemplateFieldDef["field_options"]): RepeaterSubField[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "object" && raw[0] !== null) {
    return raw as RepeaterSubField[];
  }
  return [];
}

/** Build an empty row with "" for every sub-field column. */
function emptyRow(subFields: RepeaterSubField[]): RepeaterRow {
  const row: RepeaterRow = {};
  for (const sf of subFields) row[sf.name] = "";
  return row;
}

// ── Repeater sub-component ─────────────────────────────────────────────────────

interface RepeaterFieldProps {
  field: TemplateFieldDef;
  rows: RepeaterRow[];
  onChange: (key: string, value: RepeaterRow[]) => void;
  error?: string;
  readOnly?: boolean;
}

const RepeaterField = memo(function RepeaterField({
  field,
  rows,
  onChange,
  error,
  readOnly,
}: RepeaterFieldProps) {
  const subFields = parseSubFields(field.field_options);
  const minRows = field.is_required ? 1 : 0;

  function safeRows(): RepeaterRow[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      return field.is_required ? [emptyRow(subFields)] : [];
    }
    return rows;
  }

  const currentRows = safeRows();

  function handleCellChange(rowIndex: number, colName: string, val: string) {
    const updated = currentRows.map((r, i) =>
      i === rowIndex ? { ...r, [colName]: val } : r
    );
    onChange(field.field_key, updated);
  }

  function handleAddRow() {
    onChange(field.field_key, [...currentRows, emptyRow(subFields)]);
  }

  function handleRemoveRow(rowIndex: number) {
    if (currentRows.length <= minRows) return;
    onChange(field.field_key, currentRows.filter((_, i) => i !== rowIndex));
  }

  if (subFields.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
          border: "1px dashed #E5E7EB",
          borderRadius: 2,
          bgcolor: "#FAFAFA",
        }}
      >
        <Typography variant="caption" color="error">
          Repeater field &quot;{field.field_label}&quot; has no sub-fields configured.
          An admin must add column definitions in the template builder.
        </Typography>
      </Box>
    );
  }

  // Determine grid template: [#] [col1] [col2] ... [delete?]
  const colTemplate = `28px ${subFields.map(() => "1fr").join(" ")}${!readOnly ? " 36px" : ""}`;

  return (
    <Box>
      {/* ── Card container ───────────────────────────────────────────── */}
      <Box
        sx={{
          border: "1px solid #D1D5DB",
          borderRadius: 2,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            bgcolor: "#395B45",
            px: 1.5,
            py: 1,
            gap: 1,
            alignItems: "center",
          }}
        >
          {/* row-number header placeholder */}
          <Box />
          {subFields.map((sf) => (
            <Typography
              key={sf.name}
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "#fff",
                fontSize: "0.72rem",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {sf.label}
            </Typography>
          ))}
          {!readOnly && <Box />}
        </Box>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {currentRows.length === 0 ? (
          <Box
            sx={{
              py: 3.5,
              display: "flex",
              justifyContent: "center",
              bgcolor: "#FAFAFA",
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: "#9CA3AF", fontStyle: "italic" }}
            >
              No entries yet — click <strong>Add row</strong> below to begin.
            </Typography>
          </Box>
        ) : (
          currentRows.map((row, rowIdx) => (
            <Box
              key={rowIdx}
              sx={{
                display: "grid",
                gridTemplateColumns: colTemplate,
                alignItems: "center",
                px: 1.5,
                py: 0.75,
                gap: 1,
                bgcolor: rowIdx % 2 === 0 ? "#fff" : "#F9FAFB",
                borderTop: "1px solid #F3F4F6",
                transition: "background-color 0.12s",
                "&:hover": { bgcolor: "#F0F5F1" },
              }}
            >
              {/* Row number badge */}
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  bgcolor: "#E5EDE8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.64rem",
                    color: "#395B45",
                    lineHeight: 1,
                  }}
                >
                  {rowIdx + 1}
                </Typography>
              </Box>

              {/* Cell inputs */}
              {subFields.map((sf) => (
                <Box key={sf.name}>
                  {sf.type === "dropdown" ? (
                    <FormControl fullWidth size="small" disabled={readOnly}>
                      <Select
                        displayEmpty
                        value={row[sf.name] ?? ""}
                        onChange={(e) =>
                          handleCellChange(rowIdx, sf.name, e.target.value)
                        }
                        sx={{
                          fontSize: "0.82rem",
                          "& .MuiSelect-select": { py: "5px" },
                          "& fieldset": { borderColor: "#E5E7EB" },
                          "&:hover fieldset": { borderColor: "#395B45 !important" },
                          "&.Mui-focused fieldset": { borderColor: "#395B45 !important" },
                        }}
                      >
                        <MenuItem value="">
                          <em style={{ color: "#9CA3AF", fontSize: "0.82rem" }}>
                            {sf.label}…
                          </em>
                        </MenuItem>
                        {(sf.options ?? []).map((opt) => (
                          <MenuItem key={opt} value={opt} sx={{ fontSize: "0.82rem" }}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      value={row[sf.name] ?? ""}
                      placeholder={sf.label}
                      onChange={(e) =>
                        handleCellChange(rowIdx, sf.name, e.target.value)
                      }
                      disabled={readOnly}
                      InputProps={{
                        sx: {
                          fontSize: "0.82rem",
                          "& input": { py: "5px" },
                          "& fieldset": { borderColor: "#E5E7EB" },
                          "&:hover fieldset": { borderColor: "#395B45 !important" },
                          "&.Mui-focused fieldset": { borderColor: "#395B45 !important" },
                        },
                      }}
                    />
                  )}
                </Box>
              ))}

              {/* Delete button */}
              {!readOnly && (
                <Tooltip
                  title={
                    currentRows.length <= minRows
                      ? "At least one row is required"
                      : "Remove this row"
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveRow(rowIdx)}
                      disabled={currentRows.length <= minRows}
                      sx={{
                        color: "#D1D5DB",
                        "&:hover": {
                          color: "#DC2626",
                          bgcolor: "rgba(220,38,38,0.06)",
                        },
                        "&.Mui-disabled": { opacity: 0.3 },
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          ))
        )}

        {/* ── Add Row button (inside card at bottom) ──────────────────── */}
        {!readOnly && (
          <Box sx={{ borderTop: "1px solid #E5E7EB", bgcolor: "#F9FAFB" }}>
            <Button
              fullWidth
              size="small"
              startIcon={<Plus size={14} />}
              onClick={handleAddRow}
              sx={{
                py: 0.9,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "#395B45",
                borderRadius: 0,
                "&:hover": { bgcolor: "#EBF2EC" },
              }}
            >
              Add row
            </Button>
          </Box>
        )}
      </Box>

      {/* Field-level error */}
      {error && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 0.75, display: "block" }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
});

// ── Main DynamicField component ────────────────────────────────────────────────

export const DynamicField = memo(function DynamicField({
  field,
  value,
  onChange,
  error,
  readOnly,
  onFocus,
  onBlur,
}: DynamicFieldProps) {
  const strValue = typeof value === "string" ? value : "";
  const boolValue = typeof value === "boolean" ? value : false;
  const rowsValue: RepeaterRow[] = Array.isArray(value) ? (value as RepeaterRow[]) : [];
  const labelText = field.field_label + (field.is_required ? " *" : "");

  // ── Repeater ─────────────────────────────────────────────────────────────────
  if (field.field_type === "repeater") {
    return (
      <Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "#374151", mb: 1, fontSize: "0.875rem" }}
        >
          {labelText}
        </Typography>
        <RepeaterField
          field={field}
          rows={rowsValue}
          onChange={onChange}
          error={error}
          readOnly={readOnly}
        />
      </Box>
    );
  }

  // ── Date ──────────────────────────────────────────────────────────────────────
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

  // ── Dropdown ─────────────────────────────────────────────────────────────────
  if (field.field_type === "dropdown") {
    const opts = (field.field_options as string[] | null) ?? [];
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
          {opts.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  // ── Checkbox ──────────────────────────────────────────────────────────────────
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

  // ── Textarea ─────────────────────────────────────────────────────────────────
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
        onBlur={(e) => {
          const el = e.target as HTMLTextAreaElement;
          onBlur?.(field.field_key, el.selectionStart ?? strValue.length, el.selectionEnd ?? strValue.length);
        }}
        error={!!error}
        helperText={error}
        disabled={readOnly}
      />
    );
  }

  // ── Text (default) ────────────────────────────────────────────────────────────
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
});
