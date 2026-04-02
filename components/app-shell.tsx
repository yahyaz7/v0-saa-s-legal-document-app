"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
} from "@mui/material";
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Library,
  Users,
  FolderOpen,
  Settings,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const drawerWidth = 240;

// Base nav visible to all roles
const baseNavItems = [
  { text: "Dashboard", icon: LayoutDashboard, href: "/" },
  { text: "New Document", icon: FilePlus, href: "/new-document" },
  { text: "Templates", icon: FileText, href: "/templates" },
  { text: "Phrase Bank", icon: Library, href: "/phrase-bank" },
  { text: "Client List", icon: Users, href: "/clients" },
  { text: "Documents", icon: FolderOpen, href: "/documents" },
  { text: "Settings", icon: Settings, href: "/settings" },
];

// Extra nav visible to firm admins only
const adminNavItems = [
  { text: "Team", icon: Users, href: "/users" },
];

interface AppShellProps {
  children: ReactNode;
}

// Routes that render their own shell — AppShell must not wrap them
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/super-admin", "/admin"];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("?");
  const [userRole, setUserRole] = useState<string>("");
  const [firmName, setFirmName] = useState<string>("LegalDocs Pro");
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        setUserRole((user.app_metadata?.role as string) ?? "");
        const parts = user.email.split("@")[0].split(/[._-]/);
        const initials = parts
          .slice(0, 2)
          .map((p: string) => p[0]?.toUpperCase() ?? "")
          .join("");
        setUserInitials(initials || user.email[0].toUpperCase());

        // Fetch the firm's name + logo — cookies are sent automatically (same-origin)
        const res = await fetch("/api/firm-info");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.name) setFirmName(json.data.name);
          if (json.data?.logo_url) setFirmLogoUrl(json.data.logo_url);
        }
      }
    });
  }, []);

  const navItems = userRole === "admin"
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    handleMenuClose();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Don't render shell for public routes (login, register, etc.)
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Permanent Left Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#FFFFFF",
          },
        }}
      >
        {/* Logo Area */}
        <Box sx={{ p: 2, borderBottom: "1px solid #E0E0E0" }}>
          {firmLogoUrl ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 40 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={firmLogoUrl}
                alt={firmName}
                style={{
                  maxHeight: 40,
                  maxWidth: 150,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </Box>
          ) : (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: "#395B45",
                letterSpacing: "-0.02em",
                fontSize: "1rem",
                lineHeight: 1.3,
              }}
            >
              {firmName}
            </Typography>
          )}
        </Box>

        {/* Navigation List */}
        <List sx={{ pt: 2 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <ListItem key={item.text} disablePadding sx={{ px: 1, mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  sx={{
                    borderRadius: 1,
                    backgroundColor: isActive ? "rgba(57, 91, 69, 0.08)" : "transparent",
                    color: isActive ? "#395B45" : "#666666",
                    "&:hover": {
                      backgroundColor: isActive
                        ? "rgba(57, 91, 69, 0.12)"
                        : "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? "#395B45" : "#666666",
                    }}
                  >
                    <Icon size={20} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
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
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F5F5",
        }}
      >
        {/* Top AppBar */}
        <AppBar
          position="static"
          sx={{
            backgroundColor: "#FFFFFF",
            color: "#1A1A1A",
          }}
          elevation={0}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Document Automation
            </Typography>

            {/* User Avatar + Dropdown */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.75,
                  "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" },
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#395B45",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {userInitials}
                </Avatar>
                <Box sx={{ ml: 1.5, textAlign: "left", display: { xs: "none", sm: "block" } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {userEmail}
                  </Typography>
                </Box>
                <ChevronDown size={16} style={{ marginLeft: 8, color: "#666666" }} />
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{
                  sx: { mt: 1, minWidth: 180 },
                }}
              >
                <MenuItem component={Link} href="/settings?tab=profile" onClick={handleMenuClose}>
                  <User size={16} style={{ marginRight: 12 }} />
                  Profile
                </MenuItem>
                <MenuItem component={Link} href="/settings" onClick={handleMenuClose}>
                  <Settings size={16} style={{ marginRight: 12 }} />
                  Settings
                </MenuItem>
                <MenuItem onClick={handleSignOut} sx={{ color: "#D32F2F" }}>
                  <LogOut size={16} style={{ marginRight: 12 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, p: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
}
