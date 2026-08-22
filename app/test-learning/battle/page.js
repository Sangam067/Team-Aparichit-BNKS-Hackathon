"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BattlePage() {
  const searchParams = useSearchParams();

  const topicId = searchParams.get("topicId");

  const [battle, setBattle] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [score, setScore] = useState(0);
  const [bossHp, setBossHp] = useState(100);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -----------------------------
  // Load battle
  // -----------------------------

  useEffect(() => {
    async function loadBattle() {
      try {
        const response = await fetch(
          `/api/topics/${topicId}/battle`,
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
      } catch (error) {
        console.error(error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    if (topicId) {
      loadBattle();
    }
  }, [topicId]);

  // -----------------------------
  // Submit answer
  // -----------------------------

  function submitAnswer() {
    if (selectedAnswer === null) return;

    setSubmitted(true);

    const question =
      battle.questions[currentQuestion];

    const correct =
      selectedAnswer === question.correctAnswer;

    if (correct) {
      setScore((prev) => prev + 1);

      setBossHp((prev) =>
        Math.max(prev - 10, 0)
      );
    }
  }

  // -----------------------------
  // Next question
  // -----------------------------

  function nextQuestion() {
    setSelectedAnswer(null);
    setSubmitted(false);

    setCurrentQuestion((prev) => prev + 1);
  }

  // -----------------------------
  // Loading
  // -----------------------------

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

  // -----------------------------
  // Battle complete
  // -----------------------------

  if (
    currentQuestion >=
    battle.questions.length
  ) {
    return (
      <main style={styles.container}>
        <h1>⚔️ Battle Complete</h1>

        <div style={styles.card}>
          <h2>Final Score</h2>

          <p>
            {score} / {battle.questions.length}
          </p>

          <h2>Boss HP</h2>

          <p>{bossHp} / 100</p>

          {bossHp === 0 ? (
            <h2>🏆 BOSS DEFEATED!</h2>
          ) : (
            <h2>Boss Survived</h2>
          )}
        </div>
      </main>
    );
  }

  const question =
    battle.questions[currentQuestion];

  const isCorrect =
    submitted &&
    selectedAnswer === question.correctAnswer;

  // -----------------------------
  // Battle screen
  // -----------------------------

  return (
    <main style={styles.container}>
      <h1>⚔️ BATTLE MODE</h1>

      <p>
        Question {currentQuestion + 1} /{" "}
        {battle.questions.length}
      </p>

      {/* Boss */}

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

      {/* Question */}

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

            <p>{question.explanation}</p>

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