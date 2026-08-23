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
          <div className="existing-subjects-card">
            <div className="existing-subjects-header">
              <span className="existing-subjects-tag">
                ALREADY UPLOADED
              </span>
              <h3 className="existing-subjects-title">
                Jump to existing learning paths:
              </h3>
            </div>

            <div className="existing-subjects-list">
              {existingSubjects.map((sub, idx) => (
                <Link
                  key={sub.id || idx}
                  href={`/learning?subjectId=${sub.id}`}
                  className="glass-topic-btn"
                >
                  <span className="glass-topic-icon">📖</span>
                  <span className="glass-topic-text">{sub.name || `Learning Path #${idx + 1}`}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upload Box */}
        {!result && (
          <form onSubmit={handleSubmit} className="syllabus-form">
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
                style={{ display: "none" }}
              />

              <div className="upload-zone-icon-shell">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #ede2cd)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <h3 className="upload-zone-heading">Drop your syllabus photos or PDF here</h3>
              <p className="upload-zone-sub">Supports PNG, JPG, WEBP, PDF up to 20MB</p>

              <button
                type="button"
                className="browse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("syllabus-file-input")?.click();
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>Browse Files</span>
              </button>
            </div>

            {/* Uploaded File List */}
            {files.length > 0 && (
              <div className="uploaded-files-container">
                <div className="uploaded-files-header">
                  <span>Selected Documents ({files.length})</span>
                </div>
                <div className="uploaded-files-grid">
                  {files.map((file, idx) => {
                    const isPdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
                    return (
                      <div className="uploaded-file-item" key={`${file.name}-${idx}`}>
                        <div className="uploaded-file-icon-box">
                          {isPdf ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          )}
                        </div>
                        <div className="uploaded-file-info">
                          <div className="uploaded-file-name" title={file.name}>{file.name}</div>
                          <div className="uploaded-file-meta">
                            <span className="uploaded-file-badge">{isPdf ? "PDF Document" : "Image"}</span>
                            <span>•</span>
                            <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="uploaded-file-remove-btn"
                          onClick={() => removeFile(idx)}
                          title="Remove file"
                          aria-label={`Remove ${file.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="alert-box alert-box-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="syllabus-action-row">
              <button
                type="submit"
                className="button button-primary button-large syllabus-submit-btn"
                disabled={loading || !files.length}
              >
                {loading ? (
                  <>
                    <span className="submit-spinner" />
                    <span>Gemini AI Synthesizing Pathway...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>Generate Learning Pathway</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Result View */}
        {result && (
          <div className="syllabus-result-shell">
            <div className="alert-box alert-box-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Syllabus successfully extracted and synthesized into your curriculum!</span>
            </div>

            <div className="result-header-bar">
              <div>
                <div className="result-subject-tag">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span>Subject: {result.syllabus?.subject || "Curriculum"}</span>
                </div>
                <p className="result-meta-text">
                  {result.syllabus?.chapters?.length || 0} chapters identified and sequenced.
                </p>
              </div>

              <Link
                href={`/learning?subjectId=${result.subjectId}`}
                className="button button-primary button-large"
              >
                <span>Open Learning Path</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            <div className="chapters-stack">
              {result.syllabus?.chapters?.map((chapter, cIdx) => (
                <div className="chapter-result-card" key={cIdx}>
                  <div className="chapter-result-header">
                    <span className="chapter-result-number">{cIdx + 1}</span>
                    <h3 className="chapter-result-name">{chapter.name}</h3>
                  </div>
                  {chapter.topics && chapter.topics.length > 0 && (
                    <ul className="chapter-topics-grid">
                      {chapter.topics.map((topic, tIdx) => (
                        <li key={tIdx} className="chapter-topic-item">
                          <span className="topic-bullet-dot" />
                          <span>{typeof topic === "string" ? topic : topic.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="result-actions-footer">
              <Link
                href={`/learning?subjectId=${result.subjectId}`}
                className="button button-primary button-large"
              >
                <span>Enter Pathway Arena</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
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

      <style jsx>{`
        /* ===== PROFESSIONAL SYLLABUS UPLOAD STYLES ===== */
        .existing-subjects-card {
          margin-bottom: 32px;
          padding: 22px 26px;
          background: rgba(12, 19, 14, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: var(--radius-lg, 16px);
          backdrop-filter: blur(18px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        }

        .existing-subjects-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 16px;
        }

        .existing-subjects-tag {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          color: var(--accent, #ede2cd);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .existing-subjects-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
        }

        .existing-subjects-list {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Glass Topic Buttons */
        .glass-topic-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.25);
          color: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 650;
          transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .glass-topic-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--accent, #ede2cd);
          color: #ffffff;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(237, 226, 205, 0.2);
        }

        .glass-topic-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .glass-topic-icon {
          font-size: 16px;
          line-height: 1;
        }

        .glass-topic-text {
          font-size: 14px;
          letter-spacing: -0.01em;
        }

        /* Form & Dropzone */
        .syllabus-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 28px;
          background: rgba(14, 20, 15, 0.55);
          border: 2px dashed rgba(255, 255, 255, 0.16);
          border-radius: var(--radius-xl, 20px);
          text-align: center;
          cursor: pointer;
          backdrop-filter: blur(16px);
          transition: all 220ms ease;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
        }

        .upload-zone:hover {
          border-color: var(--accent, #ede2cd);
          background: rgba(20, 30, 22, 0.65);
          transform: translateY(-2px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(237, 226, 205, 0.06);
        }

        .upload-zone.drag-over {
          border-color: #4ade80;
          background: rgba(31, 76, 54, 0.35);
          box-shadow: 0 0 40px rgba(74, 222, 128, 0.2);
          transform: scale(1.01);
        }

        .upload-zone-icon-shell {
          display: grid;
          place-items: center;
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: rgba(237, 226, 205, 0.08);
          border: 1px solid rgba(237, 226, 205, 0.2);
          margin-bottom: 20px;
          transition: all 200ms ease;
        }

        .upload-zone:hover .upload-zone-icon-shell {
          background: rgba(237, 226, 205, 0.15);
          transform: scale(1.05);
        }

        .upload-zone-heading {
          font-size: clamp(18px, 2vw, 21px);
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }

        .upload-zone-sub {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
        }

        .browse-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #ffffff;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: all 180ms ease;
        }

        .browse-btn:hover {
          background: var(--accent, #ede2cd);
          border-color: var(--accent, #ede2cd);
          color: #080a08;
          transform: translateY(-1px);
        }

        /* Uploaded Files */
        .uploaded-files-container {
          background: rgba(14, 20, 15, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-lg, 16px);
          padding: 20px 24px;
          backdrop-filter: blur(14px);
        }

        .uploaded-files-header {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 16px;
        }

        .uploaded-files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }

        .uploaded-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          transition: all 180ms ease;
        }

        .uploaded-file-item:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .uploaded-file-icon-box {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .uploaded-file-info {
          flex: 1;
          min-width: 0;
        }

        .uploaded-file-name {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .uploaded-file-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 2px;
        }

        .uploaded-file-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
        }

        .uploaded-file-remove-btn {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          font-size: 12px;
          cursor: pointer;
          transition: all 180ms ease;
        }

        .uploaded-file-remove-btn:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #ffffff;
          border-color: #ef4444;
          transform: scale(1.05);
        }

        /* Alerts */
        .alert-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.5;
        }

        .alert-box-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #fca5a5;
        }

        .alert-box-success {
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.28);
          color: #86efac;
        }

        /* Submit Action */
        .syllabus-action-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .syllabus-submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .submit-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.3);
          border-top-color: #080a08;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* Results Shell */
        .syllabus-result-shell {
          display: flex;
          flex-direction: column;
          gap: 28px;
          animation: rise-in 0.5s ease both;
        }

        @keyframes rise-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .result-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          padding: 24px 28px;
          background: rgba(14, 20, 15, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-lg, 16px);
          backdrop-filter: blur(16px);
        }

        .result-subject-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 700;
          color: var(--accent, #ede2cd);
        }

        .result-meta-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 4px 0 0;
        }

        .chapters-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chapter-result-card {
          background: rgba(14, 20, 15, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg, 16px);
          overflow: hidden;
          backdrop-filter: blur(14px);
        }

        .chapter-result-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .chapter-result-number {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(237, 226, 205, 0.12);
          color: var(--accent, #ede2cd);
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .chapter-result-name {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .chapter-topics-grid {
          list-style: none;
          padding: 14px 20px;
          margin: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 10px;
        }

        .chapter-topic-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.4;
        }

        .topic-bullet-dot {
          width: 5px;
          height: 5px;
          background: var(--accent, #ede2cd);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .result-actions-footer {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
