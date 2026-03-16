import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check (Admins only)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check - only admin and super_admin can analyze templates
    const { data: userData } = await supabase
      .from("users")
      .select("role_id, roles(name)")
      .eq("id", user.id)
      .single();

    const roleName = (userData?.roles as any)?.name;
    if (roleName !== "admin" && roleName !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 2. Get File
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const zip = new PizZip(buffer);
    
    // 3. Extract tags from document.xml, headers, and footers
    const tags = new Set<string>();
    const tagRegex = /\{([a-zA-Z0-9_]+)\}/g;

    // Check all files in the zip for placeholders
    Object.keys(zip.files).forEach((path) => {
      // Only check XML files in the word/ directory
      if (path.startsWith("word/") && path.endsWith(".xml")) {
        const content = zip.files[path].asText();
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
          tags.add(match[1]);
        }
      }
    });

    return NextResponse.json({
      success: true,
      tags: Array.from(tags).sort(),
      fileName: file.name
    });

  } catch (error: any) {
    console.error("[Template Analyze Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze template" }, { status: 500 });
  }
}
