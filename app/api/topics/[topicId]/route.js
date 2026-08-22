import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function GET(request, { params }) {
  try {
    const { topicId } = await params;
    const id = Number(topicId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid topic ID." },
        { status: 400 }
      );
    }

    const topic = db
      .prepare(`
        SELECT
          t.id,
          t.name,
          t.order_index,
          c.id AS chapter_id,
          c.name AS chapter_name,
          c.chapter_number,
          s.id AS subject_id,
          s.name AS subject_name
        FROM topics t
        JOIN chapters c ON t.chapter_id = c.id
        JOIN subjects s ON c.subject_id = s.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      topic: {
        id: topic.id,
        name: topic.name,
        orderIndex: topic.order_index,

        chapter: {
          id: topic.chapter_id,
          name: topic.chapter_name,
          chapterNumber: topic.chapter_number,
        },

        subject: {
          id: topic.subject_id,
          name: topic.subject_name,
        },
      },
    });
  } catch (error) {
    console.error("Topic API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch topic.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}