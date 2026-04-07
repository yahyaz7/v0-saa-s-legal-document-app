import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("roles(name)")
    .eq("id", user.id)
    .single();

  const role = (userData?.roles as any)?.name;
  if (role !== "admin" && role !== "super_admin") return null;
  return user;
}

// POST /api/admin/offences/import
// Body: FormData with "file" field (.xlsx, max 5 MB)
// Expected columns (case-insensitive): category, type, offence
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAdminUser(supabase);
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json({ error: "Only Excel files (.xlsx, .xls) are accepted" }, { status: 400 });
    }

    // Validate file size (5 MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds the 5 MB limit" }, { status: 400 });
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel file contains no sheets" }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel sheet is empty" }, { status: 400 });
    }

    // Normalise column headers to lowercase trimmed keys
    const normalised = rows.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.trim().toLowerCase()] = String(v ?? "").trim();
      }
      return out;
    });

    // Build insert batch — skip rows missing the required "offence" field
    const toInsert: { category: string; type: string; offence: string; uploaded_by: string }[] = [];
    let skipped = 0;

    for (const row of normalised) {
      const offenceVal = row["offence"] ?? "";
      if (!offenceVal) { skipped++; continue; }

      toInsert.push({
        category: row["category"] ?? "",
        type: row["type"] ?? "",
        offence: offenceVal,
        uploaded_by: user.id,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json(
        { error: `No valid rows found. All ${skipped} rows were missing the required "offence" column.` },
        { status: 400 }
      );
    }

    // Batch insert in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error } = await supabase
        .from("offences")
        .insert(toInsert.slice(i, i + CHUNK));
      if (error) throw error;
    }

    return NextResponse.json(
      { success: true, data: { inserted: toInsert.length, skipped } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
  }
}
