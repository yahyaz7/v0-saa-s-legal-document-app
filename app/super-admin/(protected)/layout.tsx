import { SuperAdminShell } from "@/components/super-admin-shell";

export default function SuperAdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
