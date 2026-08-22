"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="battle-loading-screen">
          <div className="battle-loading-spinner" />
          <div className="battle-loading-text">Summoning Boss Battle...</div>
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
  const [bossHp, setBossHp] = useState(80);
  const [playerHp, setPlayerHp] = useState(50);
  const [wrongCount, setWrongCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Animation states
  const [shakeMonster, setShakeMonster] = useState(false);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [damagePopup, setDamagePopup] = useState(null);
  const [playerDamagePopup, setPlayerDamagePopup] = useState(null);

  // Determine damage dealt to boss based on question difficulty
  function getDamageForQuestion(q) {
    const diff = (q.difficulty || "easy").toLowerCase();
    if (diff === "hard") return 20;
    if (diff === "medium") return 15;
    return 10;
  }

  // Escalating self-damage: 5, 10, 20, 20, 20...
  function getPlayerDamage(currentWrongCount) {
    if (currentWrongCount === 0) return 5;
    if (currentWrongCount === 1) return 10;
    return 20;
  }

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

  // 2. Submit Answer
  const submitAnswer = useCallback(async () => {
    if (selectedAnswer === null || submitted || submitting) return;

    setSubmitting(true);
    try {
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
      applyResult(correct, q);
    } catch (err) {
      console.error("Answer submission error:", err);
      // Fallback local verification
      const q = battle.questions[currentQuestion];
      const correct = selectedAnswer === Number(q.correctAnswer);
      applyResult(correct, q);
    } finally {
      setSubmitting(false);
    }
  }, [selectedAnswer, submitted, submitting, battle, currentQuestion]);

  function applyResult(correct, q) {
    setLastAnswerCorrect(correct);
    setSubmitted(true);

    if (correct) {
      const dmg = getDamageForQuestion(q);
      setScore((prev) => prev + 1);
      setBossHp((prev) => Math.max(prev - dmg, 0));
      setShakeMonster(true);
      setDamagePopup(`-${dmg}`);
      setTimeout(() => {
        setShakeMonster(false);
        setDamagePopup(null);
      }, 600);
    } else {
      const selfDmg = getPlayerDamage(wrongCount);
      setWrongCount((prev) => prev + 1);
      setPlayerHp((prev) => Math.max(prev - selfDmg, 0));
      setShakePlayer(true);
      setPlayerDamagePopup(`-${selfDmg}`);
      setTimeout(() => {
        setShakePlayer(false);
        setPlayerDamagePopup(null);
      }, 600);
    }
  }

  function nextQuestion() {
    setSelectedAnswer(null);
    setSubmitted(false);
    setLastAnswerCorrect(null);
    setCurrentQuestion((prev) => prev + 1);
  }

  // Handle Battle Completion & Mark Mastered (only if boss defeated)
  function handleFinishBattle() {
    if (topicId && bossHp <= 0) {
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

  const isGameOver = playerHp <= 0;
  const isBattleWon = bossHp <= 0;
  const isBattleFinished =
    !loading && battle && (currentQuestion >= battle.questions.length || isGameOver || isBattleWon);
  const isActive = !loading && battle && !isBattleFinished;

  return (
    <div className="boss-arena">
      {/* Full-screen classroom background */}
      <div className="boss-arena-bg" />

      {/* Loading */}
      {loading && (
        <div className="boss-loading-overlay">
          <div className="boss-loading-box">
            <div className="battle-loading-spinner" />
            <p>Generating Boss Battle Questions...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="boss-loading-overlay">
          <div className="boss-loading-box">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#ff4444" }}>Battle Summon Failed</h2>
            <p style={{ color: "#ccc", marginBottom: 20 }}>{error}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                className="boss-btn boss-btn-primary"
                onClick={() => window.location.reload()}
              >
                Retry Battle
              </button>
              <Link href="/learning" className="boss-btn boss-btn-ghost">
                Return to Path
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ===== BATTLE COMPLETE / GAME OVER ===== */}
      {isBattleFinished && (
        <div className="boss-loading-overlay">
          <div className="boss-result-box">
            <div style={{ fontSize: 64, marginBottom: 12 }}>
              {isGameOver ? "💀" : isBattleWon ? "🏆" : bossHp <= 30 ? "⚔️" : "📚"}
            </div>
            <h1>
              {isGameOver
                ? "YOU FELL IN BATTLE!"
                : isBattleWon
                ? "BOSS DEFEATED!"
                : "Battle Complete!"}
            </h1>
            <p style={{ color: "#bbb", fontSize: 15, margin: "8px 0 24px" }}>
              {isGameOver
                ? "The boss overwhelmed you. Study more and try again!"
                : isBattleWon
                ? `Incredible! You destroyed the ${topic?.name || "topic"} Boss!`
                : `You dealt ${80 - bossHp} damage to the Boss.`}
            </p>

            <div className="boss-result-stats">
              <div className="boss-result-stat">
                <span className="stat-val">{score}/{battle?.questions?.length || 10}</span>
                <span className="stat-lbl">Correct</span>
              </div>
              <div className="boss-result-stat">
                <span className="stat-val" style={{ color: bossHp <= 0 ? "#4ade80" : "#f87171" }}>
                  {Math.round(((80 - bossHp) / 80) * 100)}%
                </span>
                <span className="stat-lbl">Boss Damage</span>
              </div>
              <div className="boss-result-stat">
                <span className="stat-val" style={{ color: playerHp > 0 ? "#4ade80" : "#f87171" }}>
                  {playerHp} HP
                </span>
                <span className="stat-lbl">Your Health</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button className="boss-btn boss-btn-primary" onClick={handleFinishBattle}>
                🚀 Continue Learning →
              </button>
              <button className="boss-btn boss-btn-ghost" onClick={() => window.location.reload()}>
                🔄 Replay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ACTIVE BATTLE HUD ===== */}
      {isActive && (() => {
        const q = battle.questions[currentQuestion];
        const letters = ["A", "B", "C", "D"];
        const bossHpPct = (bossHp / 80) * 100;
        const bossMaxHp = 80;
        const playerHpPct = (playerHp / 50) * 100;

        return (
          <>
            {/* TOP HUD: Player HP left, Boss HP right */}
            <div className="boss-hud-top">
              {/* Player Side */}
              <div className="hud-entity hud-player">
                <div className="hud-name">📝 Scholar</div>
                <div className="hud-hp-bar">
                  <div
                    className={`hud-hp-fill hud-hp-player ${playerHpPct <= 30 ? "critical" : playerHpPct <= 60 ? "low" : ""}`}
                    style={{ width: `${playerHpPct}%` }}
                  />
                </div>
                <div className="hud-hp-text">{playerHp} / 50 HP</div>
              </div>

              {/* Question Counter */}
              <div className="hud-center">
                <div className="hud-topic-name">⚔️ {topic?.name || "Boss Fight"}</div>
                <div className="hud-qn-counter">Q{currentQuestion + 1}/{battle.questions.length}</div>
              </div>

              {/* Boss Side */}
              <div className="hud-entity hud-boss">
                <div className="hud-name">👹 Knowledge Boss</div>
                <div className="hud-hp-bar">
                  <div
                    className={`hud-hp-fill hud-hp-boss ${bossHpPct <= 30 ? "critical" : bossHpPct <= 60 ? "low" : ""}`}
                    style={{ width: `${bossHpPct}%` }}
                  />
                </div>
                <div className="hud-hp-text">{bossHp} / 80 HP</div>
              </div>
            </div>

            {/* DAMAGE POPUPS */}
            {damagePopup && (
              <div className="damage-popup damage-popup-boss">{damagePopup}</div>
            )}
            {playerDamagePopup && (
              <div className="damage-popup damage-popup-player">{playerDamagePopup}</div>
            )}

            {/* Monster shake class */}
            <div className={`boss-monster-zone ${shakeMonster ? "shake" : ""}`} />
            <div className={`boss-player-zone ${shakePlayer ? "shake" : ""}`} />

            {/* CHALKBOARD QUESTION AREA - centered in the image */}
            <div className="chalkboard-area">
              <div className="chalkboard-question">
                <div className="chalk-qn-header">
                  <span className="chalk-diff">{(q.difficulty || "easy").toUpperCase()}</span>
                  <span className="chalk-qnum">Question {currentQuestion + 1}</span>
                </div>

                <h2 className="chalk-question-text">{q.question}</h2>

                <div className="chalk-options">
                  {q.options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isOptionCorrect = submitted && idx === Number(q.correctAnswer);
                    const isOptionIncorrect = submitted && isSelected && !lastAnswerCorrect;

                    let cls = "chalk-option";
                    if (isSelected) cls += " selected";
                    if (isOptionCorrect) cls += " correct";
                    if (isOptionIncorrect) cls += " incorrect";

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={cls}
                        disabled={submitted}
                        onClick={() => setSelectedAnswer(idx)}
                      >
                        <span className="chalk-option-letter">{letters[idx]}</span>
                        <span className="chalk-option-text">{option}</span>
                        {isOptionCorrect && <span className="chalk-icon">✓</span>}
                        {isOptionIncorrect && <span className="chalk-icon">✕</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Submit Button */}
                {!submitted && (
                  <button
                    type="button"
                    className="chalk-submit-btn"
                    disabled={selectedAnswer === null || submitting}
                    onClick={submitAnswer}
                  >
                    {submitting ? "Checking..." : "⚡ Attack!"}
                  </button>
                )}

                {/* Result Feedback */}
                {submitted && (
                  <div className={`chalk-feedback ${lastAnswerCorrect ? "correct" : "incorrect"}`}>
                    <div className="chalk-feedback-header">
                      {lastAnswerCorrect
                        ? `🎉 Critical Hit! -${getDamageForQuestion(q)} Boss HP!`
                        : `💥 Boss strikes back! -${getPlayerDamage(wrongCount - 1)} Your HP!`}
                    </div>

                    {!lastAnswerCorrect && (
                      <p className="chalk-correct-answer">
                        Correct: <strong>{q.options[q.correctAnswer]}</strong>
                      </p>
                    )}

                    <p className="chalk-explanation">{q.explanation}</p>

                    <button type="button" className="chalk-next-btn" onClick={nextQuestion}>
                      {currentQuestion < battle.questions.length - 1
                        ? "Next Question →"
                        : "See Results 🏆"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      <style jsx>{`
        /* ==============================
           BOSS ARENA - FULL SCREEN
           ============================== */
        .boss-arena {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        .boss-arena-bg {
          position: absolute;
          inset: 0;
          background: url('/battle-bg.png') center center / cover no-repeat;
          z-index: 0;
        }

        /* ==============================
           LOADING / ERROR / RESULT OVERLAYS
           ============================== */
        .boss-loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(6px);
        }

        .boss-loading-box, .boss-result-box {
          background: rgba(20, 20, 30, 0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 40px 48px;
          text-align: center;
          max-width: 520px;
          width: 90%;
          color: #fff;
        }

        .boss-result-box h1 {
          font-size: 28px;
          margin: 0;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .boss-result-stats {
          display: flex;
          gap: 24px;
          justify-content: center;
        }

        .boss-result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-val {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
        }

        .stat-lbl {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .boss-btn {
          padding: 10px 22px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          text-decoration: none;
          display: inline-block;
          transition: all 0.2s;
        }

        .boss-btn-primary {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #000;
        }

        .boss-btn-primary:hover {
          transform: scale(1.04);
        }

        .boss-btn-ghost {
          background: rgba(255,255,255,0.08);
          color: #ccc;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .boss-btn-ghost:hover {
          background: rgba(255,255,255,0.15);
        }

        /* ==============================
           LOADING SPINNER
           ============================== */
        .battle-loading-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          color: #fff;
        }

        .battle-loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.15);
          border-top-color: #f59e0b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        .battle-loading-text {
          color: #aaa;
          font-size: 14px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ==============================
           TOP HUD BAR
           ============================== */
        .boss-hud-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 14px 24px;
          background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%);
        }

        .hud-entity {
          min-width: 220px;
        }

        .hud-name {
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .hud-hp-bar {
          width: 100%;
          height: 14px;
          background: rgba(255,255,255,0.1);
          border-radius: 7px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .hud-hp-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.5s ease;
        }

        .hud-hp-player {
          background: linear-gradient(90deg, #22c55e, #4ade80);
        }

        .hud-hp-player.low {
          background: linear-gradient(90deg, #eab308, #facc15);
        }

        .hud-hp-player.critical {
          background: linear-gradient(90deg, #ef4444, #f87171);
          animation: pulse-hp 0.8s ease-in-out infinite;
        }

        .hud-hp-boss {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }

        .hud-hp-boss.low {
          background: linear-gradient(90deg, #eab308, #facc15);
        }

        .hud-hp-boss.critical {
          background: linear-gradient(90deg, #22c55e, #4ade80);
          animation: pulse-hp 0.8s ease-in-out infinite;
        }

        @keyframes pulse-hp {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .hud-hp-text {
          font-size: 11px;
          color: #ccc;
          margin-top: 3px;
          font-weight: 700;
        }

        .hud-center {
          text-align: center;
          flex-shrink: 0;
        }

        .hud-topic-name {
          font-size: 14px;
          font-weight: 800;
          color: #fbbf24;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        }

        .hud-qn-counter {
          font-size: 12px;
          color: #aaa;
          margin-top: 2px;
          font-weight: 700;
        }

        /* ==============================
           DAMAGE POPUPS
           ============================== */
        .damage-popup {
          position: absolute;
          z-index: 30;
          font-size: 36px;
          font-weight: 900;
          animation: floatUp 0.6s ease-out forwards;
          text-shadow: 0 2px 12px rgba(0,0,0,0.8);
          pointer-events: none;
        }

        .damage-popup-boss {
          right: 15%;
          top: 35%;
          color: #4ade80;
        }

        .damage-popup-player {
          left: 15%;
          top: 35%;
          color: #f87171;
        }

        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(1.5); opacity: 0; }
        }

        /* ==============================
           SHAKE ANIMATION ZONES
           ============================== */
        .boss-monster-zone, .boss-player-zone {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 100%;
          z-index: 1;
          pointer-events: none;
        }

        .boss-monster-zone.shake, .boss-player-zone.shake {
          animation: shakeEntity 0.4s ease-in-out;
        }

        @keyframes shakeEntity {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }

        /* ==============================
           CHALKBOARD QUESTION AREA
           ============================== */
        .chalkboard-area {
          position: absolute;
          z-index: 10;
          /* Position centered on the chalkboard in the image */
          top: 8%;
          left: 18%;
          right: 18%;
          bottom: 30%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chalkboard-question {
          width: 100%;
          max-width: 680px;
          max-height: 100%;
          overflow-y: auto;
          padding: 28px 32px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }

        .chalkboard-question::-webkit-scrollbar {
          width: 4px;
        }

        .chalkboard-question::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
        }

        .chalk-qn-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .chalk-diff {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .chalk-qnum {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
        }

        .chalk-question-text {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 20px;
          line-height: 1.5;
          text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        }

        /* ==============================
           CHALK OPTIONS
           ============================== */
        .chalk-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .chalk-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.15);
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          color: #e5e5e5;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .chalk-option:hover:not(:disabled) {
          background: rgba(251, 191, 36, 0.12);
          border-color: rgba(251, 191, 36, 0.4);
          transform: translateX(4px);
        }

        .chalk-option.selected {
          background: rgba(251, 191, 36, 0.15);
          border-color: #fbbf24;
          color: #fff;
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);
        }

        .chalk-option.correct {
          background: rgba(34, 197, 94, 0.2);
          border-color: #22c55e;
          color: #4ade80;
        }

        .chalk-option.incorrect {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #f87171;
        }

        .chalk-option-letter {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255,255,255,0.08);
          font-size: 13px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .chalk-option.correct .chalk-option-letter {
          background: rgba(34, 197, 94, 0.3);
        }

        .chalk-option.incorrect .chalk-option-letter {
          background: rgba(239, 68, 68, 0.3);
        }

        .chalk-option-text {
          flex: 1;
        }

        .chalk-icon {
          font-size: 18px;
          font-weight: 900;
        }

        /* ==============================
           SUBMIT / NEXT BUTTONS
           ============================== */
        .chalk-submit-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #000;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .chalk-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .chalk-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }

        /* ==============================
           FEEDBACK AREA
           ============================== */
        .chalk-feedback {
          margin-top: 12px;
          padding: 14px 16px;
          border-radius: 12px;
        }

        .chalk-feedback.correct {
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .chalk-feedback.incorrect {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .chalk-feedback-header {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
        }

        .chalk-correct-answer {
          font-size: 13px;
          color: #4ade80;
          margin: 0 0 6px;
        }

        .chalk-explanation {
          font-size: 13px;
          color: #bbb;
          margin: 0 0 12px;
          line-height: 1.5;
        }

        .chalk-next-btn {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          background: rgba(255,255,255,0.12);
          color: #fff;
          transition: all 0.2s;
        }

        .chalk-next-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }

        /* ==============================
           RESPONSIVE - TABLET & MOBILE
           ============================== */
        @media (max-width: 900px) {
          .boss-hud-top {
            padding: 10px 14px;
            gap: 10px;
          }

          .hud-entity {
            min-width: 160px;
          }

          .hud-name {
            font-size: 11px;
          }

          .chalkboard-area {
            left: 12%;
            right: 12%;
            top: 10%;
            bottom: 28%;
          }

          .chalk-question-text {
            font-size: 16px;
          }
        }

        @media (max-width: 768px) {
          .boss-hud-top {
            padding: 8px 10px;
            flex-wrap: wrap;
            gap: 6px;
          }

          .hud-entity {
            min-width: 0;
            flex: 1;
          }

          .hud-hp-bar {
            height: 10px;
          }

          .hud-hp-text {
            font-size: 10px;
          }

          .hud-name {
            font-size: 10px;
            margin-bottom: 4px;
          }

          .hud-center {
            order: -1;
            width: 100%;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 6px;
            margin-bottom: 2px;
          }

          .hud-topic-name {
            font-size: 12px;
          }

          .hud-qn-counter {
            font-size: 11px;
          }

          /* On mobile the bg image doesn't show characters well,
             so expand the question area to full width */
          .chalkboard-area {
            top: 15%;
            left: 2%;
            right: 2%;
            bottom: 2%;
          }

          .chalkboard-question {
            padding: 18px 16px;
            background: rgba(0,0,0,0.55);
            border-radius: 12px;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.08);
          }

          .chalk-question-text {
            font-size: 15px;
            margin-bottom: 14px;
          }

          .chalk-option {
            padding: 10px 12px;
            font-size: 13px;
          }

          .chalk-option-letter {
            width: 24px;
            height: 24px;
            font-size: 12px;
          }

          .chalk-submit-btn {
            font-size: 14px;
            padding: 12px;
          }

          .chalk-feedback-header {
            font-size: 13px;
          }

          .chalk-explanation {
            font-size: 12px;
          }

          .damage-popup {
            font-size: 26px;
          }

          .boss-result-stats {
            flex-direction: column;
            gap: 10px;
          }

          .boss-loading-box, .boss-result-box {
            padding: 28px 20px;
          }
        }

        @media (max-width: 480px) {
          .boss-hud-top {
            padding: 6px 8px;
          }

          .hud-hp-bar {
            height: 8px;
          }

          .chalkboard-area {
            top: 18%;
            left: 1%;
            right: 1%;
            bottom: 1%;
          }

          .chalkboard-question {
            padding: 14px 12px;
          }

          .chalk-qn-header {
            margin-bottom: 8px;
          }

          .chalk-question-text {
            font-size: 14px;
            margin-bottom: 12px;
          }

          .chalk-options {
            gap: 6px;
          }

          .chalk-option {
            padding: 9px 10px;
            font-size: 12px;
            border-radius: 8px;
          }

          .chalk-submit-btn {
            padding: 10px;
            font-size: 13px;
            border-radius: 8px;
          }

          .stat-val {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
