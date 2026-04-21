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
  Users,
  Settings2,
  LogOut,
  ChevronDown,
  User,
  ShieldHalf,
  FileText,
  BookOpen,
  FolderOpen,
  BarChart2,
  Scale,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DRAWER_WIDTH = 240;

const navItems = [
  { label: "Overview",      href: "/admin",                icon: LayoutDashboard },
  { label: "Templates",     href: "/admin/templates",      icon: FileText },
  { label: "Phrase Bank",   href: "/admin/phrase-bank",    icon: BookOpen },
  { label: "Offences",      href: "/admin/offences",       icon: Scale },
  { label: "Documents",     href: "/admin/documents",      icon: FolderOpen },
  { label: "Analytics",     href: "/admin/analytics",      icon: BarChart2 },
  { label: "Team",          href: "/admin/users",          icon: Users },
  { label: "Firm Settings", href: "/admin/settings",       icon: Settings2 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("A");
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      const session = data.session;
      const user = session?.user;
      if (!user) return;
      setUserEmail(user.email ?? "");
      const full: string = (user.user_metadata?.full_name as string) || user.email || "";
      setUserName(full.split("@")[0]);
      const parts = full.split(/[\s._@-]/);
      setUserInitials(
        parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") ||
          (user.email?.[0]?.toUpperCase() ?? "A")
      );

      // Fetch firm details (logo + name) for sidebar
      if (session?.access_token) {
        const res = await fetch("/api/admin/firm", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const { data } = await res.json();
          if (data?.logo_url) setFirmLogoUrl(data.logo_url);
          if (data?.name) setFirmName(data.name);
        }
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
        <Box sx={{ p: 2, borderBottom: "1px solid #E0E0E0", display: "flex", alignItems: "center", gap: 1.5 }}>
          {firmLogoUrl ? (
            <Box
              component="img"
              src={firmLogoUrl}
              alt="Firm logo"
              sx={{ height: 36, maxWidth: 36, objectFit: "contain", borderRadius: 1 }}
            />
          ) : (
            <Box sx={{ bgcolor: "rgba(57, 91, 69, 0.1)", borderRadius: 1.5, p: 0.75, display: "flex" }}>
              <ShieldHalf size={20} color="#395B45" />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              title={firmName ?? "LegalDocs Pro"}
              sx={{ color: "#395B45", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {firmName
                ? firmName.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("")
                : "LegalDocs Pro"}
            </Typography>
            <Typography sx={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Firm Admin
            </Typography>
          </Box>
        </Box>

        {/* Nav */}
        <List sx={{ pt: 2, px: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href === "/admin/documents"
                  ? pathname.startsWith("/admin/documents") || pathname.startsWith("/admin/new-document")
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
              Firm Administration
            </Typography>

            {/* Profile — avatar + chevron only, no email in bar */}
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
                onClick={() => { setAnchorEl(null); router.push("/admin/settings"); }}
                sx={{ fontSize: "0.875rem", color: "#374151", gap: 1.5 }}
              >
                <User size={15} />
                Profile
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
