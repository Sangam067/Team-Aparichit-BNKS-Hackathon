"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import Navbar from "../components/Navbar";

const markdownPlugins = [remarkMath];
const markdownRehypePlugins = [rehypeKatex];

function normalizeStudyText(value) {
  const text = String(value)
    .replace(/\\\(([^]*?)\\\)/g, (_match, expression) => `$${expression}$`)
    .replace(/\\\[([^]*?)\\\]/g, (_match, expression) => `$$${expression}$$`)
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/`((?:\\\(|\\\[|\$\$)[\s\S]*?(?:\\\)|\\\]|\$\$))`/g, "$1");
  const mathBlocks = [];
  const textWithoutMath = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, (match) => {
    mathBlocks.push(match);
    return `@@MATH_${mathBlocks.length - 1}@@`;
  });
  let normalized = "";
  let cursor = 0;

  while (cursor < textWithoutMath.length) {
    const opening = textWithoutMath.indexOf("(", cursor);
    if (opening === -1) {
      normalized += textWithoutMath.slice(cursor);
      break;
    }

    normalized += textWithoutMath.slice(cursor, opening);
    if (opening > 0 && textWithoutMath[opening - 1] === "\\") {
      normalized += "(";
      cursor = opening + 1;
      continue;
    }

    let depth = 1;
    let closing = opening + 1;
    while (closing < textWithoutMath.length && depth > 0) {
      if (textWithoutMath[closing] === "(") depth += 1;
      if (textWithoutMath[closing] === ")") depth -= 1;
      closing += 1;
    }

    if (depth !== 0) {
      normalized += textWithoutMath.slice(opening);
      break;
    }

    const content = textWithoutMath.slice(opening + 1, closing - 1);
    const looksLikeMath = /\\[a-zA-Z]+|[_^=]|\b(?:sin|cos|tan|log|ln)\b/.test(content);
    normalized += looksLikeMath ? `$${content}$` : `(${content})`;
    cursor = closing;
  }

  return normalized.replace(/@@MATH_(\d+)@@/g, (_match, index) => mathBlocks[Number(index)]);
}

