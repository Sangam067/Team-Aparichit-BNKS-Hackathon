"use client";

import { useState } from "react";

export default function TestSyllabusPage() {
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!files.length) {
      setError("Please select at least one file.");
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
        throw new Error(data.error || "Something went wrong");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "60px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>📚 Syllabus AI Tester</h1>

      <p>
        Upload textbook table-of-content images or a PDF and let Gemini
        extract the syllabus.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={(e) => {
            setFiles(Array.from(e.target.files || []));
            setResult(null);
            setError("");
          }}
        />

        {files.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <strong>Selected files:</strong>

            {files.map((file) => (
              <div key={file.name}>
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !files.length}
          style={{
            marginTop: "20px",
            padding: "12px 20px",
            cursor: "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Extract Syllabus"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: "30px",
            padding: "15px",
            background: "#fee2e2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "40px" }}>
          <h2>Gemini Result</h2>

          <pre
            style={{
              background: "#111",
              color: "#fff",
              padding: "20px",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}