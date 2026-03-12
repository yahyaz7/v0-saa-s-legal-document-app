"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  Link as MuiLink,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Mail, ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    if (!email) {
      setError("Please enter your email address");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#F8F9FA",
      }}
    >
      {/* Left Panel - Branding (Matching Login) */}
      <Box
        sx={{
          flex: 1,
          bgcolor: "#395B45",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: 6,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <Box sx={{ position: "relative", textAlign: "center", maxWidth: 400 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              mb: 4,
            }}
          >
            <Box
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.15)",
                borderRadius: 2,
                p: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={32} color="#FFFFFF" />
            </Box>
            <Typography
              variant="h4"
              sx={{
                color: "#FFFFFF",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              LegalDocs Pro
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Panel - Form */}
      <Box
        sx={{
          flex: { xs: 1, md: "0 0 480px" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile Logo */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mb: 4,
            }}
          >
            <Box
              sx={{
                bgcolor: "#395B45",
                borderRadius: 2,
                p: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={24} color="#FFFFFF" />
            </Box>
            <Typography variant="h5" sx={{ color: "#1A1A1A", fontWeight: 700 }}>
              LegalDocs Pro
            </Typography>
          </Box>

          <Button
            component={Link}
            href="/login"
            startIcon={<ArrowLeft size={16} />}
            sx={{ mb: 3, color: "#666666", textTransform: "none" }}
          >
            Back to login
          </Button>

          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ mb: 4, textAlign: "left" }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "#1A1A1A", mb: 1 }}>
                  Reset Password
                </Typography>
                <Typography variant="body2" sx={{ color: "#666666" }}>
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
              
              {success ? (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Check your email for a link to reset your password. If it doesn&apos;t appear within a few minutes, check your spam folder.
                </Alert>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField
                      id="reset-email"
                      fullWidth
                      label="Email address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@lawfirm.co.uk"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Mail size={20} color="#9CA3AF" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      disabled={loading}
                      sx={{ py: 1.5, fontSize: "1rem", fontWeight: 600 }}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : "Send Reset Link"}
                    </Button>
                  </Box>
                </form>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
