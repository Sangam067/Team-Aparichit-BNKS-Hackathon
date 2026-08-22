import { NextResponse } from "next/server";
import db from "@/lib/db.js";

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("userId"));

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 }
      );
    }

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

    const subjectRows = db
      .prepare(`
        SELECT id, name
        FROM subjects
        ORDER BY name ASC
      `)
      .all();

    const topicRows = db
      .prepare(`
        SELECT
          t.id AS topic_id,
          t.name AS topic_name,
          t.order_index,
          c.id AS chapter_id,
          c.name AS chapter_name,
          c.chapter_number,
          s.id AS subject_id,
          s.name AS subject_name
        FROM topics t
        JOIN chapters c ON t.chapter_id = c.id
        JOIN subjects s ON c.subject_id = s.id
        ORDER BY s.name ASC, c.chapter_number ASC, t.order_index ASC
      `)
      .all();

    const progressRows = db
      .prepare(`
        SELECT
          bp.user_id,
          bp.topic_id,
          bp.level,
          bp.score,
          bp.stars,
          bp.completed,
          bp.completed_at,
          t.name AS topic_name,
          c.name AS chapter_name,
          s.name AS subject_name
        FROM battle_progress bp
        JOIN topics t ON t.id = bp.topic_id
        JOIN chapters c ON c.id = t.chapter_id
        JOIN subjects s ON s.id = c.subject_id
        WHERE bp.user_id = ?
        ORDER BY bp.completed_at DESC, bp.topic_id ASC, bp.level ASC
      `)
      .all(userId);

    const recentAttemptRows = db
      .prepare(`
        SELECT
          a.id,
          a.created_at,
          a.is_correct,
          a.answer,
          q.question,
          t.name AS topic_name,
          c.name AS chapter_name,
          s.name AS subject_name
        FROM attempts a
        JOIN questions q ON q.id = a.question_id
        JOIN topics t ON t.id = q.topic_id
        JOIN chapters c ON c.id = t.chapter_id
        JOIN subjects s ON s.id = c.subject_id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT 10
      `)
      .all(userId);

    const progressByTopic = new Map();

    for (const row of progressRows) {
      const topicId = Number(row.topic_id);
      const current = progressByTopic.get(topicId) || {
        bestScore: 0,
        highestLevel: 0,
        completedLevels: 0,
        lastCompletedAt: null,
      };

      current.bestScore = Math.max(current.bestScore, Number(row.score ?? 0));
      current.highestLevel = Math.max(
        current.highestLevel,
        Number(row.level ?? 0)
      );

      if (Number(row.completed) === 1) {
        current.completedLevels += 1;
      }

      if (row.completed_at) {
        const rowDate = parseDate(row.completed_at);
        const currentDate = parseDate(current.lastCompletedAt);

        if (!currentDate || (rowDate && rowDate > currentDate)) {
          current.lastCompletedAt = row.completed_at;
        }
      }

      progressByTopic.set(topicId, current);
    }

    const subjects = subjectRows.map((subject) => {
      const subjectTopics = topicRows.filter(
        (topic) => Number(topic.subject_id) === Number(subject.id)
      );

      const subjectProgress = subjectTopics.length
        ? Math.round(
            subjectTopics.reduce((sum, topic) => {
              const progress = progressByTopic.get(Number(topic.topic_id));
              const score = progress ? Number(progress.bestScore || 0) : 0;
              return sum + (score / 10) * 100;
            }, 0) / subjectTopics.length
          )
        : 0;

      const currentLevel = subjectTopics.length
        ? Math.max(
            0,
            ...subjectTopics.map((topic) => {
              const progress = progressByTopic.get(Number(topic.topic_id));
              return progress ? Number(progress.highestLevel || 0) : 0;
            })
          )
        : 0;

      const completedLevels = subjectTopics.reduce((sum, topic) => {
        const progress = progressByTopic.get(Number(topic.topic_id));
        return sum + (progress ? Number(progress.completedLevels || 0) : 0);
      }, 0);

      return {
        id: subject.id,
        name: subject.name,
        progress: subjectProgress,
        currentLevel: currentLevel > 0 ? currentLevel : null,
        completedLevels,
        totalTopics: subjectTopics.length,
        started: subjectTopics.some((topic) =>
          progressByTopic.has(Number(topic.topic_id))
        ),
      };
    });

    const topicCandidates = topicRows
      .map((topic) => {
        const progress = progressByTopic.get(Number(topic.topic_id));

        if (!progress) {
          return null;
        }

        const bestScore = Number(progress.bestScore || 0);
        const highestLevel = Number(progress.highestLevel || 0);

        if (bestScore >= 10 && highestLevel >= 5) {
          return null;
        }

        return {
          topicId: Number(topic.topic_id),
          subject: {
            id: Number(topic.subject_id),
            name: topic.subject_name,
          },
          chapter: {
            id: Number(topic.chapter_id),
            name: topic.chapter_name,
            chapterNumber: Number(topic.chapter_number),
          },
          topic: {
            id: Number(topic.topic_id),
            name: topic.topic_name,
          },
          currentLevel: highestLevel || 1,
          progress: Math.min(100, Math.round((bestScore / 10) * 100)),
          lastCompletedAt: progress.lastCompletedAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = parseDate(a.lastCompletedAt)?.getTime() ?? 0;
        const bDate = parseDate(b.lastCompletedAt)?.getTime() ?? 0;
        return bDate - aDate;
      });

    const continueLearning = topicCandidates[0] || null;

    const battleActivity = progressRows
      .filter((row) => Number(row.completed) === 1)
      .map((row) => ({
        id: `battle-${row.topic_id}-${row.level}`,
        type: "battle",
        title: `Completed Level ${row.level} in ${row.topic_name}`,
        subtitle: `${row.subject_name} • ${row.chapter_name}`,
        timestamp: row.completed_at,
      }));

    const practiceActivity = recentAttemptRows.map((row) => ({
      id: `practice-${row.id}`,
      type: "practice",
      title: `${Number(row.is_correct) === 1 ? "Answered correctly" : "Practice attempt"} in ${row.topic_name}`,
      subtitle: `${row.subject_name} • ${row.chapter_name}`,
      timestamp: row.created_at,
    }));

    const recentActivities = [...battleActivity, ...practiceActivity]
      .sort((a, b) => {
        const aTime = parseDate(a.timestamp)?.getTime() ?? 0;
        const bTime = parseDate(b.timestamp)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 6);

    const totalCompletedLevels = progressRows.filter(
      (row) => Number(row.completed) === 1
    ).length;

    const startedSubjects = subjects.filter((subject) => subject.started).length;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      summary: {
        totalSubjects: subjectRows.length,
        startedSubjects,
        completedLevels: totalCompletedLevels,
      },
      continueLearning,
      subjects,
      recentActivities,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        error: "Failed to load dashboard data.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
