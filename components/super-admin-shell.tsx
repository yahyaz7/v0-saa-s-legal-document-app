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
} from "@mui/material";
import {
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ChevronDown,
  User,
  Settings,
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("SA");

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
    router.push("/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar — matches app theme */}
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
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                    }}
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

            {/* Profile — right corner only */}
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ borderRadius: 2, px: 1.5, py: 0.75, "&:hover": { bgcolor: "rgba(0,0,0,0.04)" } }}
            >
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: "#395B45", fontSize: 13, fontWeight: 700 }}
              >
                {userInitials}
              </Avatar>
              <ChevronDown size={16} style={{ marginLeft: 8, color: "#666666" }} />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ sx: { mt: 1, minWidth: 200 } }}
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
                onClick={() => setAnchorEl(null)}
                sx={{ fontSize: "0.875rem", color: "#374151", gap: 1.5 }}
              >
                <User size={15} />
                Profile
              </MenuItem>
              <MenuItem
                onClick={() => setAnchorEl(null)}
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
