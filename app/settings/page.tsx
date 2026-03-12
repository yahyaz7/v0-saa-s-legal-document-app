"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Grid,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Avatar,
} from "@mui/material";
import { Building2, Users, Sparkles, Database, Plus, Edit2, Trash2, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ py: 3 }}>
      {value === index && children}
    </Box>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Invited";
}

const mockUsers: User[] = [
  { id: "1", name: "John Doe", email: "john.doe@lawfirm.co.uk", role: "Admin", status: "Active" },
  { id: "2", name: "Sarah Smith", email: "sarah.smith@lawfirm.co.uk", role: "Solicitor", status: "Active" },
  { id: "3", name: "Michael Brown", email: "m.brown@lawfirm.co.uk", role: "Paralegal", status: "Active" },
  { id: "4", name: "Emily Wilson", email: "e.wilson@lawfirm.co.uk", role: "Solicitor", status: "Invited" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "profile" ? 0 : 1;
  
  const [tabValue, setTabValue] = useState(initialTab);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ id: "", name: "", email: "" });
  
  const [firmProfile, setFirmProfile] = useState({
    firmName: "Smith & Partners LLP",
    address: "123 Legal Lane, London, EC1A 1BB",
    phone: "+44 20 7123 4567",
    email: "info@smithpartners.co.uk",
    sraNumber: "123456",
  });
  const [aiSettings, setAiSettings] = useState({
    enableExtraction: true,
    enablePhrases: true,
    storeSourceText: false,
  });

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("users").select("id, name, email").eq("id", user.id).single();
        if (data) {
          setUserProfile(data);
        } else {
          setUserProfile({ id: user.id, name: user.user_metadata?.full_name || "", email: user.email || "" });
        }
      }
      setProfileLoading(false);
    }
    loadProfile();
  }, []);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveProfile = async () => {
    if (!userProfile.id) return;
    setSaveLoading(true);
    const supabase = createClient();
    await supabase.from("users").update({ name: userProfile.name }).eq("id", userProfile.id);
    await supabase.auth.updateUser({ data: { full_name: userProfile.name } });
    setSaveLoading(false);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "#1A1A1A" }}>
          Settings
        </Typography>
        <Typography variant="body1" sx={{ color: "#666666" }}>
          Manage your firm profile and application settings.
        </Typography>
      </Box>

      {/* Settings Tabs */}
      <Paper sx={{ overflow: "hidden" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom: "1px solid #E0E0E0",
            px: 2,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
              minHeight: 56,
            },
          }}
        >
          <Tab icon={<UserIcon size={18} />} iconPosition="start" label="My Profile" />
          <Tab icon={<Building2 size={18} />} iconPosition="start" label="Firm Profile" />
          <Tab icon={<Users size={18} />} iconPosition="start" label="Users" />
          <Tab icon={<Sparkles size={18} />} iconPosition="start" label="AI Settings" />
          <Tab icon={<Database size={18} />} iconPosition="start" label="Data & Backup" />
        </Tabs>

        {/* My Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ px: 3, maxWidth: 600 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Personal Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                  disabled={profileLoading}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={userProfile.email}
                  disabled
                  helperText="Your email address cannot be changed."
                />
              </Grid>
              <Grid item xs={12}>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleSaveProfile}
                  disabled={saveLoading || profileLoading}
                >
                  {saveLoading ? "Saving..." : "Save Profile"}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Firm Profile Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ px: 3, maxWidth: 600 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Firm Name"
                  value={firmProfile.firmName}
                  onChange={(e) => setFirmProfile({ ...firmProfile, firmName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={firmProfile.address}
                  onChange={(e) => setFirmProfile({ ...firmProfile, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={firmProfile.phone}
                  onChange={(e) => setFirmProfile({ ...firmProfile, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={firmProfile.email}
                  onChange={(e) => setFirmProfile({ ...firmProfile, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="SRA Number"
                  value={firmProfile.sraNumber}
                  onChange={(e) => setFirmProfile({ ...firmProfile, sraNumber: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="primary">
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Team Members
              </Typography>
              <Button variant="contained" color="primary" startIcon={<Plus size={16} />}>
                Invite User
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#F9F9F9" }}>
                    <TableCell sx={{ fontWeight: 600, color: "#666666" }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#666666" }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#666666" }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockUsers.map((user) => (
                    <TableRow key={user.id} sx={{ "&:hover": { backgroundColor: "#FAFAFA" } }}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Avatar sx={{ width: 36, height: 36, backgroundColor: "#395B45", fontSize: 14 }}>
                            {user.name.split(" ").map((n) => n[0]).join("")}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {user.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#666666" }}>
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.status}
                          size="small"
                          color={user.status === "Active" ? "success" : "default"}
                          sx={{ fontSize: 12 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" sx={{ color: "#666666" }}>
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton size="small" sx={{ color: "#D32F2F" }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        {/* AI Settings Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ px: 3, maxWidth: 600 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              AI Features
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={aiSettings.enableExtraction}
                      onChange={(e) => setAiSettings({ ...aiSettings, enableExtraction: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        Enable AI Extraction
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#666666" }}>
                        Automatically extract fields from pasted source text.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", m: 0 }}
                />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={aiSettings.enablePhrases}
                      onChange={(e) => setAiSettings({ ...aiSettings, enablePhrases: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        Enable Phrase Suggestions
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#666666" }}>
                        Show AI-powered phrase suggestions while drafting documents.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", m: 0 }}
                />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={aiSettings.storeSourceText}
                      onChange={(e) => setAiSettings({ ...aiSettings, storeSourceText: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        Store Source Text
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#666666" }}>
                        Keep copies of pasted source text for reference.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", m: 0 }}
                />
              </Paper>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button variant="contained" color="primary">
                Save Settings
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* Data & Backup Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ px: 3, maxWidth: 600 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Data Management
            </Typography>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Export Data
              </Typography>
              <Typography variant="body2" sx={{ color: "#666666", mb: 2 }}>
                Download a complete backup of all your documents, templates, and client data.
              </Typography>
              <Button variant="outlined" color="primary">
                Export All Data
              </Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Import Data
              </Typography>
              <Typography variant="body2" sx={{ color: "#666666", mb: 2 }}>
                Restore data from a previous backup file.
              </Typography>
              <Button variant="outlined" color="primary">
                Import Backup
              </Button>
            </Paper>

            <Divider sx={{ my: 3 }} />

            <Paper variant="outlined" sx={{ p: 3, borderColor: "#D32F2F" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: "#D32F2F" }}>
                Danger Zone
              </Typography>
              <Typography variant="body2" sx={{ color: "#666666", mb: 2 }}>
                Permanently delete all data. This action cannot be undone.
              </Typography>
              <Button variant="outlined" color="error">
                Delete All Data
              </Button>
            </Paper>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}>Loading Settings...</Box>}>
      <SettingsContent />
    </Suspense>
  );
}
