"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ReactNode } from "react";
import { EmotionCacheProvider } from "./emotion-cache-provider";

const theme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  palette: {
    primary: {
      main: "#395B45",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#F5F5F5",
    },
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1A1A1A",
      secondary: "#666666",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 6,
  },
  shadows: [
    "none",
    "0px 1px 3px rgba(0, 0, 0, 0.08)",
    "0px 2px 6px rgba(0, 0, 0, 0.08)",
    "0px 4px 12px rgba(0, 0, 0, 0.08)",
    "0px 8px 24px rgba(0, 0, 0, 0.08)",
    "0px 12px 32px rgba(0, 0, 0, 0.1)",
    "0px 16px 40px rgba(0, 0, 0, 0.1)",
    "0px 20px 48px rgba(0, 0, 0, 0.1)",
    "0px 24px 56px rgba(0, 0, 0, 0.1)",
    "0px 28px 64px rgba(0, 0, 0, 0.1)",
    "0px 32px 72px rgba(0, 0, 0, 0.1)",
    "0px 36px 80px rgba(0, 0, 0, 0.1)",
    "0px 40px 88px rgba(0, 0, 0, 0.1)",
    "0px 44px 96px rgba(0, 0, 0, 0.1)",
    "0px 48px 104px rgba(0, 0, 0, 0.1)",
    "0px 52px 112px rgba(0, 0, 0, 0.1)",
    "0px 56px 120px rgba(0, 0, 0, 0.1)",
    "0px 60px 128px rgba(0, 0, 0, 0.1)",
    "0px 64px 136px rgba(0, 0, 0, 0.1)",
    "0px 68px 144px rgba(0, 0, 0, 0.1)",
    "0px 72px 152px rgba(0, 0, 0, 0.1)",
    "0px 76px 160px rgba(0, 0, 0, 0.1)",
    "0px 80px 168px rgba(0, 0, 0, 0.1)",
    "0px 84px 176px rgba(0, 0, 0, 0.1)",
    "0px 88px 184px rgba(0, 0, 0, 0.1)",
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          textTransform: "none",
          fontWeight: 500,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.08)",
          },
          // Smaller on mobile / tablet
          [t.breakpoints.down("md")]: {
            fontSize: "0.8rem",
            padding: "5px 12px",
            minHeight: 34,
          },
          [t.breakpoints.down("sm")]: {
            fontSize: "0.75rem",
            padding: "4px 10px",
            minHeight: 32,
          },
        }),
        contained: {
          "&:hover": {
            boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
          },
        },
        sizeSmall: ({ theme: t }) => ({
          [t.breakpoints.down("md")]: {
            fontSize: "0.72rem",
            padding: "3px 8px",
            minHeight: 28,
          },
        }),
      },
    },
    MuiTypography: {
      styleOverrides: {
        h5: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "1.1rem" },
        }),
        h6: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "0.95rem" },
        }),
        subtitle1: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "0.875rem" },
        }),
        body1: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "0.85rem" },
        }),
        body2: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "0.78rem" },
        }),
        caption: ({ theme: t }) => ({
          [t.breakpoints.down("sm")]: { fontSize: "0.67rem" },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid #E0E0E0",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.08)",
        },
      },
    },
  },
});

export function MuiThemeProvider({ children }: { children: ReactNode }) {
  return (
    <EmotionCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </EmotionCacheProvider>
  );
}
