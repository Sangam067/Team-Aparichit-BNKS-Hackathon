import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function POST(request) {
  try {
    const body = await request.json();

    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    const result = db
      .prepare(`
        INSERT INTO users (name)
        VALUES (?)
      `)
      .run(name);

    const userId = Number(result.lastInsertRowid);

    const user = db
      .prepare(`
        SELECT id, name, created_at
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("User creation error:", error);

    return NextResponse.json(
      {
        error: "Failed to create user.",
        details: error.message, 
      },
      { status: 500 }
    );
  }
}


export async function GET() {
  try {
    const users = db
      .prepare(`
        SELECT id, name, created_at
        FROM users
        ORDER BY id DESC
      `)
      .all();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Users fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch users.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}