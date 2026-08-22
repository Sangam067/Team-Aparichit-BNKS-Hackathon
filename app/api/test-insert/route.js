import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function POST() {
  try {
    const insertSubject = db.prepare(`
      INSERT INTO subjects (name)
      VALUES (?)
    `);

    const result = insertSubject.run("Test Physics");

    return NextResponse.json({
      success: true,
      subjectId: Number(result.lastInsertRowid),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}