"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import { Eye, EyeOff, ShieldCheck, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/login-tone.wav");
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (user) {
      const role = user.app_metadata?.role;
      if (role !== "super_admin") {
        await supabase.auth.signOut();
        setError("Access denied. This portal is for Super Admins only.");
        setLoading(false);
        return;
      }
      router.push("/super-admin");
      await new Promise((r) => setTimeout(r, 1500));
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
    }

    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F8F9FA",
        p: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 480 }}>
        {/* Card */}
        <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Branding — inside the card */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <Box sx={{ bgcolor: "#395B45", borderRadius: 1.5, p: 1, display: "flex", flexShrink: 0 }}>
                  <ShieldCheck size={26} color="#FFFFFF" strokeWidth={2} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "#111827", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
                  Document Generation Tool
                </Typography>
              </Box>
              <Chip
                label="Super Admin Portal"
                size="small"
                sx={{
                  mt: 0.5,
                  bgcolor: "rgba(57,91,69,0.1)",
                  color: "#395B45",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  border: "1px solid rgba(57,91,69,0.2)",
                }}
              />
            </Box>

            {/* Sub-heading */}
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "#6B7280" }}>
                Sign in to access platform management
              </Typography>
            </Box>

            {/* Error */}
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
                {error}
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={20} color="#9CA3AF" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 600,
                    bgcolor: "#395B45",
                    "&:hover": { bgcolor: "#2D4A38" },
                    textTransform: "none",
                  }}
                >
                  {loading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <Typography
          variant="body2"
          sx={{ mt: 3, textAlign: "center", color: "#9CA3AF", fontSize: "0.75rem" }}
        >
          Secure access · All sign-in attempts are logged
        </Typography>
      </Box>
    </Box>
  );
}
