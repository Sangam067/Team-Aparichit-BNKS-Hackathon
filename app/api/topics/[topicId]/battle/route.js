import { NextResponse } from "next/server";
import ai from "@/lib/gemini";
import db from "@/lib/db.js";
import {
  buildBattlePrompt,
  getBattleLevelConfig,
  isValidBattleLevel,
  validateQuestionDifficulty,
} from "@/lib/battle-levels.js";

function buildBattleResponse(topic, cachedBattle, cached) {
  let questions;

  try {
    questions = JSON.parse(cachedBattle.questions);
  } catch (error) {
    console.error("Failed to parse cached battle JSON:", error);

    return NextResponse.json(
      {
        error: "Cached battle data is corrupted.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    cached,

    topic: {
      id: topic.id,
      name: topic.name,
    },

    battle: {
      id: Number(cachedBattle.id),
      topicId: Number(cachedBattle.topic_id),
      level: Number(cachedBattle.level),
      questions,
      createdAt: cachedBattle.created_at,
    },
  });
}

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

    const { searchParams } = new URL(request.url);
    const level = Number(searchParams.get("level"));

    if (!isValidBattleLevel(level)) {
      return NextResponse.json(
        { error: "Invalid level. Level must be between 1 and 5." },
        { status: 400 }
      );
    }

    const levelConfig = getBattleLevelConfig(level);

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

    const cachedBattle = db
      .prepare(`
        SELECT
          id,
          topic_id,
          level,
          questions,
          created_at
        FROM battles
        WHERE topic_id = ? AND level = ?
      `)
      .get(id, level);

    if (cachedBattle) {
      console.log(
        `Battle loaded from database for topic ${id}, level ${level}.`
      );

      return buildBattleResponse(topic, cachedBattle, true);
    }

    console.log(
      `No cached battle found for topic ${id}, level ${level}. Generating...`
    );

    const prompt = buildBattlePrompt(topic, levelConfig);

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",

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

    let generatedBattle;

    try {
      generatedBattle = JSON.parse(response.text);
    } catch (error) {
      console.error("Invalid Gemini JSON:");
      console.error(response.text);

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
        },
        { status: 502 }
      );
    }

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
            error: `Invalid question structure at question ${i + 1}.`,
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
            error: `Invalid correct answer at question ${i + 1}.`,
          },
          { status: 502 }
        );
      }

      if (!validateQuestionDifficulty(level, i, question.difficulty)) {
        return NextResponse.json(
          {
            error: `Question ${i + 1} has invalid difficulty for level ${level}.`,
          },
          { status: 502 }
        );
      }
    }

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
          question.correctAnswer,
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

    let battleId;

    try {
      const battleResult = db
        .prepare(`
          INSERT INTO battles (
            topic_id,
            level,
            questions
          )
          VALUES (?, ?, ?)
        `)
        .run(id, level, JSON.stringify(savedQuestions));

      battleId = Number(battleResult.lastInsertRowid);
    } catch (error) {
      console.error("Battle cache insert error:", error);

      const existingBattle = db
        .prepare(`
          SELECT
            id,
            topic_id,
            level,
            questions,
            created_at
          FROM battles
          WHERE topic_id = ? AND level = ?
        `)
        .get(id, level);

      if (existingBattle) {
        return buildBattleResponse(topic, existingBattle, true);
      }

      throw error;
    }

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
        level,
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
