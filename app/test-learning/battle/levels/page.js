"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function renderStars(stars, max = 3) {
  return Array.from({ length: max }, (_, index) => (
    <span
      key={index}
      style={{
        color: index < stars ? "#f59e0b" : "#d1d5db",
        fontSize: "18px",
      }}
    >
      ★
    </span>
  ));
}

function BattleLevelsPageContent() {
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");

  const [topicName, setTopicName] = useState("");
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProgress() {
      try {
        const userData = localStorage.getItem("user");

        if (!userData) {
          setError("Please login to view battle levels.");
          setLoading(false);
          return;
        }

        const user = JSON.parse(userData);

        if (!user?.id) {
          setError("Invalid logged-in user.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/topics/${topicId}/battle/progress?userId=${user.id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load battle levels."
          );
        }

        setTopicName(data.topic.name);
        setLevels(data.levels);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    if (topicId) {
      loadProgress();
    } else {
      setError("Topic ID is required.");
      setLoading(false);
    }
  }, [topicId]);

  function startLevel(level) {
    window.location.href =
      `/test-learning/battle?topicId=${topicId}&level=${level}`;
  }

  if (loading) {
    return (
      <main style={styles.container}>
        <h1 style={styles.title}>⚔️ Loading Levels...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.container}>
        <h1 style={styles.title}>Battle Levels</h1>
        <p style={styles.error}>{error}</p>
      </main>
    );
  }

  const completedCount = levels.filter((level) => level.completed).length;

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Boss Battle Path</p>
        <h1 style={styles.title}>{topicName}</h1>
        <p style={styles.subtitle}>
          Complete each level to unlock the next. Score at least 5/10 to pass.
        </p>
        <div style={styles.progressSummary}>
          <span>{completedCount} / {levels.length} levels completed</span>
        </div>
      </div>

      <div style={styles.levelList}>
        {levels.map((level) => {
          const isLocked = !level.unlocked;

          return (
            <button
              key={level.level}
              type="button"
              onClick={() => !isLocked && startLevel(level.level)}
              disabled={isLocked}
              style={{
                ...styles.levelCard,
                ...(isLocked ? styles.levelLocked : {}),
                ...(level.completed ? styles.levelCompleted : {}),
              }}
            >
              <div style={styles.levelLeft}>
                <div
                  style={{
                    ...styles.levelBadge,
                    ...(isLocked ? styles.levelBadgeLocked : {}),
                    ...(level.completed ? styles.levelBadgeCompleted : {}),
                  }}
                >
                  {isLocked ? "🔒" : level.completed ? "✓" : level.level}
                </div>

                <div style={styles.levelText}>
                  <strong style={styles.levelTitle}>
                    Level {level.level} — {level.title}
                  </strong>
                  <span style={styles.levelSubtitle}>
                    {level.subtitle}
                  </span>
                </div>
              </div>

              <div style={styles.levelRight}>
                {level.completed || level.score !== null ? (
                  <>
                    <div style={styles.starRow}>
                      {renderStars(level.stars)}
                    </div>
                    <span style={styles.scoreText}>
                      {level.score ?? 0}/10
                    </span>
                  </>
                ) : isLocked ? (
                  <span style={styles.lockedText}>Locked</span>
                ) : (
                  <span style={styles.playText}>Start →</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/test-learning";
        }}
        style={styles.backButton}
      >
        ← Back to Learning
      </button>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: "760px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },

  header: {
    marginBottom: "28px",
  },

  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: "8px 0 0",
    fontSize: "32px",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#4b5563",
    lineHeight: 1.5,
  },

  progressSummary: {
    display: "inline-block",
    marginTop: "16px",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 600,
    fontSize: "14px",
  },

  levelList: {
    display: "grid",
    gap: "14px",
  },

  levelCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    width: "100%",
    padding: "18px 20px",
    border: "1px solid #dbeafe",
    borderRadius: "16px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.08)",
    cursor: "pointer",
    textAlign: "left",
  },

  levelLocked: {
    opacity: 0.72,
    background: "#f9fafb",
    boxShadow: "none",
    cursor: "not-allowed",
  },

  levelCompleted: {
    borderColor: "#bbf7d0",
    background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)",
  },

  levelLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minWidth: 0,
  },

  levelBadge: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    flexShrink: 0,
  },

  levelBadgeLocked: {
    background: "#9ca3af",
  },

  levelBadgeCompleted: {
    background: "#16a34a",
  },

  levelText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },

  levelTitle: {
    fontSize: "16px",
    color: "#111827",
  },

  levelSubtitle: {
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: 1.4,
  },

  levelRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    flexShrink: 0,
  },

  starRow: {
    display: "flex",
    gap: "2px",
  },

  scoreText: {
    fontSize: "13px",
    color: "#374151",
    fontWeight: 600,
  },

  lockedText: {
    fontSize: "13px",
    color: "#6b7280",
    fontWeight: 600,
  },

  playText: {
    fontSize: "14px",
    color: "#2563eb",
    fontWeight: 700,
  },

  backButton: {
    marginTop: "28px",
    padding: "12px 18px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#ffffff",
    cursor: "pointer",
  },

  error: {
    color: "#dc2626",
  },
};

export default function BattleLevelsPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <h1 style={styles.title}>⚔️ Loading Levels...</h1>
        </main>
      }
    >
      <BattleLevelsPageContent />
    </Suspense>
  );
}
