"use client";

import { useState, useEffect } from "react";
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
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
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
    
    const { error } = await supabase.auth.updateUser({
      password: formData.password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#F8F9FA",
      }}
    >
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
            <Typography variant="h4" sx={{ color: "#FFFFFF", fontWeight: 700, letterSpacing: "-0.02em" }}>
              LegalDocs Pro
            </Typography>
          </Box>
        </Box>
      </Box>

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
          <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ mb: 4, textAlign: "left" }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "#1A1A1A", mb: 1 }}>
                  Set New Password
                </Typography>
                <Typography variant="body2" sx={{ color: "#666666" }}>
                  Please enter your new password below.
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
              
              {success ? (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Password successfully updated! Redirecting you to login...
                </Alert>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField
                      id="new-password"
                      fullWidth
                      label="New Password"
                      type={showPassword ? "text" : "password"}
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
                              <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      id="confirm-password"
                      fullWidth
                      label="Confirm Password"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock size={20} color="#9CA3AF" />
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
                      {loading ? <CircularProgress size={24} color="inherit" /> : "Update Password"}
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
