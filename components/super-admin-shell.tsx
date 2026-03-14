"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ChevronDown,
  User,
  Settings,
  KeyRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DRAWER_WIDTH = 240;

const navItems = [
  { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Header dropdown state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // User info
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("SA");

  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Password-change dialog state
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        const name: string =
          (user.user_metadata?.full_name as string) || user.email;
        const parts = name.split(/[\s._@-]/);
        setUserInitials(
          parts
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("") || user.email[0].toUpperCase()
        );
      }
    });
  }, []);

  const handleSignOut = async () => {
    setAnchorEl(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/super-admin/login");
  };

  const openProfileDialog = () => {
    setAnchorEl(null);
    setProfileDialogOpen(true);
  };

  const openPasswordDialog = () => {
    setAnchorEl(null);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwError("");
    setPwSuccess("");
    setPwDialogOpen(true);
  };

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess("");

    if (!currentPw || !newPw || !confirmPw) {
      setPwError("All fields are required.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }

    setPwLoading(true);
    const supabase = createClient();

    // Re-authenticate with current password first
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    });

    if (reAuthError) {
      setPwError("Current password is incorrect.");
      setPwLoading(false);
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
    });

    setPwLoading(false);

    if (updateError) {
      setPwError(updateError.message);
      return;
    }

    setPwSuccess("Password updated successfully.");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            backgroundColor: "#FFFFFF",
            borderRight: "1px solid #E0E0E0",
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ p: 2, borderBottom: "1px solid #E0E0E0", display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ bgcolor: "rgba(57, 91, 69, 0.1)", borderRadius: 1.5, p: 0.75, display: "flex" }}>
            <ShieldCheck size={20} color="#395B45" />
          </Box>
          <Box>
            <Typography sx={{ color: "#395B45", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              LegalDocs Pro
            </Typography>
            <Typography sx={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Super Admin
            </Typography>
          </Box>
        </Box>

        {/* Nav */}
        <List sx={{ pt: 2, px: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/super-admin"
                ? pathname === "/super-admin"
                : pathname.startsWith(item.href);

            return (
              <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => router.push(item.href)}
                  sx={{
                    borderRadius: 1,
                    color: isActive ? "#395B45" : "#666666",
                    backgroundColor: isActive ? "rgba(57, 91, 69, 0.08)" : "transparent",
                    "&:hover": {
                      backgroundColor: isActive
                        ? "rgba(57, 91, 69, 0.12)"
                        : "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                    <Icon size={20} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 600 : 500 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Sign out at bottom */}
        <Box sx={{ mt: "auto", p: 1, borderTop: "1px solid #E0E0E0" }}>
          <ListItemButton
            onClick={handleSignOut}
            sx={{
              borderRadius: 1,
              color: "#9CA3AF",
              "&:hover": { backgroundColor: "rgba(220,38,38,0.06)", color: "#DC2626" },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
              <LogOut size={18} />
            </ListItemIcon>
            <ListItemText
              primary="Sign Out"
              primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* ── Main ────────────────────────────────────────────────── */}
      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", bgcolor: "#F5F5F5" }}>
        {/* Top bar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: "#FFFFFF", borderBottom: "1px solid #E0E0E0", color: "#1A1A1A" }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#1A1A1A" }}>
              Platform Administration
            </Typography>

            {/* Profile button */}
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ borderRadius: 2, px: 1.5, py: 0.75, "&:hover": { bgcolor: "rgba(0,0,0,0.04)" } }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#395B45", fontSize: 13, fontWeight: 700 }}>
                {userInitials}
              </Avatar>
              <ChevronDown size={16} style={{ marginLeft: 8, color: "#666666" }} />
            </IconButton>

            {/* Dropdown menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ sx: { mt: 1, minWidth: 210, borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
            >
              {/* Email header */}
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="caption" sx={{ color: "#9CA3AF", display: "block", mb: 0.25 }}>
                  Signed in as
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827", fontSize: "0.8rem", wordBreak: "break-all" }}>
                  {userEmail}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                onClick={openProfileDialog}
                sx={{ fontSize: "0.875rem", color: "#374151", gap: 1.5, py: 1.25 }}
              >
                <User size={15} />
                Profile &amp; Security
              </MenuItem>
              <MenuItem
                onClick={openPasswordDialog}
                sx={{ fontSize: "0.875rem", color: "#374151", gap: 1.5, py: 1.25 }}
              >
                <Settings size={15} />
                Change Password
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleSignOut}
                sx={{ fontSize: "0.875rem", color: "#DC2626", gap: 1.5, py: 1.25 }}
              >
                <LogOut size={15} />
                Sign Out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flexGrow: 1, p: 3 }}>{children}</Box>
      </Box>

      {/* ── Profile Dialog ─────────────────────────────────── */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <User size={18} color="#395B45" />
            Profile &amp; Security
          </Box>
          <IconButton size="small" onClick={() => setProfileDialogOpen(false)} sx={{ color: "#9CA3AF" }}>
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, gap: 2 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: "#395B45",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
                {userEmail.split("@")[0]}
              </Typography>
              <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
                {userEmail}
              </Typography>
            </Box>
            <Chip
              label="Super Admin"
              size="small"
              sx={{
                bgcolor: "rgba(57,91,69,0.1)",
                color: "#395B45",
                fontWeight: 600,
                fontSize: "0.75rem",
                border: "1px solid rgba(57,91,69,0.25)",
              }}
            />
          </Box>
          <Box
            sx={{
              mt: 1,
              p: 2,
              bgcolor: "#F9FAFB",
              borderRadius: 2,
              border: "1px solid #E5E7EB",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {[
              { label: "Email", value: userEmail },
              { label: "Role", value: "Super Administrator" },
              { label: "Portal", value: "Platform Management" },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="caption" sx={{ color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ color: "#374151", fontWeight: 500, textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => { setProfileDialogOpen(false); openPasswordDialog(); }}
            startIcon={<KeyRound size={14} />}
            sx={{
              bgcolor: "#395B45",
              "&:hover": { bgcolor: "#2D4A38" },
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Change Password Dialog ───────────────────────────── */}
      <Dialog
        open={pwDialogOpen}
        onClose={() => setPwDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <KeyRound size={18} color="#395B45" />
            Change Password
          </Box>
          <IconButton size="small" onClick={() => setPwDialogOpen(false)} sx={{ color: "#9CA3AF" }}>
            <X size={16} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "8px !important" }}>
          {pwError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5, fontSize: "0.83rem" }}>
              {pwError}
            </Alert>
          )}
          {pwSuccess && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5, fontSize: "0.83rem" }}>
              {pwSuccess}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Current Password"
              type="password"
              fullWidth
              size="small"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              size="small"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              helperText="Minimum 8 characters"
              autoComplete="new-password"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              size="small"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              error={confirmPw.length > 0 && confirmPw !== newPw}
              helperText={confirmPw.length > 0 && confirmPw !== newPw ? "Passwords do not match" : ""}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setPwDialogOpen(false)}
            disabled={pwLoading}
            sx={{ color: "#6B7280", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            startIcon={pwLoading ? <CircularProgress size={14} color="inherit" /> : <KeyRound size={14} />}
            sx={{
              bgcolor: "#395B45",
              "&:hover": { bgcolor: "#2D4A38" },
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            {pwLoading ? "Updating…" : "Update Password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
