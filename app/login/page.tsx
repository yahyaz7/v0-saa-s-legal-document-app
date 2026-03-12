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
import { Eye, EyeOff, Scale, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { BookOpeningIntro } from "@/components/book-opening-intro";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleIntroComplete = () => {
    router.push("/");
  };

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
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowIntro(true);
  };

  return (
    <>
      {/* Book Opening Intro Animation */}
      <BookOpeningIntro
        isOpen={showIntro}
        onComplete={handleIntroComplete}
        firmName="Gray's Defence Solicitors"
        accentColor="#B8860B"
      />

      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          bgcolor: "#F8F9FA",
        }}
      >
      {/* Left Panel - Branding */}
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
        {/* Background Pattern */}
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
          {/* Logo */}
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

          <Typography
            variant="h5"
            sx={{
              color: "#FFFFFF",
              fontWeight: 500,
              mb: 2,
              lineHeight: 1.4,
            }}
          >
            Professional Document Automation for UK Law Firms
          </Typography>

          <Typography
            sx={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "1rem",
              lineHeight: 1.6,
            }}
          >
            Streamline your legal document workflows with intelligent templates,
            AI-powered phrase suggestions, and seamless client management.
          </Typography>

          {/* Feature Pills */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4, justifyContent: "center" }}>
            {["Smart Templates", "AI Assistance", "Phrase Bank", "Client Portal"].map((feature) => (
              <Box
                key={feature}
                sx={{
                  bgcolor: "rgba(255, 255, 255, 0.15)",
                  color: "#FFFFFF",
                  px: 2,
                  py: 0.75,
                  borderRadius: 3,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {feature}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right Panel - Login Form */}
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
            <Typography
              variant="h5"
              sx={{
                color: "#1A1A1A",
                fontWeight: 700,
              }}
            >
              LegalDocs Pro
            </Typography>
          </Box>

          <Card
            elevation={0}
            sx={{
              border: "1px solid #E5E7EB",
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ mb: 4, textAlign: "center" }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: "#1A1A1A",
                    mb: 1,
                  }}
                >
                  Welcome back
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#666666" }}
                >
                  Sign in to your account to continue
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <TextField
                    id="login-email"
                    fullWidth
                    label="Email address"
                    type="email"
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
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <MuiLink
                      href="/forgot-password"
                      underline="hover"
                      sx={{
                        fontSize: "0.875rem",
                        color: "#395B45",
                        fontWeight: 500,
                      }}
                    >
                      Forgot password?
                    </MuiLink>
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    disabled={loading}
                    sx={{
                      py: 1.5,
                      fontSize: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </Box>
              </form>

              <Box sx={{ mt: 3, textAlign: "center" }}>
                <Typography variant="body2" sx={{ color: "#666666" }}>
                  {"Don't have an account? "}
                  <MuiLink
                    href="/register"
                    underline="hover"
                    sx={{
                      color: "#395B45",
                      fontWeight: 600,
                    }}
                  >
                    Contact your administrator
                  </MuiLink>
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Typography
            variant="body2"
            sx={{
              mt: 4,
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: "0.75rem",
            }}
          >
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Typography>
        </Box>
      </Box>
      </Box>
    </>
  );
}
