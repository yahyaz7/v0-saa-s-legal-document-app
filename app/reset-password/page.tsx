"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Link as MuiLink,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { Lock, Eye, EyeOff, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: formData.password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push("/login"), 3000);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F7F8FA",
      }}
    >
      {/* Top bar */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: 3.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        <Box sx={{ bgcolor: "#395B45", borderRadius: 1.5, p: 1, display: "flex", flexShrink: 0 }}>
          <Scale size={28} color="#FFFFFF" />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: "2rem", color: "#111827", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
          LexDGT
        </Typography>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 400 }}>

          {/* Heading */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827", letterSpacing: "-0.025em", mb: 0.75 }}>
              Set new password
            </Typography>
            <Typography sx={{ color: "#6B7280", fontSize: "0.95rem" }}>
              Enter a strong password to secure your account.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 1.5 }}>
              Password updated successfully! Redirecting you to login&hellip;
            </Alert>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  id="new-password"
                  fullWidth
                  label="New password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={18} color="#9CA3AF" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                            {showPassword ? <EyeOff size={17} color="#9CA3AF" /> : <Eye size={17} color="#9CA3AF" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#FFFFFF" } }}
                />

                <TextField
                  id="confirm-password"
                  fullWidth
                  label="Confirm password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={18} color="#9CA3AF" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small">
                            {showConfirm ? <EyeOff size={17} color="#9CA3AF" /> : <Eye size={17} color="#9CA3AF" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#FFFFFF" } }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{
                    mt: 0.5,
                    py: 1.4,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    bgcolor: "#395B45",
                    "&:hover": { bgcolor: "#2D4A38" },
                    textTransform: "none",
                    borderRadius: 1.5,
                    boxShadow: "0 1px 3px rgba(57,91,69,0.3)",
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : "Update Password"}
                </Button>
              </Box>
            </form>
          )}

          <Typography variant="body2" sx={{ mt: 3.5, textAlign: "center", color: "#9CA3AF", fontSize: "0.82rem" }}>
            Remember your password?{" "}
            <MuiLink href="/login" underline="hover" sx={{ color: "#395B45", fontWeight: 600 }}>
              Sign in
            </MuiLink>
          </Typography>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Divider sx={{ mb: 2.5 }} />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
          <Typography sx={{ color: "#9CA3AF", fontSize: "0.8rem", letterSpacing: "0.02em" }}>
            Powered by
          </Typography>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taqniya-logo.jpeg" alt="Taqniya" style={{ height: 32, objectFit: "contain", opacity: 0.7, borderRadius: 6 }} />
        </Box>
      </Box>
    </Box>
  );
}
