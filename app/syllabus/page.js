"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";

export default function SyllabusPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [existingSubjects, setExistingSubjects] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Load existing subjects so users can also jump directly to them
  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch("/api/subjects");
        const data = await res.json();
        if (data.success && Array.isArray(data.subjects)) {
          setExistingSubjects(data.subjects);
        }
      } catch (err) {
        console.error("Failed to load existing subjects:", err);
      }
    }
    loadSubjects();
  }, []);

  function handleFileChange(selectedFiles) {
    const fileList = Array.from(selectedFiles || []);
    if (!fileList.length) return;
    setFiles((prev) => [...prev, ...fileList]);
    setError("");
    setResult(null);
  }

  function removeFile(indexToRemove) {
    setFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();

    if (!files.length) {
      setError("Please select at least one syllabus image or PDF.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/syllabus/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract syllabus.");
      }

      setResult(data);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to process files.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-page-wrapper">
      <div className="app-backdrop" aria-hidden="true" />
      <Navbar />

      <main className="page-shell">
        <div className="page-header">
          <div className="page-kicker">
            <span className="page-kicker-line" /> AI Curriculum Generator
          </div>
          <h1>Upload Your Syllabus</h1>
          <p>
            Upload textbook table-of-contents, course outlines, or syllabus images (or PDF).
            Gemini AI will automatically construct your personalized learning pathway.
          </p>
        </div>

        {/* Existing Subjects Shortcut (if any) */}
        {existingSubjects.length > 0 && !result && (
          <div style={{ marginBottom: 32, padding: "18px 24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Already Uploaded
                </span>
                <h3 style={{ margin: "4px 0 0", fontSize: 16, color: "var(--text-primary)" }}>
                  Jump to existing learning paths:
                </h3>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {existingSubjects.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/learning?subjectId=${sub.id}`}
                    className="button button-ghost button-small"
                    style={{ border: "1px solid var(--accent-border)", color: "var(--accent)" }}
                  >
                    📖 {sub.name} →
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload Box */}
        {!result && (
          <form onSubmit={handleSubmit}>
            <div
              className={`upload-zone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileChange(e.dataTransfer.files);
              }}
              onClick={() => document.getElementById("syllabus-file-input")?.click()}
            >
              <input
                id="syllabus-file-input"
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
              />
              <div className="upload-zone-icon">📷</div>
              <h3>Drop your syllabus photos or PDF here</h3>
              <p>Supports PNG, JPG, WEBP, PDF up to 20MB</p>
              <button
                type="button"
                className="browse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("syllabus-file-input")?.click();
                }}
              >
                📁 Browse Files
              </button>
            </div>

            {/* Uploaded File List */}
            {files.length > 0 && (
              <div className="uploaded-files">
                {files.map((file, idx) => (
                  <div className="uploaded-file" key={`${file.name}-${idx}`}>
                    <div className="uploaded-file-icon">
                      {file.type.includes("pdf") ? "📄" : "🖼️"}
                    </div>
                    <div className="uploaded-file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      type="button"
                      className="uploaded-file-remove"
                      onClick={() => removeFile(idx)}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginTop: 20 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginTop: 28, display: "flex", gap: 14, alignItems: "center" }}>
              <button
                type="submit"
                className="extract-btn"
                disabled={loading || !files.length}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        border: "2px solid #000",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Gemini AI Extracting Syllabus...
                  </>
                ) : (
                  <>✨ Generate Learning Pathway</>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Result View */}
        {result && (
          <div className="syllabus-result">
            <div className="alert alert-success">
              🎉 Syllabus successfully extracted and saved into your curriculum!
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, margin: "24px 0" }}>
              <div>
                <span className="result-subject">
                  📚 Subject: {result.syllabus?.subject || "Curriculum"}
                </span>
                <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>
                  {result.syllabus?.chapters?.length || 0} chapters identified
                </p>
              </div>

              <Link
                href={`/learning?subjectId=${result.subjectId}`}
                className="button button-primary button-large"
                style={{ fontSize: 15 }}
              >
                🚀 Open Duolingo Learning Path →
              </Link>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {result.syllabus?.chapters?.map((chapter, cIdx) => (
                <div className="syllabus-chapter" key={cIdx}>
                  <div className="syllabus-chapter-header">
                    <span className="syllabus-chapter-number">{cIdx + 1}</span>
                    <h3>{chapter.name}</h3>
                  </div>
                  {chapter.topics && chapter.topics.length > 0 && (
                    <ul className="syllabus-topics-list">
                      {chapter.topics.map((topic, tIdx) => (
                        <li key={tIdx}>
                          {typeof topic === "string" ? topic : topic.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
              <Link
                href={`/learning?subjectId=${result.subjectId}`}
                className="button button-primary button-large"
              >
                🚀 Go to Learning Path
              </Link>
              <button
                type="button"
                className="button button-ghost button-large"
                onClick={() => {
                  setResult(null);
                  setFiles([]);
                }}
              >
                + Upload Another Syllabus
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
