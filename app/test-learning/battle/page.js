"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function renderStars(stars, max = 3) {
  return Array.from({ length: max }, (_, index) => (
    <span
      key={index}
      style={{
        color: index < stars ? "#f59e0b" : "#d1d5db",
        fontSize: "24px",
      }}
    >
      ★
    </span>
  ));
}

function BattlePageContent() {
  const searchParams = useSearchParams();

  const topicId = searchParams.get("topicId");
  const level = searchParams.get("level");

  const [battle, setBattle] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [score, setScore] = useState(0);
  const [bossHp, setBossHp] = useState(100);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [lastAnswerCorrect, setLastAnswerCorrect] =
    useState(null);

  const [progressSaved, setProgressSaved] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    async function loadBattle() {
      try {
        if (!level) {
          window.location.href =
            `/test-learning/battle/levels?topicId=${topicId}`;
          return;
        }

        const response = await fetch(
          `/api/topics/${topicId}/battle?level=${level}`,
          {
            method: "POST",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load battle."
          );
        }

        setBattle(data.battle);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    if (topicId) {
      loadBattle();
    }
  }, [topicId, level]);

  useEffect(() => {
    async function saveProgress() {
      if (
        !battle ||
        currentQuestion < battle.questions.length ||
        progressSaved ||
        savingProgress
      ) {
        return;
      }

      try {
        setSavingProgress(true);

        const userData = localStorage.getItem("user");

        if (!userData) {
          setError("Please login before saving battle progress.");
          return;
        }

        const user = JSON.parse(userData);

        if (!user?.id) {
          setError("Invalid logged-in user.");
          return;
        }

        const response = await fetch(
          `/api/topics/${topicId}/battle/progress`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              level: Number(level),
              score,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to save battle progress."
          );
        }

        setSavedProgress(data.progress);
        setProgressSaved(true);
      } catch (saveError) {
        console.error("Progress save error:", saveError);
        setError(saveError.message);
      } finally {
        setSavingProgress(false);
      }
    }

    saveProgress();
  }, [
    battle,
    currentQuestion,
    level,
    progressSaved,
    savingProgress,
    score,
    topicId,
  ]);

  async function submitAnswer() {
    if (selectedAnswer === null) return;

    try {
      const userData = localStorage.getItem("user");

      if (!userData) {
        setError("Please login before starting a battle.");
        return;
      }

      const user = JSON.parse(userData);

      if (!user?.id) {
        setError("Invalid logged-in user.");
        return;
      }

      const question =
        battle.questions[currentQuestion];

      const response = await fetch(
        "/api/attempts",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            userId: user.id,
            questionId: question.id,
            answer: selectedAnswer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to submit answer."
        );
      }

      const correct =
        data.attempt.isCorrect;

      setLastAnswerCorrect(correct);
      setSubmitted(true);

      if (correct) {
        setScore((prev) => prev + 1);

        setBossHp((prev) =>
          Math.max(prev - 10, 0)
        );
      }
    } catch (submitError) {
      console.error(
        "Answer submission error:",
        submitError
      );

      setError(submitError.message);
    }
  }

  function nextQuestion() {
    setSelectedAnswer(null);
    setSubmitted(false);
    setLastAnswerCorrect(null);

    setCurrentQuestion((prev) => prev + 1);
  }

  if (loading) {
    return (
      <main style={styles.container}>
        <h1>⚔️ Preparing Battle...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.container}>
        <h1>Battle Error</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!battle) {
    return null;
  }

  if (
    currentQuestion >=
    battle.questions.length
  ) {
    const stars = savedProgress?.stars ?? 0;
    const completed = savedProgress?.completed ?? false;

    return (
      <main style={styles.container}>
        <h1>⚔️ Battle Complete</h1>

        <div style={styles.card}>
          <p style={styles.levelLabel}>
            Level {battle.level}
          </p>

          <h2>Final Score</h2>

          <p style={styles.finalScore}>
            {score} / {battle.questions.length}
          </p>

          <div style={styles.starRow}>
            {renderStars(stars)}
          </div>

          <h2>Boss HP</h2>

          <p>{bossHp} / 100</p>

          {bossHp === 0 ? (
            <h2>🏆 BOSS DEFEATED!</h2>
          ) : (
            <h2>Boss Survived</h2>
          )}

          {savingProgress && (
            <p>Saving progress...</p>
          )}

          {!savingProgress && completed && (
            <p style={styles.successText}>
              Level completed! The next level is now unlocked.
            </p>
          )}

          {!savingProgress && !completed && (
            <p style={styles.retryText}>
              Score at least 5/10 to complete this level and unlock the next one.
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              window.location.href =
                `/test-learning/battle/levels?topicId=${topicId}`;
            }}
            style={styles.next}
          >
            Back to Levels
          </button>
        </div>
      </main>
    );
  }

  const question =
    battle.questions[currentQuestion];

  const isCorrect =
    submitted && lastAnswerCorrect === true;

  return (
    <main style={styles.container}>
      <h1>⚔️ BATTLE MODE</h1>

      <p>
        Level {battle.level} · Question {currentQuestion + 1} /{" "}
        {battle.questions.length}
      </p>

      <div style={styles.boss}>
        <div style={{ fontSize: "60px" }}>
          👹
        </div>

        <h2>BOSS</h2>

        <div style={styles.hpBackground}>
          <div
            style={{
              ...styles.hp,
              width: `${bossHp}%`,
            }}
          />
        </div>

        <p>
          Boss HP: <strong>{bossHp}</strong> / 100
        </p>
      </div>

      <div style={styles.card}>
        <h2>{question.question}</h2>

        <div style={{ marginTop: "20px" }}>
          {question.options.map(
            (option, index) => {
              const selected =
                selectedAnswer === index;

              const correct =
                submitted &&
                index ===
                  question.correctAnswer;

              return (
                <button
                  key={index}
                  onClick={() =>
                    !submitted &&
                    setSelectedAnswer(index)
                  }
                  style={{
                    ...styles.option,
                    ...(selected
                      ? styles.selected
                      : {}),
                    ...(correct
                      ? styles.correct
                      : {}),
                  }}
                >
                  {option}
                </button>
              );
            }
          )}
        </div>

        {!submitted && (
          <button
            onClick={submitAnswer}
            disabled={selectedAnswer === null}
            style={styles.submit}
          >
            Submit Answer
          </button>
        )}

        {submitted && (
          <div style={styles.explanation}>
            <h3>
              {isCorrect
                ? "✅ Correct!"
                : "❌ Incorrect"}
            </h3>

            {!isCorrect && (
              <p>
                <strong>
                  Correct answer:
                </strong>{" "}
                {question.options[question.correctAnswer]}
              </p>
            )}

            <p>
              {question.explanation}
            </p>

            {currentQuestion <
              battle.questions.length - 1 && (
              <button
                onClick={nextQuestion}
                style={styles.next}
              >
                Next Question →
              </button>
            )}

            {currentQuestion ===
              battle.questions.length - 1 && (
              <button
                onClick={nextQuestion}
                style={styles.next}
              >
                Finish Battle
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },

  boss: {
    textAlign: "center",
    padding: "20px",
    marginBottom: "30px",
    border: "1px solid #ddd",
    borderRadius: "10px",
  },

  hpBackground: {
    width: "100%",
    height: "25px",
    background: "#ddd",
    borderRadius: "20px",
    overflow: "hidden",
  },

  hp: {
    height: "100%",
    background: "#dc2626",
    transition: "width 0.4s ease",
  },

  card: {
    padding: "25px",
    border: "1px solid #ddd",
    borderRadius: "10px",
  },

  levelLabel: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "13px",
  },

  finalScore: {
    fontSize: "28px",
    fontWeight: 700,
    margin: "8px 0 12px",
  },

  starRow: {
    display: "flex",
    gap: "4px",
    marginBottom: "20px",
  },

  successText: {
    color: "#16a34a",
    fontWeight: 600,
  },

  retryText: {
    color: "#b45309",
    fontWeight: 600,
  },

  option: {
    display: "block",
    width: "100%",
    padding: "15px",
    marginBottom: "10px",
    textAlign: "left",
    border: "1px solid #ccc",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
  },

  selected: {
    border: "2px solid #2563eb",
  },

  correct: {
    border: "2px solid #16a34a",
  },

  submit: {
    marginTop: "20px",
    padding: "12px 20px",
    cursor: "pointer",
  },

  explanation: {
    marginTop: "25px",
    padding: "20px",
    background: "#f3f4f6",
    borderRadius: "8px",
  },

  next: {
    marginTop: "15px",
    padding: "12px 20px",
    cursor: "pointer",
  },
};

export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <h1>⚔️ Preparing Battle...</h1>
        </main>
      }
    >
      <BattlePageContent />
    </Suspense>
  );
}
