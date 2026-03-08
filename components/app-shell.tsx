"use client";

import { useState, ReactNode, useEffect } from "react";
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

const navItems = [
  { text: "Dashboard", icon: LayoutDashboard, href: "/" },
  { text: "New Document", icon: FilePlus, href: "/new-document" },
  { text: "Templates", icon: FileText, href: "/templates" },
  { text: "Phrase Bank", icon: Library, href: "/phrase-bank" },
  { text: "Client List", icon: Users, href: "/clients" },
  { text: "Documents", icon: FolderOpen, href: "/documents" },
  { text: "Settings", icon: Settings, href: "/settings" },
];

interface AppShellProps {
  children: ReactNode;
}

const publicRoutes = ["/login", "/register", "/forgot-password"];

export function AppShell({ children }: AppShellProps) {
  console.log("[v0] AppShell rendering");
  const pathname = usePathname();
  console.log("[v0] pathname:", pathname);
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("?");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        const parts = user.email.split("@")[0].split(/[._-]/);
        const initials = parts
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() ?? "")
          .join("");
        setUserInitials(initials || user.email[0].toUpperCase());
      }
    });
  }, []);

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
  console.log("[v0] isPublicRoute:", isPublicRoute);
  if (isPublicRoute) {
    console.log("[v0] Returning children without shell");
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
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: "#395B45",
              letterSpacing: "-0.02em",
            }}
          >
            LegalDocs Pro
          </Typography>
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
                <MenuItem onClick={handleMenuClose}>
                  <User size={16} style={{ marginRight: 12 }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleMenuClose}>
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
