"use client";

import { useState, useEffect, useRef } from "react";
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
import { Eye, EyeOff, Scale, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
      setError("Please enter your email and password");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    const role = user?.app_metadata?.role as string | undefined;
    const dest = role === "super_admin" ? "/super-admin" : role === "admin" ? "/admin" : "/";
    router.push(dest);
    await new Promise((r) => setTimeout(r, 1500));
    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
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
              Welcome back
            </Typography>
            <Typography sx={{ color: "#6B7280", fontSize: "0.95rem" }}>
              Sign in to your account to continue
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                id="login-email"
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@lawfirm.co.uk"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail size={18} color="#9CA3AF" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#FFFFFF" } }}
              />

              <TextField
                id="login-password"
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={18} color="#9CA3AF" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" tabIndex={-1}>
                          {showPassword ? <EyeOff size={17} color="#9CA3AF" /> : <Eye size={17} color="#9CA3AF" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#FFFFFF" } }}
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <MuiLink href="/forgot-password" underline="hover" sx={{ fontSize: "0.85rem", color: "#395B45", fontWeight: 500 }}>
                  Forgot password?
                </MuiLink>
              </Box>

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
                {loading ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </Box>
          </form>

          <Typography variant="body2" sx={{ mt: 3.5, textAlign: "center", color: "#9CA3AF", fontSize: "0.78rem" }}>
            By signing in, you agree to our{" "}
            <MuiLink href="#" underline="hover" sx={{ color: "#6B7280" }}>Terms of Service</MuiLink>
            {" "}and{" "}
            <MuiLink href="#" underline="hover" sx={{ color: "#6B7280" }}>Privacy Policy</MuiLink>
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
