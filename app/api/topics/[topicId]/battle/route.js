import { NextResponse } from "next/server";
import ai from "@/lib/gemini";
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",

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
      generatedBattle = JSON.parse(response.text);
    } catch (error) {
      console.error("Invalid Gemini JSON:");
      console.error(response.text);

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
          raw: response.text,
        },
        { status: 502 }
      );
    }

    // -----------------------------
    // 4. Validate questions
    // -----------------------------

    if (
       !generatedBattle ||
      !Array.isArray(generatedBattle.questions) ||
      generatedBattle.questions.length !== 10
    ) {
      return NextResponse.json(
        {
          error: "Gemini did not return exactly 10 questions.",
        },
        { status: 502 }
      );
    }

    for (let i = 0; i < generatedBattle.questions.length; i++) {
      const question = generatedBattle.questions[i];

      if (
         !question ||
        !question.question ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        typeof question.correctAnswer !== "number" ||
        !question.explanation ||
        !question.concept ||
        !question.difficulty
      ) {
        return NextResponse.json(
          {
            error: `Invalid question structure at question ${
              i + 1
            }.`,
          },
          { status: 502 }
        );
      }

      if (
        question.correctAnswer < 0 ||
         question.correctAnswer > 3 ||
        !Number.isInteger(question.correctAnswer)
      ) {
        return NextResponse.json(
          {
            error: `Invalid correct answer at question ${
              i + 1
            }.`,
          },
          { status: 502 }
        );
      }

      // First 5 must be easy
      if (
        i < 5 &&
        question.difficulty !== "easy"
      ) {
        return NextResponse.json(
          {
            error: `Question ${
              i + 1
            } must be easy.`,
          },
          { status: 502 }
        );
      }

      if (
        i >= 5 &&
        !["medium", "hard"].includes(
          question.difficulty
        )
      ) {
        return NextResponse.json(
          {
            error: `Question ${
              i + 1
            } must be medium or hard.`,
          },
          { status: 502 }
        );
      }
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

       for (const question of generatedBattle.questions) {
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
            questions
          )
          VALUES (?, ?)
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