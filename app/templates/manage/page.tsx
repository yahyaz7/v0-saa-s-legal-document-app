import { redirect } from "next/navigation";

// Template management is an admin-only function.
// Staff users are redirected to the templates browse page.
export default function ManageTemplatesPage() {
  redirect("/templates");
}
