"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";

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

  // Mastered topics stored locally
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

  function handleMarkMastered(topicId) {
    const updated = new Set(masteredTopics);
    updated.add(topicId);
    setMasteredTopics(updated);
    try {
      localStorage.setItem(
        "gameedu_mastered_topics",
        JSON.stringify(Array.from(updated))
      );
    } catch {
      // ignore
    }
  }

  // Flatten all topics across chapters for sequential unlocked check
  const allTopics =
    curriculum?.chapters?.flatMap((ch) => ch.topics || []) || [];

  function getTopicStatus(topic) {
    if (masteredTopics.has(topic.id)) return "MASTERED";

    const firstUnfinished = allTopics.find((t) => !masteredTopics.has(t.id));
    if (firstUnfinished && firstUnfinished.id === topic.id) {
      return "ACTIVE";
    }

    if (!firstUnfinished && allTopics.length > 0 && allTopics[0].id === topic.id) {
      return "ACTIVE";
    }

    const topicIdx = allTopics.findIndex((t) => t.id === topic.id);
    const activeIdx = allTopics.findIndex(
      (t) => t.id === (firstUnfinished?.id || allTopics[0]?.id)
    );

    if (topicIdx <= activeIdx) return "UNLOCKED";
    return "LOCKED";
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
                    <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>
                      {chapterTopics.length} Topics
                    </span>
                  </div>

                  {/* Vertical Circular Nodes Flow */}
                  <div className="roadmap-nodes-flow">
                    {chapterTopics.map((topic, topicIdx) => {
                      const status = getTopicStatus(topic);
                      const isLocked = status === "LOCKED";
                      const isMastered = status === "MASTERED";
                      const isActive = status === "ACTIVE";
                      const isAltLeft = topicIdx % 2 === 1;
                      const isSelected = activeHoverTopicId === topic.id;

                      const formattedNum = String(
                        topic.orderIndex || topicIdx + 1
                      ).padStart(2, "0");

                      return (
                        <div
                          key={topic.id}
                          className={`roadmap-node-item ${isAltLeft ? "alt-left" : ""} ${isSelected ? "is-selected" : ""}`}
                          onMouseEnter={() => !isLocked && setActiveHoverTopicId(topic.id)}
                          onMouseLeave={() => setActiveHoverTopicId(null)}
                        >
                          {/* Circular Roadmap Node */}
                          <button
                            type="button"
                            className={`roadmap-circle-node ${isMastered ? "mastered" : isActive ? "active" : isLocked ? "locked" : ""}`}
                            disabled={isLocked}
                            onClick={() => {
                              if (!isLocked) {
                                if (activeHoverTopicId === topic.id) {
                                  openTopicStudy(topic);
                                } else {
                                  setActiveHoverTopicId(topic.id);
                                }
                              }
                            }}
                            title={`${topic.name} (${status})`}
                            aria-label={`${topic.name} - ${status}`}
                          >
                            {isMastered ? (
                              <span className="node-icon">✓</span>
                            ) : isLocked ? (
                              <span className="node-icon">🔒</span>
                            ) : (
                              <span className="node-num">{formattedNum}</span>
                            )}
                          </button>

                          <span className="roadmap-node-label-small">
                            {topic.name}
                          </span>

                          {/* Square Bar Popover on Hover / Click */}
                          {!isLocked && (
                            <div className="roadmap-hover-square">
                              <div className="hover-square-header">
                                <span className="square-tag">
                                  Topic #{topic.orderIndex || topicIdx + 1} • {status}
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Study Pack Theory Modal */}
        {selectedTopic && (
          <div className="duo-modal-overlay" onClick={() => setSelectedTopic(null)}>
            <div className="duo-modal-content" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="duo-modal-close"
                onClick={() => setSelectedTopic(null)}
                aria-label="Close"
              >
                ✕
              </button>

              <div style={{ marginBottom: 24 }}>
                <span className="subject-tag">
                  Topic #{selectedTopic.orderIndex || 1}
                </span>
                <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700 }}>
                  {selectedTopic.name}
                </h1>
              </div>

              {/* Study Pack Loading */}
              {studyLoading && (
                <div className="loading-container" style={{ padding: "40px 0" }}>
                  <div className="loading-spinner" />
                  <div className="loading-text">
                    Loading Theory, Examples, Formulas &amp; Resources...
                  </div>
                </div>
              )}

              {/* Study Pack Error */}
              {studyError && (
                <div className="alert alert-error">
                  ⚠️ {studyError}
                  <button
                    type="button"
                    className="button button-small button-ghost"
                    onClick={() => openTopicStudy(selectedTopic)}
                    style={{ marginLeft: 12 }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Study Pack Content */}
              {studyPack && !studyLoading && (
                <div className="study-pack">
                  {/* 1. THEORY */}
                  {studyPack.theory && (
                    <section className="study-section">
                      <div className="study-section-header">
                        <div className="study-section-icon">📘</div>
                        <h2>Theory &amp; Concepts</h2>
                      </div>

                      <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
                        {studyPack.theory.overview}
                      </p>

                      {studyPack.theory.concepts?.map((concept, idx) => (
                        <div className="study-concept" key={idx}>
                          <h3>{concept.title}</h3>
                          <p>{concept.explanation}</p>
                        </div>
                      ))}

                      {studyPack.theory.keyPoints?.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <h4 style={{ fontSize: 13, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
                            Key Takeaways
                          </h4>
                          <ul className="study-key-points">
                            {studyPack.theory.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  )}

                  {/* 2. EXAMPLES */}
                  {studyPack.examples?.length > 0 && (
                    <section className="study-section">
                      <div className="study-section-header">
                        <div className="study-section-icon">💡</div>
                        <h2>Worked Examples</h2>
                      </div>

                      {studyPack.examples.map((example, idx) => (
                        <div className="study-example" key={idx}>
                          <h3>{example.title || `Example ${idx + 1}`}</h3>
                          <div className="example-label">Question:</div>
                          <p className="example-text">{example.question}</p>

                          <div className="example-label" style={{ color: "var(--success)" }}>
                            Solution:
                          </div>
                          <p className="example-text" style={{ color: "var(--text-primary)" }}>
                            {example.solution}
                          </p>

                          {example.explanation && (
                            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                              {example.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* 3. FORMULAS */}
                  {studyPack.formulas?.length > 0 && (
                    <section className="study-section">
                      <div className="study-section-header">
                        <div className="study-section-icon">📐</div>
                        <h2>Key Formulas</h2>
                      </div>

                      {studyPack.formulas.map((formula, idx) => (
                        <div className="study-formula" key={idx}>
                          <h3>{formula.name}</h3>
                          <code className="study-formula-expression">
                            {formula.formula}
                          </code>
                          <p className="formula-meaning">{formula.meaning}</p>

                          {formula.variables?.length > 0 && (
                            <ul className="formula-vars">
                              {formula.variables.map((v, vIdx) => (
                                <li key={vIdx}>
                                  <strong>{v.symbol}</strong>: {v.meaning}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* 4. AI RESOURCES */}
                  {studyPack.aiResources?.length > 0 && (
                    <section className="study-section">
                      <div className="study-section-header">
                        <div className="study-section-icon">🤖</div>
                        <h2>AI Learning Guides &amp; Resources</h2>
                      </div>

                      {studyPack.aiResources.map((res, idx) => (
                        <div className="study-resource" key={idx}>
                          <h3>{res.title}</h3>
                          <p>{res.description}</p>
                        </div>
                      ))}
                    </section>
                  )}

                  {/* 5. ACTIONS: BATTLE & COMPLETE */}
                  <div className="battle-cta">
                    <Link
                      href={`/battle?topicId=${selectedTopic.id}`}
                      className="battle-cta-btn"
                    >
                      ⚔️ Start Boss Battle
                    </Link>

                    <button
                      type="button"
                      className="button button-ghost button-large"
                      onClick={() => {
                        handleMarkMastered(selectedTopic.id);
                        setSelectedTopic(null);
                      }}
                    >
                      ✓ Mark as Mastered
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
