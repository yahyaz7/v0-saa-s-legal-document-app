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
  IconButton,
  Link as MuiLink,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Eye, EyeOff, Scale, Mail, Lock, FileText, Sparkles, BookOpen, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (role === "super_admin") {
      router.push("/super-admin");
      return;
    }

    if (role === "admin") {
      router.push("/admin");
      return;
    }

    // Staff go straight to the app
    router.push("/");
  };

  const features = [
    { icon: FileText, label: "Smart Templates", desc: "Build documents from intelligent legal templates" },
    { icon: Sparkles, label: "AI Assistance", desc: "AI-powered phrase suggestions as you write" },
    { icon: BookOpen, label: "Phrase Bank", desc: "Reuse your firm's best-approved clauses" },
    { icon: Users, label: "Client Portal", desc: "Manage clients and documents in one place" },
  ];

  return (
    <Box sx={{ height: "100vh", display: "flex", bgcolor: "#F8F9FA", overflow: "hidden" }}>

      {/* ── Left: Branding — 60% ─────────────────────────────── */}
      <Box
        sx={{
          flex: "0 0 60%",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          bgcolor: "#395B45",
          p: { md: 4, lg: 6 },
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle pattern */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        {/* Glow blob */}
        <Box
          sx={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.04)",
            right: -150,
            top: -100,
          }}
        />

        <Box sx={{ position: "relative", maxWidth: 520 }}>
          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                borderRadius: 1.5,
                p: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={24} color="#FFFFFF" />
            </Box>
            <Typography
              variant="h5"
              sx={{ color: "#FFFFFF", fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              LegalDocs Pro
            </Typography>
          </Box>

          {/* Headline */}
          <Typography
            variant="h4"
            sx={{
              color: "#FFFFFF",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              mb: 1.5,
            }}
          >
            Professional document automation for UK law firms
          </Typography>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.95rem",
              lineHeight: 1.65,
              mb: 3,
            }}
          >
            Streamline your legal workflows with intelligent templates,
            AI-powered suggestions, and seamless client management.
          </Typography>

          {/* Feature grid */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {features.map(({ icon: Icon, label, desc }) => (
              <Box
                key={label}
                sx={{
                  bgcolor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 1.5,
                  p: 1.5,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.12)",
                    mt: 0.25,
                  }}
                >
                  <Icon size={15} color="#FFFFFF" />
                </Box>
                <Box>
                  <Typography sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "0.8rem", mb: 0.2 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.73rem", lineHeight: 1.45 }}>
                    {desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Right: Form — 40% ────────────────────────────────── */}
      <Box
        sx={{
          flex: { xs: 1, md: "0 0 40%" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: { xs: 3, sm: 4, lg: 5 },
          bgcolor: "#FFFFFF",
          overflowY: "auto",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          {/* Mobile-only logo */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1.5,
              mb: 4,
              justifyContent: "center",
            }}
          >
            <Box sx={{ bgcolor: "#395B45", borderRadius: 1.5, p: 1, display: "flex" }}>
              <Scale size={22} color="#FFFFFF" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1A1A1A" }}>
              LegalDocs Pro
            </Typography>
          </Box>

          {/* Heading */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", mb: 0.75, letterSpacing: "-0.02em" }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280" }}>
              Sign in to your account to continue
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
                        <Mail size={20} color="#9CA3AF" />
                      </InputAdornment>
                    ),
                  },
                }}
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

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -1 }}>
                <MuiLink
                  href="/forgot-password"
                  underline="hover"
                  sx={{ fontSize: "0.875rem", color: "#395B45", fontWeight: 500 }}
                >
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
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: 600,
                  bgcolor: "#395B45",
                  "&:hover": { bgcolor: "#2D4A38" },
                  textTransform: "none",
                  borderRadius: 1.5,
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </Box>
          </form>

          {/* Footer */}
          <Typography
            variant="body2"
            sx={{ mt: 4, textAlign: "center", color: "#9CA3AF", fontSize: "0.78rem" }}
          >
            By signing in, you agree to our{" "}
            <MuiLink href="#" underline="hover" sx={{ color: "#6B7280" }}>Terms of Service</MuiLink>
            {" "}and{" "}
            <MuiLink href="#" underline="hover" sx={{ color: "#6B7280" }}>Privacy Policy</MuiLink>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
