import { createClient } from "@supabase/supabase-js";

/**
 * Admin Client (Service Role)
 * 
 * USE WITH EXTREME CAUTION.
 * This client bypasses all Row Level Security (RLS) policies.
 * Only use this inside protected API routes after manually verifying 
 * the user's role and permissions.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
