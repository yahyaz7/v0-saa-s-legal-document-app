"use client";

import {
  memo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
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
  Paper,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Plus, Trash2, Search, X, CheckCircle2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RepeaterSubField {
  name: string;
  label: string;
  type: "text" | "dropdown" | "offence_search";
  options?: string[];
}

export interface TemplateFieldDef {
  field_key: string;
  field_label: string;
  field_type: "text" | "textarea" | "date" | "dropdown" | "checkbox" | "repeater";
  is_required: boolean;
  field_order: number;
  field_options: string[] | RepeaterSubField[] | null;
  supports_phrase_bank: boolean;
  section_heading?: string | null;
}

export type RepeaterRow = Record<string, string>;
export type FieldValue = string | boolean | RepeaterRow[];

interface DynamicFieldProps {
  field: TemplateFieldDef;
  value: FieldValue;
  onChange: (key: string, value: FieldValue) => void;
  error?: string;
  readOnly?: boolean;
  onFocus?: (key: string) => void;
  onBlur?: (key: string, start: number, end: number) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseSubFields(raw: TemplateFieldDef["field_options"]): RepeaterSubField[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "object" && raw[0] !== null) return raw as RepeaterSubField[];
  return [];
}

function emptyRow(subFields: RepeaterSubField[]): RepeaterRow {
  const row: RepeaterRow = {};
  for (const sf of subFields) row[sf.name] = "";
  return row;
}

// ── OffenceSearchCell ─────────────────────────────────────────────────────────

interface OffenceResult {
  id: string;
  category: string;
  type: string;
  offence: string;
}

interface OffenceSearchCellProps {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const OffenceSearchCell = memo(function OffenceSearchCell({
  value,
  placeholder,
  onChange,
  disabled,
}: OffenceSearchCellProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OffenceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Position for the portal dropdown
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reposition the portal dropdown to sit below the input
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 340),
      zIndex: 9999,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      // Don't close if clicking inside the dropdown portal
      const portal = document.getElementById("offence-search-portal");
      if (inputRef.current?.contains(target) || portal?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/offences/search?q=${encodeURIComponent(q)}&limit=25`
      );
      const json = await res.json();
      if (json.success) setResults(json.data ?? []);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    updatePosition();
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 300);
  }

  function handleFocus() {
    if (value) return; // already selected — don't re-open
    updatePosition();
    setOpen(true);
    fetchResults(query);
  }

  function handleSelect(r: OffenceResult) {
    onChange(r.offence);
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  // ── Selected state ──────────────────────────────────────────────────────────
  if (value) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.75,
          border: "1px solid #B6D4BE",
          borderRadius: 1,
          px: 1.25,
          py: 0.75,
          bgcolor: "#F0F7F2",
          minHeight: 34,
        }}
      >
        <CheckCircle2
          size={14}
          color="#395B45"
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <Typography
          sx={{
            flex: 1,
            fontSize: "0.8rem",
            color: "#1a3a25",
            lineHeight: 1.45,
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
        {!disabled && (
          <Tooltip title="Clear and search again">
            <IconButton
              size="small"
              onClick={handleClear}
              sx={{
                p: 0.25,
                flexShrink: 0,
                color: "#9CA3AF",
                "&:hover": { color: "#EF4444", bgcolor: "transparent" },
              }}
            >
              <X size={13} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // ── Search input + portal dropdown ──────────────────────────────────────────
  return (
    <Box ref={inputRef} sx={{ position: "relative" }}>
      <TextField
        fullWidth
        size="small"
        value={query}
        placeholder={`Search ${placeholder}…`}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        disabled={disabled}
        autoComplete="off"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {loading ? (
                  <CircularProgress size={13} sx={{ color: "#9CA3AF" }} />
                ) : (
                  <Search size={13} color="#9CA3AF" />
                )}
              </InputAdornment>
            ),
            sx: {
              fontSize: "0.82rem",
              "& input": { py: "6px" },
              "& fieldset": { borderColor: "#D1D5DB" },
              "&:hover fieldset": { borderColor: "#395B45 !important" },
              "&.Mui-focused fieldset": {
                borderColor: "#395B45 !important",
                borderWidth: "1.5px !important",
              },
            },
          },
        }}
      />

      {/* Portal dropdown — renders at document root, never clips */}
      {open &&
        createPortal(
          <div id="offence-search-portal" style={dropdownStyle}>
            <Paper
              elevation={6}
              sx={{
                borderRadius: 1.5,
                border: "1px solid #E5E7EB",
                maxHeight: 300,
                overflowY: "auto",
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {/* Header hint */}
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderBottom: "1px solid #F3F4F6",
                  bgcolor: "#FAFAFA",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                }}
              >
                <Search size={11} color="#9CA3AF" />
                <Typography
                  variant="caption"
                  sx={{ color: "#9CA3AF", fontSize: "0.7rem" }}
                >
                  {query.trim()
                    ? `Showing results for "${query}"`
                    : "Type to search offences database"}
                </Typography>
                {loading && (
                  <CircularProgress
                    size={10}
                    sx={{ color: "#395B45", ml: "auto" }}
                  />
                )}
              </Box>

              {/* Results */}
              {!loading && results.length === 0 ? (
                <Box sx={{ px: 2, py: 2.5, textAlign: "center" }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "#9CA3AF", fontSize: "0.78rem" }}
                  >
                    {query.trim()
                      ? "No offences found. Try different terms."
                      : "Start typing to search…"}
                  </Typography>
                </Box>
              ) : (
                results.map((r, idx) => (
                  <Box
                    key={r.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(r);
                    }}
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: "pointer",
                      borderBottom:
                        idx < results.length - 1 ? "1px solid #F3F4F6" : "none",
                      transition: "background-color 0.1s",
                      "&:hover": { bgcolor: "#F0F7F2" },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.82rem",
                        color: "#111827",
                        lineHeight: 1.45,
                        fontWeight: 500,
                      }}
                    >
                      {r.offence}
                    </Typography>
                    {(r.category || r.type) && (
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.75,
                          mt: 0.25,
                          alignItems: "center",
                        }}
                      >
                        {r.category && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: "0.67rem",
                              color: "#395B45",
                              bgcolor: "#E5EDE8",
                              px: 0.6,
                              py: 0.1,
                              borderRadius: 0.5,
                              fontWeight: 600,
                            }}
                          >
                            {r.category}
                          </Typography>
                        )}
                        {r.type && (
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "0.67rem", color: "#9CA3AF" }}
                          >
                            {r.type}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                ))
              )}
            </Paper>
          </div>,
          document.body
        )}
    </Box>
  );
});

// ── RepeaterField ─────────────────────────────────────────────────────────────

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
        sx={{ p: 2, border: "1px dashed #E5E7EB", borderRadius: 2, bgcolor: "#FAFAFA" }}
      >
        <Typography variant="caption" color="error">
          Repeater field &quot;{field.field_label}&quot; has no sub-fields configured.
          An admin must add column definitions in the template builder.
        </Typography>
      </Box>
    );
  }

  // Give offence_search columns 3x weight vs plain text columns
  const colSizes = subFields.map((sf) =>
    sf.type === "offence_search" ? "3fr" : "1fr"
  );
  const colTemplate = `28px ${colSizes.join(" ")}${!readOnly ? " 40px" : ""}`;

  return (
    <Box>
      <Box
        sx={{
          border: "1px solid #D1D5DB",
          borderRadius: 2,
          // NOTE: no overflow:hidden — allows the offence search dropdown to escape
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            bgcolor: "#395B45",
            px: 1.5,
            py: 1,
            gap: 1,
            alignItems: "center",
            borderRadius: "8px 8px 0 0",
          }}
        >
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
              {sf.type === "offence_search" && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.5,
                    fontSize: "0.6rem",
                    opacity: 0.75,
                    fontWeight: 400,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  (searchable)
                </Box>
              )}
            </Typography>
          ))}
          {!readOnly && <Box />}
        </Box>

        {/* Body */}
        {currentRows.length === 0 ? (
          <Box
            sx={{
              py: 4,
              display: "flex",
              justifyContent: "center",
              bgcolor: "#FAFAFA",
              borderTop: "1px solid #E5E7EB",
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
                py: 1,
                gap: 1,
                bgcolor: rowIdx % 2 === 0 ? "#fff" : "#F9FAFB",
                borderTop: "1px solid #F3F4F6",
                transition: "background-color 0.12s",
                "&:hover": { bgcolor: "#F5F9F6" },
              }}
            >
              {/* Row number */}
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

              {/* Cells */}
              {subFields.map((sf) => (
                <Box key={sf.name}>
                  {sf.type === "offence_search" ? (
                    <OffenceSearchCell
                      value={row[sf.name] ?? ""}
                      placeholder={sf.label}
                      onChange={(val) => handleCellChange(rowIdx, sf.name, val)}
                      disabled={readOnly}
                    />
                  ) : sf.type === "dropdown" ? (
                    <FormControl fullWidth size="small" disabled={readOnly}>
                      <Select
                        displayEmpty
                        value={row[sf.name] ?? ""}
                        onChange={(e) =>
                          handleCellChange(rowIdx, sf.name, e.target.value)
                        }
                        sx={{
                          fontSize: "0.82rem",
                          "& .MuiSelect-select": { py: "6px" },
                          "& fieldset": { borderColor: "#D1D5DB" },
                          "&:hover fieldset": { borderColor: "#395B45 !important" },
                          "&.Mui-focused fieldset": {
                            borderColor: "#395B45 !important",
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em style={{ color: "#9CA3AF", fontSize: "0.82rem" }}>
                            {sf.label}…
                          </em>
                        </MenuItem>
                        {(sf.options ?? []).map((opt) => (
                          <MenuItem
                            key={opt}
                            value={opt}
                            sx={{ fontSize: "0.82rem" }}
                          >
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
                          "& input": { py: "6px" },
                          "& fieldset": { borderColor: "#D1D5DB" },
                          "&:hover fieldset": { borderColor: "#395B45 !important" },
                          "&.Mui-focused fieldset": {
                            borderColor: "#395B45 !important",
                          },
                        },
                      }}
                    />
                  )}
                </Box>
              ))}

              {/* Delete */}
              {!readOnly && (
                <Tooltip
                  title={
                    currentRows.length <= minRows
                      ? "At least one row is required"
                      : "Remove row"
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

        {/* Add row */}
        {!readOnly && (
          <Box
            sx={{
              borderTop: "1px solid #E5E7EB",
              bgcolor: "#F9FAFB",
              borderRadius: "0 0 8px 8px",
            }}
          >
            <Button
              fullWidth
              size="small"
              startIcon={<Plus size={14} />}
              onClick={handleAddRow}
              sx={{
                py: 1,
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

// ── Main DynamicField ─────────────────────────────────────────────────────────

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
  const rowsValue: RepeaterRow[] = Array.isArray(value)
    ? (value as RepeaterRow[])
    : [];
  const labelText = field.field_label + (field.is_required ? " *" : "");

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
        onBlur={(e) => {
          const el = e.target as HTMLTextAreaElement;
          onBlur?.(
            field.field_key,
            el.selectionStart ?? strValue.length,
            el.selectionEnd ?? strValue.length
          );
        }}
        error={!!error}
        helperText={error}
        disabled={readOnly}
      />
    );
  }

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
