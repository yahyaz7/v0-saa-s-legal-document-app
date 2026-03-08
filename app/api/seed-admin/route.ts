"use server";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// This endpoint creates the initial admin user
// Should only be called once during setup
export async function POST() {
  try {
    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.some(
      (user) => user.email === "admin@gs.com"
    );

    if (adminExists) {
      return NextResponse.json(
        { message: "Admin user already exists" },
        { status: 200 }
      );
    }

    // Create admin user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@gs.com",
      password: "password123",
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: "Admin User",
        role: "admin",
      },
    });

    if (error) {
      console.error("Error creating admin:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update the profile to set admin role (trigger should have created profile)
    if (data.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ role: "admin", full_name: "Admin User" })
        .eq("id", data.user.id);
    }

    return NextResponse.json(
      { 
        message: "Admin user created successfully",
        email: "admin@gs.com",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Seed admin error:", err);
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 }
    );
  }
}
