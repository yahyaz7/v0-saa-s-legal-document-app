"use client";

import { useState, useEffect, type ReactNode } from "react";
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
} from "@mui/material";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  Scale,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DRAWER_WIDTH = 240;

const navItems = [
  { label: "Dashboard",    href: "/",              icon: LayoutDashboard },
  { label: "Templates",    href: "/templates",     icon: FileText },
  { label: "My Documents", href: "/documents",     icon: FolderOpen },
  { label: "Phrase Bank",  href: "/phrase-bank",   icon: BookOpen },
  { label: "Settings",     href: "/settings",      icon: Settings },
];

// Routes that render their own full-page layout — StaffShell must not wrap them
const SHELL_EXCLUDED = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/super-admin",
  "/admin",
];

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [firmName, setFirmName] = useState<string | null>(null);
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");
      const full: string = (user.user_metadata?.full_name as string) || user.email || "";
      setUserName(full.split("@")[0]);
      const parts = full.split(/[\s._@-]/);
      setUserInitials(
        parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") ||
          (user.email?.[0]?.toUpperCase() ?? "U")
      );

      // Fetch firm name + logo (cookies sent automatically — same-origin)
      const res = await fetch("/api/firm-info");
      if (res.ok) {
        const json = await res.json();
        if (json.data?.name) setFirmName(json.data.name);
        if (json.data?.logo_url) setFirmLogoUrl(json.data.logo_url);
      }
    });
  }, []);

  const handleSignOut = async () => {
    setAnchorEl(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Don't render shell for non-staff pages
  const excluded = SHELL_EXCLUDED.some((r) => pathname.startsWith(r));
  if (excluded) return <>{children}</>;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
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
        <Box sx={{ p: 2, borderBottom: "1px solid #E0E0E0", display: "flex", alignItems: "center", gap: 1.5, minHeight: 60 }}>
          {firmName === null ? null : (
            <>
              {firmLogoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={firmLogoUrl}
                  alt={firmName}
                  style={{ maxHeight: 36, width: 36, objectFit: "contain", display: "block", flexShrink: 0 }}
                />
              ) : (
                <Box sx={{ bgcolor: "rgba(57, 91, 69, 0.1)", borderRadius: 1.5, p: 0.75, display: "flex", flexShrink: 0 }}>
                  <Scale size={20} color="#395B45" />
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                  color: "#395B45", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.2,
                  letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {firmName}
                </Typography>
                <Typography sx={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Staff Portal
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Nav */}
        <List sx={{ pt: 2, px: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
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

      {/* Main */}
      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", bgcolor: "#F5F5F5" }}>
        {/* Top AppBar — profile in right corner only */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: "#FFFFFF", borderBottom: "1px solid #E0E0E0", color: "#1A1A1A" }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#1A1A1A" }}>
              Document Automation
            </Typography>

            {/* Profile — avatar + chevron only */}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                borderRadius: 2,
                px: 1.5,
                py: 0.75,
                "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#395B45", fontSize: 13, fontWeight: 700 }}>
                {userInitials}
              </Avatar>
              <ChevronDown size={16} color="#666666" />
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ sx: { mt: 1, minWidth: 200 } }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#111827" }}>
                  {userName}
                </Typography>
                <Typography variant="caption" sx={{ color: "#9CA3AF", wordBreak: "break-all" }}>
                  {userEmail}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                onClick={() => { setAnchorEl(null); router.push("/settings"); }}
                sx={{ fontSize: "0.875rem", color: "#374151", gap: 1.5 }}
              >
                <Settings size={15} />
                Settings
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleSignOut}
                sx={{ fontSize: "0.875rem", color: "#DC2626", gap: 1.5 }}
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
    </Box>
  );
}
