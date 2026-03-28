"use client";

import { useState, useEffect, Suspense } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Divider,
  Avatar,
  Skeleton,
  CircularProgress,
} from "@mui/material";
import { User as UserIcon, Lock, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function SettingsContent() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserId(user.id);
      setEmail(user.email ?? "");

      // Prefer users table full_name, fall back to auth metadata
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setName(data?.full_name ?? user.user_metadata?.full_name ?? "");
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile() {
    if (!userId) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from("users")
      .update({ full_name: name.trim() })
      .eq("id", userId);

    await supabase.auth.updateUser({ data: { full_name: name.trim() } });

    setProfileSaving(false);
    if (dbErr) {
      setProfileError("Failed to save. Please try again.");
    } else {
      setProfileSuccess("Profile updated successfully.");
    }
  }

  async function handleChangePassword() {
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword.trim()) { setPasswordError("New password is required."); return; }
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }

    setPasswordSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <Box sx={{ maxWidth: 1100 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827" }}>
          My Profile
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
          Manage your personal information and password
        </Typography>
      </Box>

      {/* Cards row */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>

      {/* Profile card */}
      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 340px", minWidth: 0 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box sx={{ bgcolor: "#F0FDF4", p: 1, borderRadius: 1.5 }}>
              <UserIcon size={18} color="#395B45" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
              Personal Information
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {/* Avatar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            {loading ? (
              <Skeleton variant="circular" width={56} height={56} />
            ) : (
              <Avatar
                sx={{
                  width: 56, height: 56,
                  bgcolor: "#395B45",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {initials || <UserIcon size={24} />}
              </Avatar>
            )}
            <Box>
              {loading ? (
                <>
                  <Skeleton width={140} height={22} />
                  <Skeleton width={200} height={18} sx={{ mt: 0.5 }} />
                </>
              ) : (
                <>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: "#111827" }}>
                    {name || "—"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#6B7280" }}>
                    {email}
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          {profileSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setProfileSuccess("")}>
              {profileSuccess}
            </Alert>
          )}
          {profileError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProfileError("")}>
              {profileError}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {loading ? (
              <>
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              </>
            ) : (
              <>
                <TextField
                  label="Full Name"
                  fullWidth
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  label="Email Address"
                  fullWidth
                  value={email}
                  disabled
                  helperText="Your email address cannot be changed here."
                />
              </>
            )}
            <Box>
              <Button
                variant="contained"
                startIcon={profileSaving ? <CircularProgress size={14} color="inherit" /> : <Save size={16} />}
                onClick={handleSaveProfile}
                disabled={profileSaving || loading || !name.trim()}
                sx={{ bgcolor: "#395B45", "&:hover": { bgcolor: "#2D4A38" } }}
              >
                {profileSaving ? "Saving…" : "Save Changes"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Change password card */}
      <Card elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, flex: "1 1 300px", minWidth: 0 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box sx={{ bgcolor: "#F0FDF4", p: 1, borderRadius: 1.5 }}>
              <Lock size={18} color="#395B45" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#111827" }}>
              Change Password
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPasswordSuccess("")}>
              {passwordSuccess}
            </Alert>
          )}
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPasswordError("")}>
              {passwordError}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Minimum 8 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Box>
              <Button
                variant="outlined"
                startIcon={passwordSaving ? <CircularProgress size={14} color="inherit" /> : <Lock size={16} />}
                onClick={handleChangePassword}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                sx={{ borderColor: "#395B45", color: "#395B45", "&:hover": { borderColor: "#2D4A38", bgcolor: "rgba(57,91,69,0.04)" } }}
              >
                {passwordSaving ? "Updating…" : "Update Password"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      </Box> {/* end cards row */}
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><CircularProgress /></Box>}>
      <SettingsContent />
    </Suspense>
  );
}
