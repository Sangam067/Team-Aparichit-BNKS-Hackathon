"use client";

import { useEffect, useState } from "react";

export default function TestLearningPage() {
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");

  const [studyPack, setStudyPack] = useState(null);
  const [loading, setLoading] = useState(false);

  // -----------------------------
  // Load subjects
  // -----------------------------

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();

        if (data.success) {
          setSubjects(data.subjects);
        }
      } catch (error) {
        console.error("Failed to load subjects:", error);
      }
    }

    loadSubjects();
  }, []);

  // -----------------------------
  // Subject changed
  // -----------------------------

  async function handleSubjectChange(value) {
    setSubjectId(value);
    setChapterId("");
    setTopicId("");
    setChapters([]);
    setTopics([]);
    setStudyPack(null);

    if (!value) return;

    try {
      const response = await fetch(`/api/curriculum/${value}`);
      const data = await response.json();

      if (data.success) {
        setChapters(data.subject.chapters);
      }
    } catch (error) {
      console.error("Failed to load chapters:", error);
    }
  }

  // -----------------------------
  // Chapter changed
  // -----------------------------

  function handleChapterChange(value) {
    setChapterId(value);
    setTopicId("");
    setStudyPack(null);

    const chapter = chapters.find(
      (chapter) => String(chapter.id) === value
    );

    setTopics(chapter?.topics || []);
  }

  // -----------------------------
  // Generate study pack
  // -----------------------------

  async function generateStudyPack() {
    if (!topicId) return;

    setLoading(true);
    setStudyPack(null);

    try {
      const response = await fetch(`/api/topics/${topicId}/study`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to generate study pack."
        );
      }

      setStudyPack(data.studyPack);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Learning Pathway Test</h1>

      <p>
        Test the Subject → Chapter → Topic → Theory pathway.
      </p>

      {/* Subject */}

      <div style={{ marginTop: "30px" }}>
        <label>
          <strong>Subject</strong>
        </label>

        <select
          value={subjectId}
          onChange={(e) =>
            handleSubjectChange(e.target.value)
          }
          style={{
            display: "block",
            width: "100%",
            padding: "10px",
            marginTop: "8px",
          }}
        >
          <option value="">Select a subject</option>

          {subjects.map((subject) => (
            <option
              key={subject.id}
              value={subject.id}
            >
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      {/* Chapter */}

      <div style={{ marginTop: "20px" }}>
        <label>
          <strong>Chapter</strong>
        </label>

        <select
          value={chapterId}
          onChange={(e) =>
            handleChapterChange(e.target.value)
          }
          disabled={!subjectId}
          style={{
            display: "block",
            width: "100%",
            padding: "10px",
            marginTop: "8px",
          }}
        >
          <option value="">Select a chapter</option>

          {chapters.map((chapter) => (
            <option
              key={chapter.id}
              value={chapter.id}
            >
              {chapter.chapterNumber}. {chapter.name}
            </option>
          ))}
        </select>
      </div>

      {/* Topic */}

      <div style={{ marginTop: "20px" }}>
        <label>
          <strong>Topic</strong>
        </label>

        <select
          value={topicId}
          onChange={(e) => {
            setTopicId(e.target.value);
            setStudyPack(null);
          }}
          disabled={!chapterId}
          style={{
            display: "block",
            width: "100%",
            padding: "10px",
            marginTop: "8px",
          }}
        >
          <option value="">Select a topic</option>

          {topics.map((topic) => (
            <option
              key={topic.id}
              value={topic.id}
            >
              {topic.orderIndex}. {topic.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selected topic */}

      {topicId && (
        <div
          style={{
            marginTop: "25px",
            padding: "15px",
            background: "#f3f4f6",
            borderRadius: "8px",
          }}
        >
          <strong>Selected Topic:</strong>

          <div style={{ marginTop: "5px" }}>
            {
              topics.find(
                (topic) =>
                  String(topic.id) === topicId
              )?.name
            }
          </div>
        </div>
      )}

      {/* Generate */}

      <button
        onClick={generateStudyPack}
        disabled={!topicId || loading}
        style={{
          marginTop: "25px",
          padding: "12px 20px",
          cursor:
            !topicId || loading
              ? "not-allowed"
              : "pointer",
        }}
      >
        {loading
          ? "Generating..."
          : "Generate Study Pack"}
      </button>

      {/* Study Pack */}

      {studyPack && (
        <div style={{ marginTop: "40px" }}>

          {/* THEORY */}

          <section>
            <h2>Theory</h2>

            <p>
              {studyPack.theory.summary}
            </p>

            <h3>Key Points</h3>

            <ul>
              {studyPack.theory.keyPoints.map(
                (point, index) => (
                  <li key={index}>
                    {point}
                  </li>
                )
              )}
            </ul>
          </section>

          {/* EXAMPLES */}

          <section
            style={{ marginTop: "30px" }}
          >
            <h2>Examples</h2>

            {studyPack.examples.map(
              (example, index) => (
                <div key={index}>
                  <p>
                    <strong>
                      Question:
                    </strong>{" "}
                    {example.question}
                  </p>

                  <p>
                    <strong>
                      Solution:
                    </strong>{" "}
                    {example.solution}
                  </p>
                </div>
              )
            )}
          </section>

          {/* FORMULAS */}

          <section
            style={{ marginTop: "30px" }}
          >
            <h2>Formulas</h2>

            {studyPack.formulas.map(
              (formula, index) => (
                <div key={index}>
                  <pre>
                    {formula.formula}
                  </pre>

                  <p>
                    {formula.meaning}
                  </p>
                </div>
              )
            )}
          </section>

          {/* YOUTUBE RESOURCES */}

          <section
            style={{ marginTop: "30px" }}
          >
            <h2>YouTube Resources</h2>

            {studyPack.youtubeResources.map(
              (resource, index) => (
                <div key={index}>
                  <h3>
                    {resource.title}
                  </h3>

                  <p>
                    <strong>
                      Level:
                    </strong>{" "}
                    {resource.level}
                  </p>

                  <p>
                    <strong>
                      Recommended length:
                    </strong>{" "}
                    {resource.recommendedLength}
                  </p>

                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      resource.searchQuery
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🔎 Search YouTube
                  </a>
                </div>
              )
            )}
          </section>

          {/* BATTLE */}

          <section
            style={{ marginTop: "40px" }}
          >
            <button
              onClick={() => {
                window.location.href =
                  `/test-learning/battle?topicId=${topicId}`;
              }}
            >
              ⚔️ Start Battle
            </button>
          </section>

        </div>
      )}
    </main>
  );
}