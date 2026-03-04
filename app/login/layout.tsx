"use client";

import { MuiThemeProvider } from "@/components/mui-theme-provider";
import { Box } from "@mui/material";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      {children}
    </Box>
  );
}
