"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";

export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="loading-container" style={{ minHeight: "100vh" }}>
          <div className="loading-spinner" />
          <div className="loading-text">Summoning Boss Battle...</div>
        </div>
      }
    >
      <BattleContent />
    </Suspense>
  );
}

function BattleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");

  const [battle, setBattle] = useState(null);
  const [topic, setTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);

  const [score, setScore] = useState(0);
  const [bossHp, setBossHp] = useState(100);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 1. Load Battle Questions
  useEffect(() => {
    async function loadBattle() {
      if (!topicId) {
        setError("No topic selected for battle.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/topics/${topicId}/battle`, {
          method: "POST",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load battle questions.");
        }

        setBattle(data.battle);
        setTopic(data.topic);
      } catch (err) {
        console.error("Battle load error:", err);
        setError(err.message || "Failed to initialize battle.");
      } finally {
        setLoading(false);
      }
    }

    loadBattle();
  }, [topicId]);

  // 2. Submit Answer to /api/attempts
  async function submitAnswer() {
    if (selectedAnswer === null || submitted || submitting) return;

    setSubmitting(true);
    try {
      // Get logged in user or default to guest id 1
      let userId = 1;
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u?.id) userId = u.id;
        }
      } catch {
        // fallback
      }

      const q = battle.questions[currentQuestion];

      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: q.id,
          answer: selectedAnswer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit attempt.");
      }

      const correct = data.attempt?.isCorrect === true || data.attempt?.isCorrect === 1;
      setLastAnswerCorrect(correct);
      setSubmitted(true);

      if (correct) {
        setScore((prev) => prev + 1);
        setBossHp((prev) => Math.max(prev - 10, 0));
      }
    } catch (err) {
      console.error("Answer submission error:", err);
      // Fallback local verification if attempt API fails
      const q = battle.questions[currentQuestion];
      const correct = selectedAnswer === Number(q.correctAnswer);
      setLastAnswerCorrect(correct);
      setSubmitted(true);
      if (correct) {
        setScore((prev) => prev + 1);
        setBossHp((prev) => Math.max(prev - 10, 0));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setSelectedAnswer(null);
    setSubmitted(false);
    setLastAnswerCorrect(null);
    setCurrentQuestion((prev) => prev + 1);
  }

  // Handle Battle Completion & Mark Mastered
  function handleFinishBattle() {
    if (topicId) {
      try {
        const stored = localStorage.getItem("gameedu_mastered_topics");
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(Number(topicId)) && !list.includes(String(topicId))) {
          list.push(Number(topicId));
          localStorage.setItem("gameedu_mastered_topics", JSON.stringify(list));
        }
      } catch {
        // ignore
      }
    }
    router.push("/learning");
  }

  return (
    <div className="app-page-wrapper">
      <div className="app-backdrop" aria-hidden="true" />
      <Navbar />

      <main className="battle-container">
        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <div className="loading-text">
              Generating 10 AI Boss Battle Questions for {topic?.name || "Topic"}...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="error-container">
            <div className="error-icon">⚔️</div>
            <h2>Battle Summon Failed</h2>
            <p>{error}</p>
            <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => window.location.reload()}
              >
                Retry Battle
              </button>
              <Link href="/learning" className="button button-ghost button-small">
                Return to Learning Path
              </Link>
            </div>
          </div>
        )}

        {/* Battle Complete Screen */}
        {!loading && battle && currentQuestion >= battle.questions.length && (
          <div className="battle-complete">
            <div className="battle-complete-icon">
              {bossHp === 0 ? "🏆" : "⚔️"}
            </div>
            <h1>
              {bossHp === 0 ? "BOSS DEFEATED!" : "Battle Finished!"}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>
              {bossHp === 0
                ? `Incredible work! You dominated the ${topic?.name || "topic"} Boss Battle!`
                : `Good effort! You dealt solid damage to the Boss.`}
            </p>

            <div className="battle-complete-stats">
              <div className="battle-stat">
                <span className="battle-stat-value">
                  {score} / {battle.questions.length}
                </span>
                <span className="battle-stat-label">Questions Correct</span>
              </div>
              <div className="battle-stat">
                <span
                  className="battle-stat-value"
                  style={{ color: bossHp === 0 ? "var(--success)" : "var(--error)" }}
                >
                  {100 - bossHp}%
                </span>
                <span className="battle-stat-label">Boss Damage Dealt</span>
              </div>
              <div className="battle-stat">
                <span className="battle-stat-value" style={{ color: "#eab308" }}>
                  +{score * 20} XP
                </span>
                <span className="battle-stat-label">XP Earned</span>
              </div>
            </div>

            <div className="battle-complete-actions">
              <button
                type="button"
                className="button button-primary button-large"
                onClick={handleFinishBattle}
              >
                🚀 Continue Learning Path →
              </button>
              <button
                type="button"
                className="button button-ghost button-large"
                onClick={() => window.location.reload()}
              >
                🔄 Replay Battle
              </button>
            </div>
          </div>
        )}

        {/* Active Battle Screen */}
        {!loading && battle && currentQuestion < battle.questions.length && (
          <div>
            <div className="battle-header">
              <div style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className="duo-subject-pill">
                  ⚔️ {topic?.name || "Boss Fight"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                  DIFFICULTY: {battle.questions[currentQuestion].difficulty?.toUpperCase() || "NORMAL"}
                </span>
              </div>
              <h1>Boss Battle Mode</h1>
              <div className="battle-progress">
                Question {currentQuestion + 1} of {battle.questions.length} • Score: {score}
              </div>
            </div>

            {/* Boss HP Bar Section */}
            <div className="battle-boss">
              <div className="battle-boss-emoji">👹</div>
              <h2>KNOWLEDGE BOSS</h2>
              <div className="hp-bar-container">
                <div className="hp-bar-background">
                  <div
                    className={`hp-bar-fill ${bossHp <= 30 ? "critical" : bossHp <= 60 ? "low" : ""}`}
                    style={{ width: `${bossHp}%` }}
                  />
                </div>
                <div className="hp-bar-text">
                  Boss HP: <strong>{bossHp}</strong> / 100
                </div>
              </div>
            </div>

            {/* Current Question Card */}
            {(() => {
              const q = battle.questions[currentQuestion];
              const letters = ["A", "B", "C", "D"];

              return (
                <div className="battle-question-card">
                  <h2>{q.question}</h2>

                  <div className="battle-options">
                    {q.options.map((option, idx) => {
                      const isSelected = selectedAnswer === idx;
                      const isOptionCorrect =
                        submitted && idx === Number(q.correctAnswer);
                      const isOptionIncorrect =
                        submitted && isSelected && !lastAnswerCorrect;

                      let btnClass = "battle-option";
                      if (isSelected) btnClass += " selected";
                      if (isOptionCorrect) btnClass += " correct";
                      if (isOptionIncorrect) btnClass += " incorrect";

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={btnClass}
                          disabled={submitted}
                          onClick={() => setSelectedAnswer(idx)}
                        >
                          <span className="battle-option-letter">
                            {letters[idx]}
                          </span>
                          <span style={{ flex: 1 }}>{option}</span>
                          {isOptionCorrect && <span>✓</span>}
                          {isOptionIncorrect && <span>✕</span>}
                        </button>
                      );
                    })}
                  </div>

                  {!submitted && (
                    <button
                      type="button"
                      className="battle-submit-btn"
                      disabled={selectedAnswer === null || submitting}
                      onClick={submitAnswer}
                    >
                      {submitting ? "Checking..." : "Submit Answer ⚡"}
                    </button>
                  )}

                  {submitted && (
                    <div
                      className={`battle-explanation ${lastAnswerCorrect ? "correct-explanation" : "incorrect-explanation"}`}
                    >
                      <h3>
                        {lastAnswerCorrect
                          ? "🎉 Critical Hit! Correct!"
                          : "💥 Ouch! Incorrect answer."}
                      </h3>

                      {!lastAnswerCorrect && (
                        <p>
                          <strong>Correct Answer:</strong>{" "}
                          {q.options[q.correctAnswer]}
                        </p>
                      )}

                      <p>{q.explanation}</p>

                      <button
                        type="button"
                        className="battle-next-btn"
                        onClick={nextQuestion}
                      >
                        {currentQuestion < battle.questions.length - 1
                          ? "Next Question →"
                          : "See Final Results 🏆"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
