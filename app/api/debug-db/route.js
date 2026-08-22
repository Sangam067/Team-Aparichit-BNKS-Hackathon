import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function GET() {
  const tables = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `)
    .all();

  return NextResponse.json({
    database: db.name,
    tables,
  });
}