function RichText({ children, className = "", inline = false }) {
  if (!children) return null;

  return (
    <span className={`study-rich-text ${inline ? "study-rich-text-inline" : ""} ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={markdownPlugins}
        rehypePlugins={markdownRehypePlugins}
        components={inline ? { p: ({ children: content }) => <>{content}</> } : undefined}
      >
        {normalizeStudyText(children)}
      </ReactMarkdown>
    </span>
  );
}

export default function LearningPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-container" style={{ minHeight: "100vh" }}>
          <div className="loading-spinner" />
          <div className="loading-text">Loading Learning Roadmap...</div>
        </div>
      }
    >
      <LearningContent />
    </Suspense>
  );
}

function LearningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSubjectId = searchParams.get("subjectId");

  const [subjects, setSubjects] = useState([]);
  const [currentSubjectId, setCurrentSubjectId] = useState("");
  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected topic for hover square bar & study modal
  const [activeHoverTopicId, setActiveHoverTopicId] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [studyPack, setStudyPack] = useState(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");

  // Mastered topics stored locally (only set when demon is defeated)
  const [masteredTopics, setMasteredTopics] = useState(new Set());

  // 1. Load Mastered Topics & Available Subjects
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gameedu_mastered_topics");
      if (stored) {
        setMasteredTopics(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }

    async function loadSubjects() {
      try {
        const res = await fetch("/api/subjects");
        const data = await res.json();

        if (data.success && data.subjects.length > 0) {
          setSubjects(data.subjects);

          const targetId =
            requestedSubjectId &&
            data.subjects.some((s) => String(s.id) === String(requestedSubjectId))
              ? String(requestedSubjectId)
              : String(data.subjects[0].id);

          setCurrentSubjectId(targetId);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
        setError("Failed to load subjects.");
        setLoading(false);
      }
    }

    loadSubjects();
  }, [requestedSubjectId]);

  // 2. Load Curriculum for Current Subject
  useEffect(() => {
    if (!currentSubjectId) return;

    async function loadCurriculum() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/curriculum/${currentSubjectId}`);
        const data = await res.json();

        if (data.success) {
          setCurriculum(data.subject);
        } else {
          setError(data.error || "Failed to load curriculum.");
        }
      } catch (err) {
        console.error("Curriculum load error:", err);
        setError("Failed to load curriculum pathway.");
      } finally {
        setLoading(false);
      }
    }

    loadCurriculum();
  }, [currentSubjectId]);

  // 3. Open Study Pack Theory for a Topic
  async function openTopicStudy(topic) {
    setSelectedTopic(topic);
    setStudyPack(null);
    setStudyError("");
    setStudyLoading(true);

    try {
      const res = await fetch(`/api/topics/${topic.id}/study`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate study pack.");
      }

      setStudyPack(data.studyPack);
    } catch (err) {
      console.error("Study generation error:", err);
      setStudyError(err.message || "Failed to generate study pack.");
    } finally {
      setStudyLoading(false);
    }
  }

  // Flatten all topics across chapters
  const allTopics =
    curriculum?.chapters?.flatMap((ch) => ch.topics || []) || [];

  // Compute progress stats
  const totalTopics = allTopics.length;
  const masteredCount = allTopics.filter((t) => masteredTopics.has(t.id)).length;
  const progressPct = totalTopics > 0 ? Math.round((masteredCount / totalTopics) * 100) : 0;

  // Per-chapter stats
  function getChapterProgress(chapter) {
    const topics = chapter.topics || [];
    const total = topics.length;
    const mastered = topics.filter((t) => masteredTopics.has(t.id)).length;
    return { total, mastered, pct: total > 0 ? Math.round((mastered / total) * 100) : 0 };
  }

  function getTopicStatus(topic) {
    if (masteredTopics.has(topic.id)) return "MASTERED";
    return "UNLOCKED"; // All topics are unlocked — no locking
  }

  return (
    <div className="app-page-wrapper">
      <div className="app-backdrop" aria-hidden="true" />
      <Navbar />

      <main className="page-shell">
        {/* Subject Header & Switcher */}
        <div className="roadmap-page-header">
          <div className="roadmap-subject-title">
            <span className="subject-tag">Learning Pathway</span>
            <h1>{curriculum?.name || "Subject Curriculum"}</h1>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {subjects.length > 1 && (
              <select
                value={currentSubjectId}
                onChange={(e) => {
                  setCurrentSubjectId(e.target.value);
                  router.push(`/learning?subjectId=${e.target.value}`);
                }}
                style={{
                  background: "rgba(3, 8, 3, 0.6)",
                  border: "1px solid var(--accent-border)",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}

            <Link href="/syllabus" className="button button-primary button-small">
              + Upload New Syllabus
            </Link>
          </div>
        </div>

        {/* ===== PROGRESS DASHBOARD ===== */}
        {!loading && curriculum && totalTopics > 0 && (
          <div className="progress-dashboard">
            <div className="progress-dashboard-main">
              {/* Circular Progress Ring */}
              <div className="progress-ring-wrapper">
                <svg viewBox="0 0 120 120" className="progress-ring-svg">
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke="url(#progressGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPct / 100)}`}
                    style={{ transition: "stroke-dashoffset 0.8s ease", transform: "rotate(-90deg)", transformOrigin: "center" }}
                  />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="progress-ring-text">
                  <span className="progress-ring-pct">{progressPct}%</span>
                  <span className="progress-ring-label">Mastered</span>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="progress-stats-grid">
                <div className="progress-stat-card">
                  <div className="stat-card-icon">📚</div>
                  <div className="stat-card-value">{totalTopics}</div>
                  <div className="stat-card-label">Total Topics</div>
                </div>
                <div className="progress-stat-card">
                  <div className="stat-card-icon">⚔️</div>
                  <div className="stat-card-value">{masteredCount}</div>
                  <div className="stat-card-label">Demons Defeated</div>
                </div>
                <div className="progress-stat-card">
                  <div className="stat-card-icon">🔓</div>
                  <div className="stat-card-value">{totalTopics - masteredCount}</div>
                  <div className="stat-card-label">Remaining</div>
                </div>
                <div className="progress-stat-card">
                  <div className="stat-card-icon">📖</div>
                  <div className="stat-card-value">{curriculum?.chapters?.length || 0}</div>
                  <div className="stat-card-label">Chapters</div>
                </div>
              </div>
            </div>

            {/* Chapter-level progress bars */}
            <div className="chapter-progress-bars">
              {curriculum.chapters?.map((chapter, idx) => {
                const cp = getChapterProgress(chapter);
                return (
                  <div className="chapter-progress-item" key={chapter.id}>
                    <div className="chapter-progress-label">
                      <span className="chapter-progress-name">
                        Ch {chapter.chapterNumber || idx + 1}: {chapter.name}
                      </span>
                      <span className="chapter-progress-count">
                        {cp.mastered}/{cp.total} ({cp.pct}%)
                      </span>
                    </div>
                    <div className="chapter-progress-bar">
                      <div
                        className="chapter-progress-fill"
                        style={{ width: `${cp.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && subjects.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📚</div>
            <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>No Syllabus Uploaded Yet</h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto 28px" }}>
              Upload your textbook table-of-contents or course syllabus image/PDF to construct your learning roadmap.
            </p>
            <Link href="/syllabus" className="button button-primary button-large">
              📷 Upload Syllabus
            </Link>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <div className="loading-text">Loading circular learning roadmap...</div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Unable to Load Pathway</h2>
            <p>{error}</p>
            <Link href="/syllabus" className="button button-primary button-small" style={{ marginTop: 16 }}>
              Upload Syllabus
            </Link>
          </div>
        )}

        {/* Circular Roadmap Track */}
        {!loading && curriculum && curriculum.chapters && (
          <div className="roadmap-container">
            {curriculum.chapters.map((chapter, chapterIdx) => {
              const chapterTopics = chapter.topics || [];
              const cp = getChapterProgress(chapter);

              return (
                <section className="roadmap-chapter-unit" key={chapter.id}>
                  {/* Chapter Header Banner */}
                  <div className="roadmap-chapter-header">
                    <div>
                      <div className="chapter-num">
                        CHAPTER {chapter.chapterNumber || chapterIdx + 1}
                      </div>
                      <h2>{chapter.name}</h2>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>
                        {cp.mastered}/{cp.total} Mastered
                      </span>
                      {cp.pct === 100 && (
                        <span className="chapter-badge-complete">✓ Complete</span>
                      )}
                      {chapterTopics.length > 0 && (
                        <button
                          type="button"
                          className="button button-small button-ghost"
                          style={{ border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: 12, padding: "5px 12px", minHeight: 32 }}
                          onClick={() => openTopicStudy(chapterTopics[0])}
                        >
                          📖 Study Chapter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vertical Circular Nodes Flow */}
                  <div className="roadmap-nodes-flow">
                    {chapterTopics.map((topic, topicIdx) => {
                      const status = getTopicStatus(topic);
                      const isMastered = status === "MASTERED";
                      const isSelected = activeHoverTopicId === topic.id;

                      const formattedNum = String(
                        topic.orderIndex || topicIdx + 1
                      ).padStart(2, "0");

                      const isAltLeft = topicIdx % 2 === 1;

                      return (
                        <div
                          key={topic.id}
                          className={`roadmap-node-item ${isAltLeft ? "alt-left" : ""} ${isSelected ? "is-selected" : ""}`}
                          onMouseEnter={() => setActiveHoverTopicId(topic.id)}
                          onMouseLeave={() => setActiveHoverTopicId(null)}
                        >
                          {/* Circular Roadmap Node */}
                          <button
                            type="button"
                            className={`roadmap-circle-node ${isMastered ? "mastered" : "active"}`}
                            onClick={() => {
                              if (activeHoverTopicId === topic.id) {
                                openTopicStudy(topic);
                              } else {
                                setActiveHoverTopicId(topic.id);
                              }
                            }}
                            title={`${topic.name} (${status})`}
                            aria-label={`${topic.name} - ${status}`}
                          >
                            {isMastered ? (
                              <span className="node-icon">✓</span>
                            ) : (
                              <span className="node-num">{formattedNum}</span>
                            )}
                          </button>

                          <span className="roadmap-node-label-small">
                            {topic.name}
                          </span>

                          {/* Square Bar Popover on Hover / Click */}
                          <div className="roadmap-hover-square">
                            <div className="hover-square-header">
                              <span className="square-tag">
                                Topic #{topic.orderIndex || topicIdx + 1} • {isMastered ? "MASTERED ✓" : "READY"}
                              </span>
                              <h3>{topic.name}</h3>
                            </div>

                            <div className="hover-square-actions">
                              <button
                                type="button"
                                className="hover-action-btn hover-action-study"
                                onClick={() => openTopicStudy(topic)}
                              >
                                📖 Study
                              </button>
                              <Link
                                href={`/battle?topicId=${topic.id}`}
                                className="hover-action-btn hover-action-battle"
                              >
                                ⚔️ Battle
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ===== STUDY SPACE FULLSCREEN MODAL ===== */}
        {selectedTopic && (
          <StudySpace
            topic={selectedTopic}
            studyPack={studyPack}
            studyLoading={studyLoading}
            studyError={studyError}
            onClose={() => setSelectedTopic(null)}
            onRetry={() => openTopicStudy(selectedTopic)}
          />
        )}
      </main>

      <style jsx>{`
        /* ===== PROGRESS DASHBOARD ===== */
        .progress-dashboard {
          margin-bottom: 36px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 28px 32px;
        }

        .progress-dashboard-main {
          display: flex;
          align-items: center;
          gap: 36px;
          margin-bottom: 24px;
        }

        /* Circular Progress Ring */
        .progress-ring-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          flex-shrink: 0;
        }

        .progress-ring-svg {
          width: 100%;
          height: 100%;
        }

        .progress-ring-text {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .progress-ring-pct {
          font-size: 28px;
          font-weight: 900;
          color: #4ade80;
          line-height: 1;
        }

        .progress-ring-label {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 2px;
        }

        /* Stats Grid */
        .progress-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          flex: 1;
        }

        .progress-stat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          transition: all 0.2s;
        }

        .progress-stat-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
        }

        .stat-card-icon {
          font-size: 24px;
          margin-bottom: 6px;
        }

        .stat-card-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
        }

        .stat-card-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 4px;
        }

        /* Chapter Progress Bars */
        .chapter-progress-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 20px;
        }

        .chapter-progress-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .chapter-progress-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chapter-progress-name {
          font-size: 13px;
          font-weight: 600;
          color: #ddd;
        }

        .chapter-progress-count {
          font-size: 12px;
          color: #888;
          font-weight: 700;
        }

        .chapter-progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
          overflow: hidden;
        }

        .chapter-progress-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #22c55e, #4ade80);
          transition: width 0.6s ease;
        }

        /* Chapter Complete Badge */
        .chapter-badge-complete {
          font-size: 11px;
          font-weight: 800;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid rgba(34,197,94,0.25);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .progress-dashboard-main {
            flex-direction: column;
            gap: 20px;
          }

          .progress-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .progress-ring-wrapper {
            width: 100px;
            height: 100px;
          }

          .progress-ring-pct {
            font-size: 22px;
          }

          .stat-card-value {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
//  STUDY SPACE — Full-screen study environment
// ============================================================
function StudySpace({ topic, studyPack, studyLoading, studyError, onClose, onRetry }) {
  const [activeTab, setActiveTab] = useState("theory");
  const [timerMin, setTimerMin] = useState(25);
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState("25:00");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  // Timer logic
  useEffect(() => {
    let remaining = timerMin * 60 + timerSec;
    if (!timerRunning) return;
    const iv = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(iv);
        setTimerRunning(false);
        setTimerDisplay("00:00");
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setTimerDisplay(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [timerRunning]);

  function startPauseTimer() {
    if (!timerRunning) {
      // Re-init display from inputs when starting fresh
      const total = timerMin * 60 + timerSec;
      if (total === 0) return;
      setTimerDisplay(`${String(timerMin).padStart(2,"0")}:${String(timerSec).padStart(2,"0")}`);
    }
    setTimerRunning((v) => !v);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerDisplay(`${String(timerMin).padStart(2,"0")}:${String(timerSec).padStart(2,"0")}`);
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setTasks((previousTasks) => [...previousTasks, { text, done: false }]);
    setNewTask("");
  }

  function toggleTask(index) {
    setTasks((previousTasks) => previousTasks.map((task, taskIndex) => (
      taskIndex === index ? { ...task, done: !task.done } : task
    )));
  }

  const tabs = [
    { id: "theory", label: "Theory" },
    { id: "examples", label: "Examples" },
    { id: "formulas", label: "Formulas" },
    { id: "resources", label: "Resources" },
  ];

  return (
    <div className="ss-overlay">
      <div className="ss-shell">

        {/* ---- HEADER ---- */}
        <div className="ss-header">
          <div className="ss-header-left">
            <span className="ss-topic-tag">Topic {topic?.orderIndex || 1}</span>
            <h1 className="ss-topic-title">{topic?.name}</h1>
          </div>
          <div className="ss-header-right">
            <Link href={`/battle?topicId=${topic?.id}`} className="ss-battle-btn">
              <span aria-hidden="true">⚔</span>
              <span>Fight demon boss</span>
            </Link>
            <button className="ss-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* ---- MAIN LAYOUT ---- */}
        <div className="ss-body">

          {/* LEFT: Timer + Content Tabs */}
          <div className="ss-main">

            {/* Timer */}
            <div className="ss-timer-card">
              <div className="ss-timer-label">Study Timer</div>
              <div className="ss-timer-display">{timerDisplay}</div>
              <div className="ss-timer-inputs">
                <div className="ss-time-field">
                  <input
                    type="number" min={0} max={99}
                    value={timerMin}
                    onChange={(e) => { setTimerMin(Number(e.target.value)); setTimerRunning(false); }}
                    className="ss-time-input"
                  />
                  <span className="ss-time-unit">min</span>
                </div>
                <div className="ss-time-sep">:</div>
                <div className="ss-time-field">
                  <input
                    type="number" min={0} max={59}
                    value={timerSec}
                    onChange={(e) => { setTimerSec(Number(e.target.value)); setTimerRunning(false); }}
                    className="ss-time-input"
                  />
                  <span className="ss-time-unit">sec</span>
                </div>
              </div>
              <div className="ss-timer-btns">
                <button className="ss-btn ss-btn-primary" onClick={startPauseTimer}>
                  {timerRunning ? "Pause" : "Start"}
                </button>
                <button className="ss-btn ss-btn-ghost" onClick={resetTimer}>Reset</button>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="ss-content-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`ss-tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {studyLoading && (
              <div className="ss-loading">
                <div className="ss-spinner" />
                <p>Generating study content...</p>
              </div>
            )}

            {/* Error */}
            {studyError && !studyLoading && (
              <div className="ss-error">
                <p>{studyError}</p>
                <button className="ss-btn ss-btn-ghost" onClick={onRetry}>Retry</button>
              </div>
            )}

            {/* Content Panel */}
            {studyPack && !studyLoading && (
              <div className="ss-content-panel">

                {/* Theory Tab */}
                {activeTab === "theory" && studyPack.theory && (
                  <div className="ss-tab-content">
                    <RichText className="ss-overview">{studyPack.theory.overview}</RichText>
                    {studyPack.theory.concepts?.map((c, i) => (
                      <div className="ss-concept" key={i}>
                        <h3 className="ss-concept-title"><RichText inline>{c.title}</RichText></h3>
                        <RichText className="ss-concept-body">{c.explanation}</RichText>
                      </div>
                    ))}
                    {studyPack.theory.keyPoints?.length > 0 && (
                      <div className="ss-keypoints">
                        <div className="ss-section-label">Key Takeaways</div>
                        <ul>
                          {studyPack.theory.keyPoints.map((pt, i) => (
                            <li key={i}><RichText>{pt}</RichText></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Examples Tab */}
                {activeTab === "examples" && (
                  <div className="ss-tab-content">
                    {(studyPack.examples || []).map((ex, i) => (
                      <div className="ss-example" key={i}>
                        <div className="ss-example-title"><RichText inline>{ex.title || `Example ${i + 1}`}</RichText></div>
                        <div className="ss-example-row">
                          <span className="ss-ex-label">Question</span>
                          <RichText>{ex.question}</RichText>
                        </div>
                        <div className="ss-example-row">
                          <span className="ss-ex-label ss-ex-label-solution">Solution</span>
                          <RichText>{ex.solution}</RichText>
                        </div>
                        {ex.explanation && <RichText className="ss-ex-note">{ex.explanation}</RichText>}
                      </div>
                    ))}
                    {(!studyPack.examples || studyPack.examples.length === 0) && (
                      <p className="ss-empty">No examples available for this topic.</p>
                    )}
                  </div>
                )}

                {/* Formulas Tab */}
                {activeTab === "formulas" && (
                  <div className="ss-tab-content">
                    {(studyPack.formulas || []).map((f, i) => (
                      <div className="ss-formula" key={i}>
                        <h3 className="ss-formula-name"><RichText inline>{f.name}</RichText></h3>
                        <RichText className="ss-formula-expr">{f.formula}</RichText>
                        <RichText className="ss-formula-meaning">{f.meaning}</RichText>
                        {f.variables?.length > 0 && (
                          <ul className="ss-formula-vars">
                            {f.variables.map((v, vi) => (
                              <li key={vi}><strong><RichText inline>{v.symbol}</RichText></strong> — <RichText inline>{v.meaning}</RichText></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {(!studyPack.formulas || studyPack.formulas.length === 0) && (
                      <p className="ss-empty">No formulas for this topic.</p>
                    )}
                  </div>
                )}

                {/* Resources Tab */}
                {activeTab === "resources" && (
                  <div className="ss-tab-content">
                    {(studyPack.aiResources || []).map((r, i) => (
                      <div className="ss-resource" key={i}>
                        <h3 className="ss-resource-title"><RichText inline>{r.title}</RichText></h3>
                        <RichText>{r.description}</RichText>
                      </div>
                    ))}
                    {(!studyPack.aiResources || studyPack.aiResources.length === 0) && (
                      <p className="ss-empty">No resources available.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="ss-sidebar">

            {/* User-created Tasks */}
            <div className="ss-tasks-card">
              <div className="ss-card-header">Study tasks</div>
              <div className="ss-task-input-row">
                <input
                  className="ss-task-input"
                  placeholder="Add a task..."
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") addTask(); }}
                />
                <button className="ss-btn ss-btn-primary" onClick={addTask} type="button">
                  Add
                </button>
              </div>
              {tasks.length > 0 && (
                <ul className="ss-task-list">
                  {tasks.map((task, index) => (
                    <li key={`${task.text}-${index}`} className={`ss-task-item ${task.done ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(index)}
                        className="ss-checkbox"
                      />
                      <span className="ss-task-text">{task.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notes */}
            <div className="ss-notes-card">
              <div className="ss-card-header">Quick Notes</div>
              <textarea
                className="ss-notes-area"
                placeholder="Write notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ============================================================
           STUDY SPACE STYLES
        ============================================================ */
        .ss-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        .ss-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #0d0f14;
          overflow: hidden;
        }

        /* ---- HEADER ---- */
        .ss-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          gap: 16px;
        }

        .ss-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ss-topic-tag {
          font-size: 11px;
          font-weight: 700;
          color: #6ee7b7;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .ss-topic-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          line-height: 1.2;
        }

        .ss-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .ss-battle-btn {
          padding: 9px 18px;
          border-radius: 10px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .ss-battle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(220,38,38,0.35);
        }

        .ss-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #999;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .ss-close-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        /* ---- BODY ---- */
        .ss-body {
          display: grid;
          grid-template-columns: 1fr 320px;
          flex: 1;
          overflow: hidden;
        }

        /* ---- MAIN ---- */
        .ss-main {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid rgba(255,255,255,0.06);
        }

        /* Timer */
        .ss-timer-card {
          padding: 16px 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 20px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .ss-timer-label {
          font-size: 11px;
          font-weight: 700;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .ss-timer-display {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.05em;
          min-width: 80px;
        }

        .ss-timer-inputs {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ss-time-field {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ss-time-input {
          width: 52px;
          text-align: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #fff;
          padding: 6px 8px;
          font-size: 14px;
          font-weight: 700;
        }

        .ss-time-input::-webkit-inner-spin-button,
        .ss-time-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        .ss-time-unit {
          font-size: 12px;
          color: #555;
          font-weight: 600;
        }

        .ss-time-sep {
          font-size: 18px;
          color: #444;
          font-weight: 700;
        }

        .ss-timer-btns {
          display: flex;
          gap: 8px;
        }

        /* Content Tabs */
        .ss-content-tabs {
          display: flex;
          gap: 2px;
          padding: 12px 28px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          overflow-x: auto;
        }

        .ss-tab {
          padding: 9px 18px;
          border: none;
          background: transparent;
          color: #666;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px 8px 0 0;
          transition: all 0.15s;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
        }

        .ss-tab:hover {
          color: #ccc;
          background: rgba(255,255,255,0.04);
        }

        .ss-tab.active {
          color: #fff;
          border-bottom-color: #6ee7b7;
          background: rgba(110,231,183,0.06);
        }

        .ss-content-panel {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }

        .ss-content-panel::-webkit-scrollbar { width: 4px; }
        .ss-content-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* Loading / Error */
        .ss-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 48px 28px;
          color: #666;
          font-size: 14px;
        }

        .ss-spinner {
          width: 32px;
          height: 32px;
          border: 2px solid rgba(255,255,255,0.08);
          border-top-color: #6ee7b7;
          border-radius: 50%;
          animation: ss-spin 0.7s linear infinite;
        }

        @keyframes ss-spin { to { transform: rotate(360deg); } }

        .ss-error {
          padding: 24px 28px;
          color: #f87171;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Tab Content */
        .ss-tab-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ss-overview {
          font-size: 15px;
          line-height: 1.7;
          color: #c8d1e0;
          margin: 0;
        }

        .ss-concept {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px 18px;
        }

        .ss-concept-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 6px;
        }

        .ss-concept-body {
          font-size: 14px;
          color: #9aa5b8;
          line-height: 1.6;
          margin: 0;
        }

        .ss-keypoints {
          margin-top: 4px;
        }

        .ss-section-label {
          font-size: 11px;
          font-weight: 800;
          color: #6ee7b7;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
        }

        .ss-keypoints ul {
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ss-keypoints li {
          font-size: 14px;
          color: #9aa5b8;
          line-height: 1.5;
        }

        .ss-example {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ss-example-title {
          font-size: 13px;
          font-weight: 800;
          color: #6ee7b7;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ss-example-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ss-example-row p {
          font-size: 14px;
          color: #c8d1e0;
          line-height: 1.6;
          margin: 0;
        }

        .ss-ex-label {
          font-size: 11px;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ss-ex-label-solution {
          color: #4ade80;
        }

        .ss-ex-note {
          font-size: 12px;
          color: #666;
          margin: 0;
          font-style: italic;
        }

        .ss-formula {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px 18px;
        }

        .ss-formula-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 10px;
        }

        .ss-formula-expr {
          display: block;
          background: rgba(110,231,183,0.06);
          border: 1px solid rgba(110,231,183,0.15);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 15px;
          color: #6ee7b7;
          font-family: 'Courier New', monospace;
          margin-bottom: 10px;
          word-break: break-all;
        }

        .ss-formula-meaning {
          font-size: 13px;
          color: #9aa5b8;
          margin: 0 0 10px;
        }

        .ss-formula-vars {
          padding-left: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ss-formula-vars li {
          font-size: 13px;
          color: #777;
        }

        .ss-formula-vars strong {
          color: #ccc;
        }

        .ss-resource {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px 18px;
        }

        .ss-resource-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 6px;
        }

        .ss-resource p {
          font-size: 14px;
          color: #9aa5b8;
          line-height: 1.6;
          margin: 0;
        }

        .ss-empty {
          font-size: 14px;
          color: #555;
          padding: 24px 0;
          text-align: center;
        }

        /* ---- SIDEBAR ---- */
        .ss-sidebar {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.2);
        }

        .ss-card-header {
          font-size: 12px;
          font-weight: 800;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        /* Chat */
        .ss-chat-card {
          display: flex;
          flex-direction: column;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .ss-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }

        .ss-chat-messages::-webkit-scrollbar { width: 3px; }
        .ss-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        .ss-msg { display: flex; }

        .ss-msg-user { justify-content: flex-end; }
        .ss-msg-ai { justify-content: flex-start; }

        .ss-msg-bubble {
          max-width: 85%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .ss-msg-user .ss-msg-bubble {
          background: rgba(110,231,183,0.12);
          color: #d1fae5;
          border: 1px solid rgba(110,231,183,0.2);
          border-radius: 10px 10px 2px 10px;
        }

        .ss-msg-ai .ss-msg-bubble {
          background: rgba(255,255,255,0.05);
          color: #c8d1e0;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px 10px 10px 2px;
        }

        .ss-msg-thinking {
          color: #555;
          font-style: italic;
        }

        .ss-chat-input-row {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }

        .ss-chat-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #fff;
          padding: 8px 12px;
          font-size: 13px;
          min-width: 0;
        }

        .ss-chat-input::placeholder { color: #444; }
        .ss-chat-input:focus { outline: none; border-color: rgba(110,231,183,0.3); }

        .ss-send-btn {
          padding: 8px 14px;
          font-size: 12px;
          flex-shrink: 0;
        }

        /* Tasks */
        .ss-tasks-card {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 8px;
          flex-shrink: 0;
        }

        .ss-task-input-row {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .ss-task-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #fff;
          padding: 7px 10px;
          font-size: 13px;
          min-width: 0;
        }

        .ss-task-input::placeholder { color: #444; }
        .ss-task-input:focus { outline: none; border-color: rgba(110,231,183,0.3); }

        .ss-task-list {
          list-style: none;
          padding: 0 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 140px;
          overflow-y: auto;
        }

        .ss-task-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 10px;
          background: rgba(255,255,255,0.03);
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .ss-task-item.done .ss-task-text {
          text-decoration: line-through;
          color: #444;
        }

        .ss-checkbox {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          accent-color: #6ee7b7;
          cursor: pointer;
        }

        .ss-task-text {
          font-size: 13px;
          color: #9aa5b8;
          flex: 1;
          line-height: 1.4;
        }

        /* Notes */
        .ss-notes-card {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          min-height: 140px;
        }

        .ss-notes-area {
          flex: 1;
          background: transparent;
          border: none;
          color: #9aa5b8;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.6;
          resize: none;
          min-height: 120px;
        }

        .ss-notes-area::placeholder { color: #333; }
        .ss-notes-area:focus { outline: none; }

        /* Shared buttons */
        .ss-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .ss-btn-primary {
          background: #6ee7b7;
          color: #000;
        }

        .ss-btn-primary:hover:not(:disabled) {
          background: #4ade80;
        }

        .ss-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ss-btn-ghost {
          background: rgba(255,255,255,0.06);
          color: #ccc;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .ss-btn-ghost:hover {
          background: rgba(255,255,255,0.1);
        }

        /* ---- RESPONSIVE ---- */
        @media (max-width: 900px) {
          .ss-body {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }

          .ss-main {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .ss-sidebar {
            max-height: 320px;
            flex-direction: row;
            overflow-x: auto;
            flex-shrink: 0;
          }

          .ss-chat-card {
            min-width: 280px;
            flex: 1;
            border-right: 1px solid rgba(255,255,255,0.06);
            border-bottom: none;
          }

          .ss-tasks-card, .ss-notes-card {
            min-width: 220px;
            border-bottom: none;
            border-right: 1px solid rgba(255,255,255,0.06);
          }
        }

        @media (max-width: 600px) {
          .ss-header {
            padding: 12px 16px;
            flex-wrap: wrap;
          }

          .ss-topic-title {
            font-size: 16px;
          }

          .ss-timer-card {
            padding: 12px 16px;
            gap: 12px;
          }

          .ss-timer-display {
            font-size: 22px;
          }

          .ss-content-tabs {
            padding: 8px 16px 0;
          }

          .ss-content-panel {
            padding: 16px;
          }

          .ss-card-header {
            padding: 10px 12px 8px;
          }
        }

        /* Reading-first palette: keep the study workspace separate from the battle arena. */
        .ss-overlay {
          background: rgba(58, 52, 43, 0.62);
          backdrop-filter: blur(10px);
          color: #2b2a25;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
        }

        .ss-shell {
          background: #f4f0e8;
          color: #2b2a25;
        }

        .ss-body {
          grid-template-columns: minmax(0, 1fr) 280px;
        }

        .ss-battle-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 44px;
          padding: 11px 22px;
          border-radius: 9px;
          border: 1px solid rgba(145, 55, 43, 0.75);
          background: #b94f3d;
          color: #fffaf6;
          box-shadow: 0 5px 14px rgba(185, 79, 61, 0.2);
          font-size: 14px;
          font-weight: 750;
          line-height: 1;
          text-decoration: none;
          animation: ss-battle-glow 2.4s ease-in-out infinite;
        }

        .ss-battle-btn:hover {
          background: #a44131;
          box-shadow: 0 7px 18px rgba(185, 79, 61, 0.28);
          animation-play-state: paused;
        }

        .ss-battle-btn:focus-visible {
          outline: 3px solid rgba(217, 154, 99, 0.45);
          outline-offset: 3px;
        }

        @keyframes ss-battle-glow {
          0%, 100% {
            box-shadow: 0 5px 14px rgba(185, 79, 61, 0.2), 0 0 0 rgba(217, 154, 99, 0);
          }
          50% {
            box-shadow: 0 7px 20px rgba(185, 79, 61, 0.3), 0 0 18px rgba(217, 154, 99, 0.38);
          }
        }

        .ss-header,
        .ss-timer-card,
        .ss-content-tabs,
        .ss-main {
          border-color: rgba(71, 64, 52, 0.14);
        }

        .ss-header,
        .ss-timer-card {
          background: #fbfaf6;
        }

        .ss-topic-tag,
        .ss-section-label,
        .ss-example-title {
          color: #9a642f;
        }

        .ss-topic-title,
        .ss-timer-display,
        .ss-concept-title,
        .ss-formula-name,
        .ss-resource-title {
          color: #2b2a25;
        }

        .ss-close-btn,
        .ss-time-input,
        .ss-chat-input,
        .ss-task-input {
          background: #fffdf8;
          border-color: rgba(71, 64, 52, 0.2);
          color: #2b2a25;
        }

        .ss-close-btn {
          color: #6b6a63;
        }

        .ss-close-btn:hover,
        .ss-btn-ghost:hover {
          background: #ebe5d9;
          color: #2b2a25;
        }

        .ss-timer-label,
        .ss-time-unit,
        .ss-time-sep,
        .ss-card-header,
        .ss-ex-label,
        .ss-empty {
          color: #77766f;
        }

        .ss-time-input:focus,
        .ss-chat-input:focus,
        .ss-task-input:focus {
          outline: none;
          border-color: rgba(154, 100, 47, 0.55);
        }

        .ss-btn-primary {
          background: #d99a63;
          color: #2b2118;
        }

        .ss-btn-primary:hover:not(:disabled) {
          background: #c9824c;
        }

        .ss-btn-ghost {
          background: #fffdf8;
          color: #5b5a54;
          border-color: rgba(71, 64, 52, 0.2);
        }

        .ss-content-tabs {
          background: #f4f0e8;
        }

        .ss-tab {
          color: #77766f;
        }

        .ss-tab:hover {
          color: #2b2a25;
          background: #ebe5d9;
        }

        .ss-tab.active {
          color: #2b2a25;
          border-bottom-color: #9a642f;
          background: rgba(154, 100, 47, 0.1);
        }

        .ss-content-panel {
          scrollbar-color: rgba(71, 64, 52, 0.25) transparent;
        }

        .ss-concept,
        .ss-example,
        .ss-formula,
        .ss-resource {
          background: #fffdf8;
          border-color: rgba(71, 64, 52, 0.14);
          box-shadow: 0 6px 18px rgba(71, 64, 52, 0.06);
        }

        .ss-overview,
        .ss-example-row p,
        .ss-concept-body,
        .ss-resource p {
          color: #555750;
        }

        .ss-keypoints li,
        .ss-formula-vars li {
          color: #686961;
        }

        .ss-ex-label-solution {
          color: #4c7652;
        }

        .ss-formula-expr {
          background: #ebe5d9;
          border-color: rgba(154, 100, 47, 0.2);
          color: #70451f;
          font-family: var(--font-geist-mono), monospace;
        }

        .ss-formula-vars strong {
          color: #3d3d37;
        }

        .ss-sidebar {
          background: #ebe5d9;
        }

        .ss-notes-card {
          flex: 1;
          min-height: 0;
        }

        .ss-chat-card,
        .ss-tasks-card,
        .ss-chat-input-row,
        .ss-card-header {
          border-color: rgba(71, 64, 52, 0.14);
        }

        .ss-msg-user .ss-msg-bubble {
          background: #e7d4c1;
          border-color: rgba(154, 100, 47, 0.22);
          color: #5d4028;
        }

        .ss-msg-ai .ss-msg-bubble,
        .ss-task-item {
          background: #f8f5ed;
          border-color: rgba(71, 64, 52, 0.14);
          color: #555750;
        }

        .ss-chat-input::placeholder,
        .ss-task-input::placeholder,
        .ss-notes-area::placeholder {
          color: #9b9a91;
        }

        .ss-task-item.done .ss-task-text {
          color: #99988f;
        }

        .ss-checkbox {
          accent-color: #9a642f;
        }

        .ss-task-text,
        .ss-notes-area {
          color: #555750;
        }
      `}</style>
    </div>
  );
}
