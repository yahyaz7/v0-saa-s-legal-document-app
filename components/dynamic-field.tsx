"use client";

import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Button,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Plus, X } from "lucide-react";

export interface TemplateFieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "select" | "date" | "repeater";
  section: string;
  section_order: number;
  field_order: number;
  required: boolean;
  options: string[] | null;
  repeater_fields: { key: string; label: string; type: string }[] | null;
}

export type FieldValue = string | Array<Record<string, string>>;

interface DynamicFieldProps {
  field: TemplateFieldDef;
  value: FieldValue;
  onChange: (key: string, value: FieldValue) => void;
  error?: string;
  /** Called when a textarea gains focus — used to auto-target the phrase panel. */
  onFocus?: (key: string) => void;
}

export function DynamicField({ field, value, onChange, error, onFocus }: DynamicFieldProps) {
  const strValue = typeof value === "string" ? value : "";
  const rows = Array.isArray(value) ? value : [];
  const subFields = field.repeater_fields ?? [];

  // ── Repeater ────────────────────────────────────────────────
  if (field.field_type === "repeater") {
    const handleCellChange = (rowIdx: number, subKey: string, v: string) => {
      const updated = rows.map((row, i) =>
        i === rowIdx ? { ...row, [subKey]: v } : row
      );
      onChange(field.field_key, updated);
    };

    const addRow = () => {
      const empty = Object.fromEntries(subFields.map((f) => [f.key, ""]));
      onChange(field.field_key, [...rows, empty]);
    };

    const removeRow = (rowIdx: number) => {
      onChange(field.field_key, rows.filter((_, i) => i !== rowIdx));
    };

    return (
      <Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{ minWidth: 500, "& td, & th": { borderColor: "#E0E0E0" } }}
          >
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                {subFields.map((sf) => (
                  <TableCell
                    key={sf.key}
                    sx={{ fontWeight: 600, fontSize: 13, py: 1, px: 1.5 }}
                  >
                    {sf.label}
                  </TableCell>
                ))}
                <TableCell sx={{ width: 36, px: 0.5 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {subFields.map((sf) => (
                    <TableCell key={sf.key} sx={{ py: 0.5, px: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row[sf.key] ?? ""}
                        onChange={(e) =>
                          handleCellChange(rowIdx, sf.key, e.target.value)
                        }
                        sx={{ minWidth: 80 }}
                      />
                    </TableCell>
                  ))}
                  <TableCell sx={{ py: 0.5, px: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => removeRow(rowIdx)}
                      disabled={rows.length <= 1}
                      sx={{ color: "#AAAAAA", "&:hover": { color: "#333" } }}
                    >
                      <X size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Button
          size="small"
          startIcon={<Plus size={14} />}
          onClick={addRow}
          sx={{ mt: 1, color: "#395B45", textTransform: "none" }}
        >
          Add Row
        </Button>

        {error && (
          <Typography
            variant="caption"
            color="error"
            sx={{ display: "block", mt: 0.5 }}
          >
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  // ── Date ────────────────────────────────────────────────────
  if (field.field_type === "date") {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label={field.label + (field.required ? " *" : "")}
          value={strValue ? dayjs(strValue) : null}
          onChange={(val) =>
            onChange(field.field_key, val ? val.format("YYYY-MM-DD") : "")
          }
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!error,
              helperText: error,
            },
          }}
        />
      </LocalizationProvider>
    );
  }

  // ── Select ──────────────────────────────────────────────────
  if (field.field_type === "select") {
    const labelText = field.label + (field.required ? " *" : "");
    return (
      <FormControl fullWidth error={!!error}>
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={strValue}
          label={labelText}
          onChange={(e) => onChange(field.field_key, e.target.value)}
        >
          <MenuItem value="">
            <em>Select…</em>
          </MenuItem>
          {(field.options ?? []).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  // ── Textarea ─────────────────────────────────────────────────
  if (field.field_type === "textarea") {
    return (
      <TextField
        fullWidth
        multiline
        rows={4}
        label={field.label + (field.required ? " *" : "")}
        value={strValue}
        onChange={(e) => onChange(field.field_key, e.target.value)}
        onFocus={() => onFocus?.(field.field_key)}
        error={!!error}
        helperText={error}
      />
    );
  }

  // ── Text (default) ───────────────────────────────────────────
  return (
    <TextField
      fullWidth
      label={field.label + (field.required ? " *" : "")}
      value={strValue}
      onChange={(e) => onChange(field.field_key, e.target.value)}
      error={!!error}
      helperText={error}
    />
  );
}
