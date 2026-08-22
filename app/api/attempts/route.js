import { NextResponse } from "next/server";
import db from "@/lib/db.js";

export async function POST(request) {
  try {
    const body = await request.json();

    const userId = Number(body?.userId);
    const questionId = Number(body?.questionId);
    const answer = body?.answer;

    // -----------------------------
    // Validate input
    // -----------------------------

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(questionId) ||
      questionId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid question ID." },
        { status: 400 }
      );
    }

    if (
      answer === undefined ||
      answer === null ||
      answer === ""
    ) {
      return NextResponse.json(
        { error: "Answer is required." },
        { status: 400 }
      );
    }

    // -----------------------------
    // Check user
    // -----------------------------

    const user = db
      .prepare(`
        SELECT id, name, email
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // -----------------------------
    // Get question
    // -----------------------------

    const question = db
      .prepare(`
        SELECT
          id,
          topic_id,
          question,
          options,
          correct_answer,
          explanation,
          difficulty
        FROM questions
        WHERE id = ?
      `)
      .get(questionId);

    if (!question) {
      return NextResponse.json(
        { error: "Question not found." },
        { status: 404 }
      );
    }

    // -----------------------------
    // Determine correctness
    // -----------------------------

    const submittedAnswer = String(answer);
    const correctAnswer = String(
      question.correct_answer
    );

    const isCorrect =
      submittedAnswer === correctAnswer;

    // -----------------------------
    // Save attempt
    // -----------------------------

    const result = db
      .prepare(`
        INSERT INTO attempts (
          user_id,
          question_id,
          answer,
          is_correct
        )
        VALUES (?, ?, ?, ?)
      `)
      .run(
        userId,
        questionId,
        submittedAnswer,
        isCorrect ? 1 : 0
      );

    // -----------------------------
    // Return result
    // -----------------------------

    return NextResponse.json({
      success: true,

      attempt: {
        id: Number(result.lastInsertRowid),
        userId,
        questionId,
        answer: submittedAnswer,
        isCorrect,
      },

      question: {
        correctAnswer: Number(
          question.correct_answer
        ),
        explanation: question.explanation,
      },
    });
  } catch (error) {
    console.error(
      "Attempt creation error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to save attempt.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}