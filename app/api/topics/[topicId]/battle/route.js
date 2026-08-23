import { NextResponse } from "next/server";
import { generateWithFallback, cleanAndParseJSON } from "@/lib/gemini";
import db from "@/lib/db.js";

export async function POST(request, { params }) {
  try {
    const { topicId } = await params;
    const id = Number(topicId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid topic ID." },
        { status: 400 }
      );
    }

    // -----------------------------
    // 1. Get topic
    // -----------------------------

    const topic = db
      .prepare(`
        SELECT
          t.id,
          t.name,
          s.id AS subject_id,
          c.name AS chapter_name,
          s.name AS subject_name
        FROM topics t
        JOIN chapters c
          ON t.chapter_id = c.id
        JOIN subjects s
          ON c.subject_id = s.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 3. CHECK BATTLE CACHE
    // --------------------------------------------------
    // If a battle has already been generated for this
    // topic, return the exact same battle.
    //
    // Gemini will NOT be called again.
    // --------------------------------------------------

    const cachedBattle = db
      .prepare(`
        SELECT
          id,
          topic_id,
          questions,
          created_at
        FROM battles
        WHERE topic_id = ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(id);

    if (cachedBattle) {
      console.log(
        `Battle loaded from database for topic ${id}.`
      );

      let questions;

      try {
        questions = JSON.parse(cachedBattle.questions);
      } catch (error) {
        console.error(
          "Failed to parse cached battle JSON:",
          error
        );

        return NextResponse.json(
          {
            error: "Cached battle data is corrupted.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        cached: true,

        topic: {
          id: topic.id,
          name: topic.name,
          subjectId: Number(topic.subject_id),
        },

        battle: {
          id: Number(cachedBattle.id),
          topicId: Number(cachedBattle.topic_id),
          questions,
          createdAt: cachedBattle.created_at,
        },
      });
    }

    // --------------------------------------------------
    // 4. Generate new battle with Gemini
    // --------------------------------------------------

    console.log(
      `No cached battle found for topic ${id}. Generating...`
    );

    const prompt = `
You are an expert examination question generator.

Create exactly 10 questions for:

Subject:
${topic.subject_name}

Chapter:
${topic.chapter_name}

Topic:
${topic.name}

These questions will be used in a student "Boss Battle".

QUESTION DISTRIBUTION:

- Questions 1-5: EASY
- Questions 6-10: MEDIUM or HARD

The first five questions should test fundamental understanding.

The final five questions should test deeper understanding,
application, reasoning, calculations, or problem solving.

IMPORTANT RULES:

1. Exactly 10 questions.
2. Exactly 4 options per question.
3. Only one option is correct.
4. Questions must be unambiguous.
5. Do not repeat essentially the same question.
6. Questions must stay within the selected topic.
7. Include the underlying concept being tested.
8. Include a concise explanation.
9. Difficulty must be exactly:
   "easy", "medium", or "hard".
10. Questions 1-5 MUST be "easy".
11. Questions 6-10 MUST be "medium" or "hard".
12. Return ONLY valid JSON.
13. Do not use markdown code fences.

Return exactly:

{
  "questions": [
    {
      "question": "...",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correctAnswer": 0,
      "explanation": "...",
      "concept": "...",
      "difficulty": "easy"
    }
  ]
}

correctAnswer is the zero-based index of the correct option.
`;

    const response = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    // -----------------------------
    // 3. Parse Gemini JSON
    // -----------------------------

    let generatedBattle;

    try {
      generatedBattle = cleanAndParseJSON(response.text);
    } catch (error) {
      console.error("Invalid Gemini JSON:", error.message);
      console.error(response.text);

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
          details: error.message,
          raw: response.text,
        },
        { status: 502 }
      );
    }
    // -----------------------------
    // 4. Normalize and validate questions
    // -----------------------------

    const rawQuestions = Array.isArray(generatedBattle?.questions)
      ? generatedBattle.questions
      : Array.isArray(generatedBattle)
      ? generatedBattle
      : [];

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        {
          error: "Gemini did not return any questions.",
        },
        { status: 502 }
      );
    }

    const normalizedQuestions = [];

    for (let i = 0; i < rawQuestions.length && normalizedQuestions.length < 10; i++) {
      const q = rawQuestions[i];
      if (!q || !q.question) continue;

      let options = Array.isArray(q.options) ? q.options.map(String) : [];
      if (options.length < 2) continue;
      while (options.length < 4) {
        options.push(`Option ${String.fromCharCode(65 + options.length)}`);
      }
      if (options.length > 4) {
        options = options.slice(0, 4);
      }

      let correctIndex = typeof q.correctAnswer === "number" ? q.correctAnswer : parseInt(q.correctAnswer, 10);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        correctIndex = 0;
      }

      let diff = String(q.difficulty || (normalizedQuestions.length < 5 ? "easy" : "medium")).toLowerCase();
      if (!["easy", "medium", "hard"].includes(diff)) {
        diff = normalizedQuestions.length < 5 ? "easy" : "medium";
      }

      normalizedQuestions.push({
        question: String(q.question),
        options,
        correctAnswer: correctIndex,
        explanation: String(q.explanation || "Correct concept application."),
        concept: String(q.concept || topic.name),
        difficulty: diff,
      });
    }

    if (normalizedQuestions.length < 3) {
      return NextResponse.json(
        {
          error: "Failed to generate sufficient valid questions.",
        },
        { status: 502 }
      );
    }

    // -----------------------------
    // 5. Save questions to SQLite
    // -----------------------------

    const insertQuestion = db.prepare(`
      INSERT INTO questions (
        topic_id,
        question,
        options,
        correct_answer,
        explanation,
        difficulty
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const saveQuestions = db.transaction(() => {
      const savedQuestions = [];

      for (const question of normalizedQuestions) {
        const result = insertQuestion.run(
          topic.id,
          question.question,
          JSON.stringify(question.options),
          String(question.correctAnswer),
          question.explanation,
          question.difficulty
        );

        savedQuestions.push({
          id: Number(result.lastInsertRowid),
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          concept: question.concept,
          difficulty: question.difficulty,
        });
      }

      return savedQuestions;
    });

    const savedQuestions = saveQuestions();

    // --------------------------------------------------
    // 9. Save complete battle to battles table
    // --------------------------------------------------
    //
    // battles.questions stores the complete generated
    // battle as JSON.
    //
    // Because topic_id is UNIQUE, there can only be
    // ONE cached battle for each topic.
    // --------------------------------------------------

    let battleId;

    try {
      const battleResult = db
        .prepare(`
          INSERT INTO battles (
            topic_id,
            level,
            questions
          )
          VALUES (?, 1, ?)
          ON CONFLICT(topic_id, level) DO UPDATE SET questions = excluded.questions
        `)
        .run(
          id,
          JSON.stringify(savedQuestions)
        );

      battleId = Number(
        battleResult.lastInsertRowid
      );
    } catch (error) {
      // ------------------------------------------------
      // Possible race condition:
      // Another request may have generated and cached
      // the battle at almost the same time.
      // ------------------------------------------------

      console.error(
        "Battle cache insert error:",
        error
      );

      // Try loading the battle that already exists.
      const existingBattle = db
        .prepare(`
          SELECT
            id,
            topic_id,
            questions,
            created_at
          FROM battles
          WHERE topic_id = ?
        `)
        .get(id);

      if (existingBattle) {
        return NextResponse.json({
          success: true,
          cached: true,

          topic: {
            id: topic.id,
            name: topic.name,
            subjectId: Number(topic.subject_id),
          },

          battle: {
            id: Number(existingBattle.id),
            topicId: Number(existingBattle.topic_id),
            questions: JSON.parse(
              existingBattle.questions
            ),
            createdAt: existingBattle.created_at,
          },
        });
      }

      throw error;
    }

    // --------------------------------------------------
    // 10. Return newly generated battle
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      cached: false,

      topic: {
        id: topic.id,
        name: topic.name,
        subjectId: Number(topic.subject_id),
      },

      battle: {
         id: battleId,
        topicId: topic.id,
        questions: savedQuestions,
      },
    });
  } catch (error) {
    console.error("Battle generation error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate battle.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}