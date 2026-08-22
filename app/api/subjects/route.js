import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function GET() {
  try {
    const subjects = db
      .prepare(`
        SELECT
          id,
          name,
          created_at
        FROM subjects
        ORDER BY name ASC
      `)
      .all();

    return NextResponse.json({
      success: true,
      subjects,
    });
  } catch (error) {
    console.error("Subjects API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch subjects.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}