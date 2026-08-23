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

        {/* ===== KOKONUTUI APPLE ACTIVITY CARD PROGRESS DASHBOARD ===== */}
        {!loading && curriculum && totalTopics > 0 && (
          <div className="activity-card-container">
            <div className="activity-card-shell">
              {/* Header Title */}
              <div className="activity-card-header">
                <div className="activity-kicker">
                  <span className="activity-kicker-dot" />
                  <span>Real-Time Activity Matrix</span>
                </div>
                <h2 className="activity-title">Mastery &amp; Combat Progress</h2>
              </div>

              <div className="activity-card-body">
                {/* Concentric Apple Activity Rings */}
                <div className="activity-rings-col">
                  <div className="activity-rings-stage">
                    <svg viewBox="0 0 190 190" className="activity-rings-svg" aria-label={`Mastery: ${progressPct}%`}>
                      <defs>
                        {/* Gradient Outer (Green) */}
                        <linearGradient id="actGradMastery" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#4ade80" />
                        </linearGradient>
                        {/* Gradient Middle (Amber) */}
                        <linearGradient id="actGradDefeated" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#fbbf24" />
                        </linearGradient>
                        {/* Gradient Inner (Cyan) */}
                        <linearGradient id="actGradChapters" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>

                      {/* 1. Outer Ring Track (Radius 80, Circumference 502.65) */}
                      <circle
                        cx="95" cy="95" r="80"
                        fill="none"
                        stroke="rgba(34, 197, 94, 0.15)"
                        strokeWidth="12"
                      />
                      {/* Outer Ring Animated Fill */}
                      <circle
                        cx="95" cy="95" r="80"
                        fill="none"
                        stroke="url(#actGradMastery)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="502.65"
                        strokeDashoffset={`${502.65 * (1 - Math.min(progressPct, 100) / 100)}`}
                        style={{
                          transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                          transform: "rotate(-90deg)",
                          transformOrigin: "center",
                          filter: "drop-shadow(0 0 6px rgba(34, 197, 94, 0.45))",
                        }}
                      />

                      {/* 2. Middle Ring Track (Radius 62, Circumference 389.56) */}
                      <circle
                        cx="95" cy="95" r="62"
                        fill="none"
                        stroke="rgba(245, 158, 11, 0.15)"
                        strokeWidth="12"
                      />
                      {/* Middle Ring Animated Fill */}
                      <circle
                        cx="95" cy="95" r="62"
                        fill="none"
                        stroke="url(#actGradDefeated)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="389.56"
                        strokeDashoffset={`${389.56 * (1 - (totalTopics > 0 ? Math.min(masteredCount / totalTopics, 1) : 0))}`}
                        style={{
                          transition: "stroke-dashoffset 1.4s 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                          transform: "rotate(-90deg)",
                          transformOrigin: "center",
                          filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.45))",
                        }}
                      />

                      {/* 3. Inner Ring Track (Radius 44, Circumference 276.46) */}
                      <circle
                        cx="95" cy="95" r="44"
                        fill="none"
                        stroke="rgba(6, 182, 212, 0.15)"
                        strokeWidth="12"
                      />
                      {/* Inner Ring Animated Fill */}
                      <circle
                        cx="95" cy="95" r="44"
                        fill="none"
                        stroke="url(#actGradChapters)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="276.46"
                        strokeDashoffset={`${276.46 * (1 - (curriculum.chapters?.length ? (curriculum.chapters.filter(c => getChapterProgress(c).pct === 100).length / curriculum.chapters.length) : 0))}`}
                        style={{
                          transition: "stroke-dashoffset 1.6s 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                          transform: "rotate(-90deg)",
                          transformOrigin: "center",
                          filter: "drop-shadow(0 0 6px rgba(6, 182, 212, 0.45))",
                        }}
                      />
                    </svg>

                    {/* Center Ring Indicator */}
                    <div className="activity-center-badge">
                      <span className="activity-center-pct">{progressPct}%</span>
                      <span className="activity-center-lbl">Mastered</span>
                    </div>
                  </div>

                  {/* Ring Legend Pills */}
                  <div className="activity-legend">
                    <div className="legend-item">
                      <span className="legend-dot dot-green" />
                      <span className="legend-text">Mastery</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot dot-amber" />
                      <span className="legend-text">Defeated</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot dot-cyan" />
                      <span className="legend-text">Chapters</span>
                    </div>
                  </div>
                </div>

                {/* Stat Grid with Clean Vector Icons (No Emojis) */}
                <div className="activity-stats-grid">
                  {/* Card 1: Total Topics */}
                  <div className="activity-stat-box box-mastery">
                    <div className="stat-box-header">
                      <div className="stat-box-icon icon-emerald">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </div>
                      <span className="stat-box-tag">CURRICULUM</span>
                    </div>
                    <div className="stat-box-value">{totalTopics}</div>
                    <div className="stat-box-label">Total Topics</div>
                  </div>

                  {/* Card 2: Demons Defeated */}
                  <div className="activity-stat-box box-defeated">
                    <div className="stat-box-header">
                      <div className="stat-box-icon icon-amber">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                          <path d="M13 19l6-6" />
                          <path d="M16 16l4 4" />
                          <path d="M19 21l2-2" />
                          <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
                        </svg>
                      </div>
                      <span className="stat-box-tag tag-amber">BOSS BATTLES</span>
                    </div>
                    <div className="stat-box-value value-amber">{masteredCount}</div>
                    <div className="stat-box-label">Demons Defeated</div>
                  </div>

                  {/* Card 3: Remaining */}
                  <div className="activity-stat-box box-remaining">
                    <div className="stat-box-header">
                      <div className="stat-box-icon icon-cyan">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <span className="stat-box-tag tag-cyan">PENDING</span>
                    </div>
                    <div className="stat-box-value value-cyan">{totalTopics - masteredCount}</div>
                    <div className="stat-box-label">Remaining</div>
                  </div>

                  {/* Card 4: Chapters */}
                  <div className="activity-stat-box box-chapters">
                    <div className="stat-box-header">
                      <div className="stat-box-icon icon-purple">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                      <span className="stat-box-tag tag-purple">CHAPTERS</span>
                    </div>
                    <div className="stat-box-value value-purple">{curriculum?.chapters?.length || 0}</div>
                    <div className="stat-box-label">Chapters</div>
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
                          Chapter {chapter.chapterNumber || idx + 1}: {chapter.name}
                        </span>
                        <span className="chapter-progress-count">
                          {cp.mastered}/{cp.total} Mastered ({cp.pct}%)
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
          </div>
        )}

        {/* Empty State */}
        {!loading && subjects.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ margin: "0 auto" }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>No Syllabus Uploaded Yet</h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto 28px" }}>
              Upload your textbook table-of-contents or course syllabus image/PDF to construct your learning roadmap.
            </p>
            <Link href="/syllabus" className="button button-primary button-large">
              Upload Syllabus
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
                        <span className="chapter-badge-complete">Complete</span>
                      )}
                      {chapterTopics.length > 0 && (
                        <button
                          type="button"
                          className="button button-small button-ghost"
                          style={{ border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: 12, padding: "5px 12px", minHeight: 32 }}
                          onClick={() => openTopicStudy(chapterTopics[0])}
                        >
                          Study Chapter
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
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                </svg>
                                <span>Study</span>
                              </button>
                              
                              <Link
                                href={`/battle?topicId=${topic.id}`}
                                className="hover-action-btn hover-action-battle"
                                title="Battle Topic Boss"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                                  <path d="M13 19l6-6" />
                                  <path d="M16 16l4 4" />
                                  <path d="M19 21l2-2" />
                                  <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
                                </svg>
                                <span>Battle</span>
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
        /* ===== KOKONUTUI APPLE ACTIVITY CARD PROGRESS DASHBOARD ===== */
        .activity-card-container {
          margin-bottom: 40px;
        }

        .activity-card-shell {
          background: rgba(10, 16, 11, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: var(--radius-xl, 20px);
          padding: 28px 32px;
          backdrop-filter: blur(18px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 40px rgba(34, 197, 94, 0.05);
        }

        .activity-card-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 24px;
        }

        .activity-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .activity-kicker-dot {
          width: 6px;
          height: 6px;
          background: #4ade80;
          border-radius: 50%;
          box-shadow: 0 0 8px #4ade80;
        }

        .activity-title {
          font-size: clamp(20px, 2.4vw, 24px);
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.025em;
        }

        .activity-card-body {
          display: flex;
          align-items: center;
          gap: 36px;
          margin-bottom: 24px;
        }

        /* Concentric Activity Rings */
        .activity-rings-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .activity-rings-stage {
          position: relative;
          width: 170px;
          height: 170px;
        }

        .activity-rings-svg {
          width: 100%;
          height: 100%;
        }

        .activity-center-badge {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .activity-center-pct {
          font-family: var(--font-geist-mono), monospace;
          font-size: 26px;
          font-weight: 900;
          color: #4ade80;
          line-height: 1;
          text-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
        }

        .activity-center-lbl {
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-top: 2px;
        }

        /* Legend */
        .activity-legend {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .dot-green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .dot-amber { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
        .dot-cyan { background: #06b6d4; box-shadow: 0 0 6px #06b6d4; }

        .legend-text {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.65);
        }

        /* Stats Grid */
        .activity-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          flex: 1;
        }

        .activity-stat-box {
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px 18px;
          backdrop-filter: blur(10px);
          transition: all 200ms ease;
        }

        .activity-stat-box:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateY(-2px);
        }

        .stat-box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .stat-box-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
        }

        .icon-emerald { background: rgba(34, 197, 94, 0.16); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .icon-amber { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .icon-cyan { background: rgba(6, 182, 212, 0.16); color: #38bdf8; border: 1px solid rgba(6, 182, 212, 0.3); }
        .icon-purple { background: rgba(168, 85, 247, 0.16); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }

        .stat-box-tag {
          font-family: var(--font-geist-mono), monospace;
          font-size: 9px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.1em;
        }

        .tag-amber { color: rgba(251, 191, 36, 0.7); }
        .tag-cyan { color: rgba(56, 189, 248, 0.7); }
        .tag-purple { color: rgba(192, 132, 252, 0.7); }

        .stat-box-value {
          font-family: var(--font-geist-mono), monospace;
          font-size: 26px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.1;
        }

        .value-amber { color: #fde68a; }
        .value-cyan { color: #bae6fd; }
        .value-purple { color: #e9d5ff; }

        .stat-box-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.65);
          font-weight: 600;
          margin-top: 4px;
        }

        /* Chapter Progress Bars */
        .chapter-progress-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
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
          background: rgba(255, 255, 255, 0.06);
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
          background: rgba(34, 197, 94, 0.12);
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        /* ============================================================
           CYBERNETIC GREEN GAMING BUTTON (MATCHING USER REFERENCE IMAGE)
        ============================================================ */
        .cyber-btn-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          outline: none;
          cursor: pointer;
          filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5));
          transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cyber-btn-link:hover {
          transform: translateY(-2px) scale(1.03);
          filter: drop-shadow(0 0 20px rgba(74, 222, 128, 0.85)) drop-shadow(0 0 35px rgba(34, 197, 94, 0.4));
        }

        .cyber-btn-link:active {
          transform: translateY(0) scale(0.98);
        }

        .cyber-btn-compact .cyber-btn-inner {
          min-width: 90px;
          min-height: 34px;
          padding: 4px 16px;
        }

        .cyber-btn-compact .cyber-btn-title {
          font-size: 13px;
        }

        .cyber-btn-inner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 170px;
          min-height: 48px;
          padding: 8px 28px;
          background: radial-gradient(circle at center, #0e3a18 0%, #06220d 75%, #031407 100%);
          /* 45-degree chamfered cut corners */
          clip-path: polygon(
            12px 0,
            calc(100% - 12px) 0,
            100% 12px,
            100% calc(100% - 12px),
            calc(100% - 12px) 100%,
            12px 100%,
            0 calc(100% - 12px),
            0 12px
          );
          border: 2px solid #22c55e;
          box-shadow: inset 0 0 14px rgba(74, 222, 128, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.4);
        }

        /* Matrix Scanlines */
        .cyber-btn-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.28) 0px,
            rgba(0, 0, 0, 0.28) 1px,
            transparent 1px,
            transparent 3px
          );
          pointer-events: none;
        }

        /* Top & Bottom green rail accents */
        .cyber-btn-rail {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 55%;
          height: 3px;
          background: #86efac;
          box-shadow: 0 0 8px #4ade80, 0 0 16px #22c55e;
          border-radius: 2px;
          z-index: 2;
        }

        .cyber-rail-top { top: 0; }
        .cyber-rail-bottom { bottom: 0; }

        /* Left & Right notch wings */
        .cyber-btn-wing {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 38%;
          background: #86efac;
          box-shadow: 0 0 8px #4ade80;
          border-radius: 1px;
          z-index: 2;
        }

        .cyber-btn-content {
          position: relative;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .cyber-btn-compact .cyber-btn-inner {
          min-width: 160px;
          min-height: 38px;
          padding: 6px 18px;
        }

        .cyber-btn-compact .cyber-btn-title {
          font-size: 12px;
          letter-spacing: 0.12em;
        }

        .cyber-btn-title {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #ffffff;
          text-shadow: 0 0 12px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.9);
          line-height: 1;
          white-space: nowrap;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 900px) {
          .activity-card-body {
            flex-direction: column;
            gap: 24px;
          }

          .activity-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .activity-stats-grid {
            grid-template-columns: 1fr;
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
        {/* Background Image Backdrop */}
        <div className="ss-backdrop" aria-hidden="true" />

        {/* ---- HEADER ---- */}
        <div className="ss-header">
          <div className="ss-header-left">
            <span className="ss-topic-tag">
              <span className="ss-tag-line" aria-hidden="true" />
              Topic #{topic?.orderIndex || 1} • Study Arena
            </span>
            <h1 className="ss-topic-title">{topic?.name}</h1>
          </div>
          <div className="ss-header-right">
            {/* Cybernetic Green Gaming Play Button (from image) */}
            <Link
              href={`/battle?topicId=${topic?.id}`}
              className="cyber-btn-link cyber-btn-study"
              title="Fight Demon Boss"
            >
              <span className="cyber-btn-inner">
                <span className="cyber-btn-rail cyber-rail-top" aria-hidden="true" />
                <span className="cyber-btn-rail cyber-rail-bottom" aria-hidden="true" />
                <span className="cyber-btn-wing cyber-wing-left" aria-hidden="true" />
                <span className="cyber-btn-wing cyber-wing-right" aria-hidden="true" />
                <span className="cyber-btn-scanlines" aria-hidden="true" />
                <span className="cyber-btn-content">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                    <path d="M13 19l6-6" />
                    <path d="M16 16l4 4" />
                    <path d="M19 21l2-2" />
                    <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
                  </svg>
                  <span className="cyber-btn-title">FIGHT DEMON BOSS</span>
                </span>
              </span>
            </Link>

            <button className="ss-close-btn" onClick={onClose} aria-label="Close Study Space">
              ✕
            </button>
          </div>
        </div>

        {/* ---- MAIN LAYOUT ---- */}
        <div className="ss-body">

          {/* LEFT: Timer + Content Tabs */}
          <div className="ss-main">

            {/* Timer HUD */}
            <div className="ss-timer-card">
              <div className="ss-timer-left">
                <div className="ss-timer-label">Focus Timer</div>
                <div className="ss-timer-display">{timerDisplay}</div>
              </div>
              
              <div className="ss-timer-right">
                <div className="ss-timer-inputs">
                  <div className="ss-time-field">
                    <input
                      type="number" min={0} max={99}
                      value={timerMin}
                      onChange={(e) => { setTimerMin(Number(e.target.value)); setTimerRunning(false); }}
                      className="ss-time-input"
                    />
                    <span className="ss-time-unit">m</span>
                  </div>
                  <div className="ss-time-sep">:</div>
                  <div className="ss-time-field">
                    <input
                      type="number" min={0} max={59}
                      value={timerSec}
                      onChange={(e) => { setTimerSec(Number(e.target.value)); setTimerRunning(false); }}
                      className="ss-time-input"
                    />
                    <span className="ss-time-unit">s</span>
                  </div>
                </div>
                <div className="ss-timer-btns">
                  <button className="ss-btn ss-btn-primary" onClick={startPauseTimer} type="button">
                    {timerRunning ? "Pause" : "▶ Start"}
                  </button>
                  <button className="ss-btn ss-btn-ghost" onClick={resetTimer} type="button">Reset</button>
                </div>
              </div>
            </div>

            {/* Content Tabs Switcher */}
            <div className="ss-content-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`ss-tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {studyLoading && (
              <div className="ss-loading">
                <div className="ss-spinner" />
                <p>Synthesizing study pack with Gemini AI...</p>
              </div>
            )}

            {/* Error */}
            {studyError && !studyLoading && (
              <div className="ss-error">
                <p>⚠️ {studyError}</p>
                <button className="ss-btn ss-btn-ghost" onClick={onRetry} type="button">Retry</button>
              </div>
            )}

            {/* Content Panel */}
            {studyPack && !studyLoading && (
              <div className="ss-content-panel">

                {/* Theory Tab */}
                {activeTab === "theory" && studyPack.theory && (
                  <div className="ss-tab-content">
                    <div className="ss-overview-card">
                      <div className="ss-card-kicker">Core Overview</div>
                      <RichText className="ss-overview">{studyPack.theory.overview}</RichText>
                    </div>
                    
                    {studyPack.theory.concepts?.map((c, i) => (
                      <div className="ss-concept" key={i}>
                        <h3 className="ss-concept-title">
                          <span className="ss-concept-bullet" />
                          <RichText inline>{c.title}</RichText>
                        </h3>
                        <RichText className="ss-concept-body">{c.explanation}</RichText>
                      </div>
                    ))}
                    
                    {studyPack.theory.keyPoints?.length > 0 && (
                      <div className="ss-keypoints">
                        <div className="ss-section-label">
                          <span>✦</span> Key Takeaways &amp; Rules
                        </div>
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
                        <div className="ss-example-title">
                          <span>Example #{i + 1}</span> • <RichText inline>{ex.title || `Problem Breakdown`}</RichText>
                        </div>
                        <div className="ss-example-row">
                          <span className="ss-ex-label">Question</span>
                          <div className="ss-ex-box ss-ex-question">
                            <RichText>{ex.question}</RichText>
                          </div>
                        </div>
                        <div className="ss-example-row">
                          <span className="ss-ex-label ss-ex-label-solution">Step-by-Step Solution</span>
                          <div className="ss-ex-box ss-ex-solution">
                            <RichText>{ex.solution}</RichText>
                          </div>
                        </div>
                        {ex.explanation && (
                          <div className="ss-ex-note">
                            <strong>Note:</strong> <RichText inline>{ex.explanation}</RichText>
                          </div>
                        )}
                      </div>
                    ))}
                    {(!studyPack.examples || studyPack.examples.length === 0) && (
                      <p className="ss-empty">No examples available for this topic yet.</p>
                    )}
                  </div>
                )}

                {/* Formulas Tab */}
                {activeTab === "formulas" && (
                  <div className="ss-tab-content">
                    {(studyPack.formulas || []).map((f, i) => (
                      <div className="ss-formula" key={i}>
                        <h3 className="ss-formula-name">
                          <RichText inline>{f.name}</RichText>
                        </h3>
                        <div className="ss-formula-expr">
                          <RichText>{f.formula}</RichText>
                        </div>
                        {f.meaning && (
                          <div className="ss-formula-meaning">
                            <RichText>{f.meaning}</RichText>
                          </div>
                        )}
                        {f.variables?.length > 0 && (
                          <div className="ss-vars-block">
                            <div className="ss-vars-title">Variable Definitions</div>
                            <ul className="ss-formula-vars">
                              {f.variables.map((v, vi) => (
                                <li key={vi}>
                                  <strong><RichText inline>{v.symbol}</RichText></strong> : <RichText inline>{v.meaning}</RichText>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                    {(!studyPack.formulas || studyPack.formulas.length === 0) && (
                      <p className="ss-empty">No formulas for this topic.</p>
                    )}
                  </div>
                )}

                {/* Resources Tab with Clickable Links */}
                {activeTab === "resources" && (
                  <div className="ss-tab-content">
                    <div className="ss-resources-intro">
                      <div className="ss-card-kicker">Recommended Learning Media</div>
                      <p className="ss-resources-desc">
                        Curated video lessons, interactive channels, and reference material for <strong>{topic?.name}</strong>.
                      </p>
                    </div>

                    <div className="ss-resources-grid">
                      {(studyPack.aiResources || []).map((r, i) => {
                        const queryText = r.searchQuery || `${topic?.name || ""} ${r.title || ""}`;
                        const youtubeLink =
                          r.youtubeUrl ||
                          `https://www.youtube.com/results?search_query=${encodeURIComponent(queryText)}`;
                        const googleLink = `https://www.google.com/search?q=${encodeURIComponent(queryText)}`;
                        const primaryLink = r.url || r.link || youtubeLink;
                        const isYoutube = primaryLink.includes("youtube.com") || primaryLink.includes("youtu.be");

                        return (
                          <div className="ss-resource-card" key={i}>
                            <div className="ss-resource-card-header">
                              <span className={`ss-resource-badge ${isYoutube ? "badge-youtube" : "badge-web"}`}>
                                {isYoutube ? "YouTube Resource" : "Web Reference"}
                              </span>
                              <a
                                href={primaryLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ss-resource-launch-link"
                                title="Open resource in new tab"
                              >
                                <span>Open</span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            </div>

                            <h3 className="ss-resource-title">
                              <a href={primaryLink} target="_blank" rel="noopener noreferrer">
                                <RichText inline>{r.title}</RichText>
                              </a>
                            </h3>

                            <div className="ss-resource-desc">
                              <RichText>{r.description}</RichText>
                            </div>

                            <div className="ss-resource-actions">
                              <a
                                href={youtubeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ss-resource-btn ss-resource-btn-yt"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                <span>Watch Video</span>
                              </a>

                              <a
                                href={googleLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ss-resource-btn ss-resource-btn-google"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <span>Search Online</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(!studyPack.aiResources || studyPack.aiResources.length === 0) && (
                      <p className="ss-empty">No extra resources available.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="ss-sidebar">

            {/* Tasks */}
            <div className="ss-tasks-card">
              <div className="ss-card-header">
                <span>Study Checkpoints</span>
                <span className="ss-task-count">
                  {tasks.filter((t) => t.done).length}/{tasks.length}
                </span>
              </div>
              <div className="ss-task-input-row">
                <input
                  className="ss-task-input"
                  placeholder="Add a study goal..."
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") addTask(); }}
                />
                <button className="ss-btn ss-btn-primary ss-add-task-btn" onClick={addTask} type="button">
                  + Add
                </button>
              </div>
              {tasks.length > 0 ? (
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
              ) : (
                <div className="ss-tasks-empty">
                  No active checkpoints. Add concepts to master!
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="ss-notes-card">
              <div className="ss-card-header">
                <span>Scratchpad &amp; Notes</span>
              </div>
              <textarea
                className="ss-notes-area"
                placeholder="Write observations, derivations, or questions here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ============================================================
           STUDY SPACE THEME — Unified with GameEdu Dark Obsidian & Warm Ivory
        ============================================================ */
        .ss-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(3, 6, 3, 0.85);
          backdrop-filter: blur(18px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(10px, 2vw, 24px);
          font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
          animation: ss-fade-in 0.25s ease both;
        }

        @keyframes ss-fade-in {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }

        .ss-shell {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          max-width: 1440px;
          background: #080a08;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: var(--radius-xl, 20px);
          overflow: hidden;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(237, 226, 205, 0.05);
          color: #ffffff;
        }

        /* Backdrop Image Overlay */
        .ss-backdrop {
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image:
            linear-gradient(
              180deg,
              rgba(6, 10, 6, 0.91) 0%,
              rgba(8, 14, 8, 0.84) 40%,
              rgba(4, 7, 4, 0.94) 100%
            ),
            linear-gradient(
              90deg,
              rgba(4, 8, 4, 0.8) 0%,
              transparent 50%,
              rgba(4, 8, 4, 0.8) 100%
            ),
            url("/homebackground.png");
          background-size: cover;
          background-position: center;
          pointer-events: none;
        }

        /* ---- HEADER ---- */
        .ss-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: rgba(12, 18, 13, 0.72);
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          backdrop-filter: blur(24px);
          flex-shrink: 0;
          gap: 16px;
        }

        .ss-header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ss-topic-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .ss-tag-line {
          width: 18px;
          height: 2px;
          background: var(--accent, #ede2cd);
          border-radius: 1px;
        }

        .ss-topic-title {
          font-size: clamp(18px, 2vw, 22px);
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .ss-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        /* ============================================================
           CYBERNETIC GREEN GAMING BUTTON (MATCHING USER REFERENCE IMAGE)
        ============================================================ */
        .cyber-btn-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          outline: none;
          cursor: pointer;
          filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5));
          transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cyber-btn-link:hover {
          transform: translateY(-2px) scale(1.03);
          filter: drop-shadow(0 0 20px rgba(74, 222, 128, 0.85)) drop-shadow(0 0 35px rgba(34, 197, 94, 0.4));
        }

        .cyber-btn-link:active {
          transform: translateY(0) scale(0.98);
        }

        .cyber-btn-study .cyber-btn-inner {
          min-width: 140px;
          min-height: 42px;
          padding: 6px 24px;
        }

        .cyber-btn-inner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 170px;
          min-height: 48px;
          padding: 8px 28px;
          background: radial-gradient(circle at center, #0e3a18 0%, #06220d 75%, #031407 100%);
          /* 45-degree chamfered cut corners */
          clip-path: polygon(
            12px 0,
            calc(100% - 12px) 0,
            100% 12px,
            100% calc(100% - 12px),
            calc(100% - 12px) 100%,
            12px 100%,
            0 calc(100% - 12px),
            0 12px
          );
          border: 2px solid #22c55e;
          box-shadow: inset 0 0 14px rgba(74, 222, 128, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.4);
        }

        /* Matrix Scanlines */
        .cyber-btn-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.28) 0px,
            rgba(0, 0, 0, 0.28) 1px,
            transparent 1px,
            transparent 3px
          );
          pointer-events: none;
        }

        /* Top & Bottom green rail accents */
        .cyber-btn-rail {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 55%;
          height: 3px;
          background: #86efac;
          box-shadow: 0 0 8px #4ade80, 0 0 16px #22c55e;
          border-radius: 2px;
          z-index: 2;
        }

        .cyber-rail-top { top: 0; }
        .cyber-rail-bottom { bottom: 0; }

        /* Left & Right notch wings */
        .cyber-btn-wing {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 38%;
          background: #86efac;
          box-shadow: 0 0 8px #4ade80;
          border-radius: 1px;
          z-index: 2;
        }

        .cyber-wing-left { left: 0; }
        .cyber-wing-right { right: 0; }

        .cyber-btn-content {
          position: relative;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .cyber-btn-title {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.14em;
          color: #ffffff;
          text-shadow: 0 0 12px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.9);
          line-height: 1;
          white-space: nowrap;
        }

        .ss-close-btn {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 9px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
          font-size: 15px;
          cursor: pointer;
          transition: all 180ms ease;
        }

        .ss-close-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.28);
          transform: translateY(-1px);
        }

        /* ---- BODY ---- */
        .ss-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ---- MAIN ---- */
        .ss-main {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          min-height: 0;
        }

        /* Timer HUD */
        .ss-timer-card {
          padding: 12px 28px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(31, 76, 54, 0.22);
          backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .ss-timer-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ss-timer-label {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          white-space: nowrap;
        }

        .ss-timer-display {
          font-family: var(--font-geist-mono), monospace;
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.05em;
          text-shadow: 0 0 16px rgba(74, 222, 128, 0.25);
        }

        .ss-timer-right {
          display: flex;
          align-items: center;
          gap: 12px;
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
          width: 48px;
          text-align: center;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #ffffff;
          padding: 5px 6px;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
          outline: none;
          transition: border-color 180ms ease;
        }

        .ss-time-input:focus {
          border-color: var(--accent, #ede2cd);
          box-shadow: 0 0 0 2px rgba(237, 226, 205, 0.25);
        }

        .ss-time-input::-webkit-inner-spin-button,
        .ss-time-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        .ss-time-unit {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
        }

        .ss-time-sep {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 700;
        }

        .ss-timer-btns {
          display: flex;
          gap: 8px;
        }

        /* Content Tabs */
        .ss-content-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 28px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(10px);
          flex-shrink: 0;
          overflow-x: auto;
        }

        .ss-tab {
          padding: 8px 18px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255, 255, 255, 0.65);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 180ms ease;
          white-space: nowrap;
        }

        .ss-tab:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }

        .ss-tab.active {
          color: var(--accent, #ede2cd);
          border-color: rgba(237, 226, 205, 0.28);
          background: rgba(31, 76, 54, 0.45);
          box-shadow: inset 0 1px rgba(255, 255, 255, 0.14), 0 4px 12px rgba(0, 0, 0, 0.2);
          font-weight: 700;
        }

        .ss-content-panel {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px 40px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }

        .ss-content-panel::-webkit-scrollbar { width: 4px; }
        .ss-content-panel::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 2px; }

        /* Loading / Error */
        .ss-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 60px 28px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .ss-spinner {
          width: 34px;
          height: 34px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent, #ede2cd);
          border-radius: 50%;
          animation: ss-spin 0.7s linear infinite;
        }

        @keyframes ss-spin { to { transform: rotate(360deg); } }

        .ss-error {
          padding: 24px 28px;
          color: #f87171;
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(248, 113, 113, 0.08);
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: 10px;
          margin: 20px 28px;
        }

        /* Tab Content Cards */
        .ss-tab-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 920px;
        }

        .ss-overview-card {
          background: rgba(14, 20, 15, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px 24px;
          backdrop-filter: blur(14px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }

        .ss-card-kicker {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 10px;
        }

        .ss-overview {
          font-size: 15px;
          line-height: 1.75;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
        }

        .ss-concept {
          background: rgba(14, 20, 15, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          padding: 18px 22px;
          backdrop-filter: blur(14px);
          transition: border-color 180ms ease, transform 180ms ease;
        }

        .ss-concept:hover {
          border-color: rgba(237, 226, 205, 0.28);
          transform: translateY(-1px);
        }

        .ss-concept-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ss-concept-bullet {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: var(--accent, #ede2cd);
          border-radius: 50%;
        }

        .ss-concept-body {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.65;
          margin: 0;
        }

        .ss-keypoints {
          background: rgba(31, 76, 54, 0.28);
          border: 1px solid rgba(74, 222, 128, 0.28);
          border-radius: 12px;
          padding: 20px 24px;
          backdrop-filter: blur(14px);
          margin-top: 4px;
        }

        .ss-section-label {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 800;
          color: #4ade80;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ss-keypoints ul {
          padding-left: 20px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ss-keypoints li {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.6;
        }

        .ss-example {
          background: rgba(14, 20, 15, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          padding: 20px 24px;
          backdrop-filter: blur(14px);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ss-example-title {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          font-weight: 800;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .ss-example-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ss-ex-label {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .ss-ex-label-solution {
          color: #4ade80;
        }

        .ss-ex-box {
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.65;
        }

        .ss-ex-question {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.9);
        }

        .ss-ex-solution {
          background: rgba(31, 76, 54, 0.25);
          border: 1px solid rgba(74, 222, 128, 0.25);
          color: #ffffff;
        }

        .ss-ex-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.65);
          margin: 0;
          padding-top: 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ss-formula {
          background: rgba(14, 20, 15, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          padding: 20px 24px;
          backdrop-filter: blur(14px);
        }

        .ss-formula-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          margin: 0 0 12px;
        }

        .ss-formula-expr {
          display: block;
          background: rgba(31, 76, 54, 0.32);
          border: 1px solid rgba(237, 226, 205, 0.25);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 15px;
          color: var(--accent, #ede2cd);
          margin-bottom: 12px;
          word-break: break-all;
        }

        .ss-formula-meaning {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.78);
          margin: 0 0 12px;
          line-height: 1.6;
        }

        .ss-vars-block {
          background: rgba(0, 0, 0, 0.28);
          border-radius: 8px;
          padding: 12px 16px;
        }

        .ss-vars-title {
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
        }

        .ss-formula-vars {
          padding-left: 16px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ss-formula-vars li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .ss-formula-vars strong {
          color: var(--accent, #ede2cd);
        }

        /* ===== RESOURCES SECTION WITH CLICKABLE CARDS ===== */
        .ss-resources-intro {
          background: rgba(14, 20, 15, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 18px 22px;
          backdrop-filter: blur(14px);
        }

        .ss-resources-desc {
          margin: 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.6;
        }

        .ss-resources-desc strong {
          color: var(--accent, #ede2cd);
        }

        .ss-resources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 16px;
        }

        .ss-resource-card {
          display: flex;
          flex-direction: column;
          background: rgba(14, 20, 15, 0.52);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 20px 22px;
          backdrop-filter: blur(14px);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
          transition: all 200ms ease;
        }

        .ss-resource-card:hover {
          border-color: rgba(237, 226, 205, 0.35);
          background: rgba(18, 26, 19, 0.65);
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
        }

        .ss-resource-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .ss-resource-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 3px 8px;
          border-radius: 5px;
        }

        .badge-youtube {
          background: rgba(239, 68, 68, 0.18);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        .badge-web {
          background: rgba(31, 76, 54, 0.35);
          color: #86efac;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }

        .ss-resource-launch-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 650;
          color: var(--accent, #ede2cd);
          text-decoration: none;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(237, 226, 205, 0.08);
          border: 1px solid rgba(237, 226, 205, 0.2);
          transition: all 180ms ease;
        }

        .ss-resource-launch-link:hover {
          background: rgba(237, 226, 205, 0.18);
          border-color: var(--accent, #ede2cd);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .ss-resource-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 8px;
          line-height: 1.35;
        }

        .ss-resource-title a {
          color: #ffffff;
          text-decoration: none;
          transition: color 180ms ease;
        }

        .ss-resource-title a:hover {
          color: var(--accent, #ede2cd);
          text-decoration: underline;
        }

        .ss-resource-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.6;
          margin-bottom: 16px;
          flex: 1;
        }

        .ss-resource-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .ss-resource-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          transition: all 180ms ease;
        }

        .ss-resource-btn-yt {
          background: rgba(220, 38, 38, 0.16);
          color: #fca5a5;
          border: 1px solid rgba(220, 38, 38, 0.35);
        }

        .ss-resource-btn-yt:hover {
          background: rgba(220, 38, 38, 0.28);
          color: #ffffff;
          border-color: #ef4444;
          transform: translateY(-1px);
        }

        .ss-resource-btn-google {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ss-resource-btn-google:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .ss-empty {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.45);
          padding: 36px 0;
          text-align: center;
        }

        /* ---- SIDEBAR ---- */
        .ss-sidebar {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(6, 10, 6, 0.75);
          backdrop-filter: blur(18px);
        }

        .ss-card-header {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          padding: 14px 18px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ss-task-count {
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
        }

        /* Tasks */
        .ss-tasks-card {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 10px;
          flex-shrink: 0;
        }

        .ss-task-input-row {
          display: flex;
          gap: 8px;
          padding: 10px 14px;
        }

        .ss-task-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 13px;
          min-width: 0;
          outline: none;
          transition: border-color 180ms ease;
        }

        .ss-task-input::placeholder { color: rgba(255, 255, 255, 0.35); }
        .ss-task-input:focus { border-color: var(--accent, #ede2cd); }

        .ss-add-task-btn {
          padding: 8px 12px;
          font-size: 12px;
        }

        .ss-tasks-empty {
          padding: 8px 16px 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        .ss-task-list {
          list-style: none;
          padding: 0 14px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 160px;
          overflow-y: auto;
        }

        .ss-task-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.035);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: all 180ms ease;
        }

        .ss-task-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .ss-task-item.done {
          opacity: 0.5;
        }

        .ss-task-item.done .ss-task-text {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.4);
        }

        .ss-checkbox {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          accent-color: #22c55e;
          cursor: pointer;
        }

        .ss-task-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          flex: 1;
          line-height: 1.4;
          word-break: break-word;
        }

        /* Notes */
        .ss-notes-card {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 140px;
        }

        .ss-notes-area {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.85);
          padding: 12px 16px;
          font-size: 13px;
          line-height: 1.65;
          resize: none;
          outline: none;
          font-family: inherit;
        }

        .ss-notes-area::placeholder { color: rgba(255, 255, 255, 0.28); }

        /* Shared Buttons */
        .ss-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 180ms ease;
          white-space: nowrap;
        }

        .ss-btn:hover {
          transform: translateY(-1px);
        }

        .ss-btn-primary {
          background: var(--accent, #ede2cd);
          color: #091006;
          border-color: var(--accent, #ede2cd);
          box-shadow: 0 4px 14px rgba(237, 226, 205, 0.2);
        }

        .ss-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover, #f7f0e2);
        }

        .ss-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ss-btn-ghost {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ss-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        /* ---- RESPONSIVE ---- */
        @media (max-width: 900px) {
          .ss-body {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }

          .ss-main {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .ss-sidebar {
            max-height: 280px;
            flex-direction: row;
            overflow-x: auto;
            flex-shrink: 0;
          }

          .ss-tasks-card, .ss-notes-card {
            min-width: 260px;
            border-bottom: none;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
          }

          .ss-resources-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .ss-overlay {
            padding: 0;
          }

          .ss-shell {
            border-radius: 0;
            border: none;
          }

          .ss-header {
            padding: 12px 16px;
            flex-wrap: wrap;
          }

          .ss-topic-title {
            font-size: 17px;
          }

          .ss-timer-card {
            padding: 10px 16px;
            gap: 10px;
          }

          .ss-timer-display {
            font-size: 20px;
          }

          .ss-content-tabs {
            padding: 8px 16px;
          }

          .ss-content-panel {
            padding: 16px;
          }

          .ss-card-header {
            padding: 10px 14px 8px;
          }
        }
      `}</style>
    </div>
  );
}
