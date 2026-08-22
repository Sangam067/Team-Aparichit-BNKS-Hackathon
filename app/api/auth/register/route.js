import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db.js";

export async function POST(request) {
  try {
    const body = await request.json();

    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "Name, email and password are required.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error: "Password must be at least 6 characters.",
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = db
      .prepare(`
        SELECT id
        FROM users
        WHERE email = ?
      `)
      .get(email);

    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      10
    );

    // Create user
    const result = db
      .prepare(`
        INSERT INTO users (
          name,
          email,
          password_hash
        )
        VALUES (?, ?, ?)
      `)
      .run(
        name,
        email,
        passwordHash
      );

    const userId = Number(
      result.lastInsertRowid
    );

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          id: userId,
          name,
          email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create account.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}