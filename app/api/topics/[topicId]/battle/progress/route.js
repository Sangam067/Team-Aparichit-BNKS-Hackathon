import { NextResponse } from "next/server";
import db from "@/lib/db.js";
import {
  BATTLE_LEVELS,
  calculateStars,
  isLevelCompleted,
  isLevelUnlocked,
  isValidBattleLevel,
} from "@/lib/battle-levels.js";

function buildLevelProgress(progressRows) {
  const progressByLevel = new Map(
    progressRows.map((row) => [
      row.level,
      {
        completed: row.completed === 1,
        score: row.score,
        stars: row.stars,
        completedAt: row.completed_at,
      },
    ])
  );

  return BATTLE_LEVELS.map((levelConfig) => {
    const progress = progressByLevel.get(levelConfig.level);

    return {
      level: levelConfig.level,
      title: levelConfig.title,
      subtitle: levelConfig.subtitle,
      unlocked: isLevelUnlocked(levelConfig.level, progressByLevel),
      completed: progress?.completed ?? false,
      score: progress?.score ?? null,
      stars: progress?.stars ?? 0,
      completedAt: progress?.completedAt ?? null,
    };
  });
}

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

    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("userId"));

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 }
      );
    }

    const topic = db
      .prepare(`
        SELECT id, name
        FROM topics
        WHERE id = ?
      `)
      .get(id);

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    const user = db
      .prepare(`
        SELECT id
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

    const progressRows = db
      .prepare(`
        SELECT
          level,
          completed,
          score,
          stars,
          completed_at
        FROM battle_progress
        WHERE user_id = ? AND topic_id = ?
        ORDER BY level ASC
      `)
      .all(userId, id);

    return NextResponse.json({
      success: true,
      topic: {
        id: topic.id,
        name: topic.name,
      },
      levels: buildLevelProgress(progressRows),
    });
  } catch (error) {
    console.error("Battle progress fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch battle progress.",
        details: error.message,
      },
      { status: 500 }
    );
  }
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

    const body = await request.json();
    const userId = Number(body?.userId);
    const level = Number(body?.level);
    const score = Number(body?.score);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 }
      );
    }

    if (!isValidBattleLevel(level)) {
      return NextResponse.json(
        { error: "Invalid level. Level must be between 1 and 5." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(score) ||
      score < 0 ||
      score > 10
    ) {
      return NextResponse.json(
        { error: "Invalid score. Score must be between 0 and 10." },
        { status: 400 }
      );
    }

    const topic = db
      .prepare(`
        SELECT id
        FROM topics
        WHERE id = ?
      `)
      .get(id);

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    const user = db
      .prepare(`
        SELECT id
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

    const progressRows = db
      .prepare(`
        SELECT
          level,
          completed,
          score,
          stars,
          completed_at
        FROM battle_progress
        WHERE user_id = ? AND topic_id = ?
      `)
      .all(userId, id);

    const progressByLevel = new Map(
      progressRows.map((row) => [
        row.level,
        {
          completed: row.completed === 1,
          score: row.score,
          stars: row.stars,
        },
      ])
    );

    if (!isLevelUnlocked(level, progressByLevel)) {
      return NextResponse.json(
        { error: "This level is locked." },
        { status: 403 }
      );
    }

    const stars = calculateStars(score);
    const completed = isLevelCompleted(score);
    const existingProgress = progressByLevel.get(level);

    const shouldUpdate =
      !existingProgress ||
      score > existingProgress.score ||
      (score === existingProgress.score &&
        stars > existingProgress.stars);

    if (!shouldUpdate) {
      return NextResponse.json({
        success: true,
        progress: {
          level,
          completed: existingProgress.completed,
          score: existingProgress.score,
          stars: existingProgress.stars,
        },
        levels: buildLevelProgress(progressRows),
      });
    }

    const completedAt = completed
      ? new Date().toISOString()
      : null;

    db.prepare(`
      INSERT INTO battle_progress (
        user_id,
        topic_id,
        level,
        completed,
        score,
        stars,
        completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, topic_id, level) DO UPDATE SET
        completed = CASE
          WHEN excluded.completed = 1 THEN 1
          ELSE battle_progress.completed
        END,
        score = CASE
          WHEN excluded.score > battle_progress.score THEN excluded.score
          ELSE battle_progress.score
        END,
        stars = CASE
          WHEN excluded.score > battle_progress.score THEN excluded.stars
          WHEN excluded.score = battle_progress.score
            AND excluded.stars > battle_progress.stars THEN excluded.stars
          ELSE battle_progress.stars
        END,
        completed_at = CASE
          WHEN excluded.completed = 1
            AND (battle_progress.completed = 0 OR excluded.score > battle_progress.score)
            THEN excluded.completed_at
          ELSE battle_progress.completed_at
        END
    `).run(
      userId,
      id,
      level,
      completed ? 1 : 0,
      score,
      stars,
      completedAt
    );

    const updatedRows = db
      .prepare(`
        SELECT
          level,
          completed,
          score,
          stars,
          completed_at
        FROM battle_progress
        WHERE user_id = ? AND topic_id = ?
        ORDER BY level ASC
      `)
      .all(userId, id);

    const updatedProgress = updatedRows.find((row) => row.level === level);

    return NextResponse.json({
      success: true,
      progress: {
        level,
        completed: updatedProgress.completed === 1,
        score: updatedProgress.score,
        stars: updatedProgress.stars,
        completedAt: updatedProgress.completed_at,
      },
      levels: buildLevelProgress(updatedRows),
    });
  } catch (error) {
    console.error("Battle progress save error:", error);

    return NextResponse.json(
      {
        error: "Failed to save battle progress.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
