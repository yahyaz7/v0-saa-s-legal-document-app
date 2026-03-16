"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from "@mui/material";
import { Search, ChevronDown, X } from "lucide-react";

interface Phrase {
  id: string;
  phrase_text: string;
}

interface Category {
  id: string;
  name: string;
  phrases: Phrase[];
}

interface PhraseBankSidebarProps {
  onInsert: (content: string) => void;
  onClose?: () => void;
}

export default function PhraseBankSidebar({ onInsert, onClose }: PhraseBankSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/phrases")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setCategories(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const query = search.toLowerCase();

  // Filter categories + phrases by search query
  const filtered: Category[] = categories
    .map((cat) => ({
      ...cat,
      phrases: query
        ? cat.phrases.filter((p) => p.phrase_text.toLowerCase().includes(query))
        : cat.phrases,
    }))
    .filter((cat) => !query || cat.phrases.length > 0 || cat.name.toLowerCase().includes(query));

  const totalPhrases = filtered.reduce((n, c) => n + c.phrases.length, 0);

  return (
    <Paper
      sx={{
        width: 320,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #E5E7EB",
        borderRadius: 0,
        bgcolor: "#FAFAFA",
      }}
      elevation={0}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#111827" }}>
          Phrase Bank
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        )}
      </Box>

      {/* Search */}
      <Box sx={{ px: 2, mb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search phrases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color="#6B7280" />
              </InputAdornment>
            ),
          }}
          sx={{ bgcolor: "white" }}
        />
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "#9CA3AF" }}>
              {search ? "No matching phrases found." : "No phrases added yet."}
            </Typography>
          </Box>
        ) : (
          <>
            {filtered.map((cat) => (
              <Accordion
                key={cat.id}
                defaultExpanded={filtered.length === 1 || !!search}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: "transparent",
                  borderBottom: "1px solid #F3F4F6",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={16} color="#6B7280" />}
                  sx={{ px: 2, py: 0.5, minHeight: 40 }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {cat.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#9CA3AF", ml: 1 }}>
                    ({cat.phrases.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {cat.phrases.map((phrase) => (
                    <Box
                      key={phrase.id}
                      onClick={() => onInsert(phrase.phrase_text)}
                      sx={{
                        px: 2,
                        py: 1.5,
                        cursor: "pointer",
                        borderTop: "1px solid #F9FAFB",
                        "&:hover": { bgcolor: "rgba(57, 91, 69, 0.06)" },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#374151",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {phrase.phrase_text}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                {totalPhrases} phrase{totalPhrases !== 1 ? "s" : ""} — click to insert
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}
