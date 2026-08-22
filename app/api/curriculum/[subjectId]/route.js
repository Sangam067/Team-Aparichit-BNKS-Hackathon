import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function GET(request, { params }) {
  try {
    const { subjectId } = await params;

    const id = Number(subjectId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          error: "Invalid subject ID.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------
    // Get subject
    // -----------------------------

    const subject = db
      .prepare(`
        SELECT
          id,
          name,
          created_at
        FROM subjects
        WHERE id = ?
      `)
      .get(id);

    if (!subject) {
      return NextResponse.json(
        {
          error: "Subject not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------
    // Get chapters
    // -----------------------------

    const chapters = db
      .prepare(`
        SELECT
          id,
          name,
          chapter_number
        FROM chapters
        WHERE subject_id = ?
        ORDER BY chapter_number ASC, id ASC
      `)
      .all(id);

    // -----------------------------
    // Get topics
    // -----------------------------

    const getTopics = db.prepare(`
      SELECT
        id,
        name,
        order_index
      FROM topics
      WHERE chapter_id = ?
      ORDER BY order_index ASC, id ASC
    `);

    // -----------------------------
    // Build hierarchy
    // -----------------------------

    const result = {
      id: subject.id,
      name: subject.name,
      createdAt: subject.created_at,

      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        chapterNumber: chapter.chapter_number,
        name: chapter.name,

        topics: getTopics
          .all(chapter.id)
          .map((topic) => ({
            id: topic.id,
            name: topic.name,
            orderIndex: topic.order_index,
          })),
      })),
    };

    return NextResponse.json({
      success: true,
      subject: result,
    });
  } catch (error) {
    console.error("Curriculum API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch curriculum.",
        details: error.message,
      },
      {
        status: 500,
      }
    );
  }
}