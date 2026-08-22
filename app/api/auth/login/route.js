import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db.js";

export async function POST(request) {
  try {
    const body = await request.json();

    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    // -----------------------------
    // Validate input
    // -----------------------------

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------
    // Find user
    // -----------------------------

    const user = db
      .prepare(`
        SELECT
          id,
          name,
          email,
          password_hash,
          created_at
        FROM users
        WHERE email = ?
      `)
      .get(email);

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    // -----------------------------
    // Check password
    // -----------------------------

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    // -----------------------------
    // Return safe user data
    // -----------------------------

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to login.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}