"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Registration failed."
        );
      }

      // Save user in localStorage
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // Go to learning page
      router.push("/test-learning");
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true" />
      <Link className="auth-brand brand" href="/" aria-label="GameEdu home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>Game<span className="brand-accent">Edu</span></span>
      </Link>

      <section className="auth-panel" aria-labelledby="register-title">
        <div className="auth-tabs" aria-label="Account access">
          <Link className="auth-tab" href="/login">Sign in</Link>
          <span className="auth-tab auth-tab-active">Sign up</span>
        </div>
        <p className="auth-kicker">Start your journey</p>
        <h1 id="register-title">Create your account</h1>
        <p className="auth-subtitle">Build skills, earn XP, and learn by doing.</p>

        <form className="auth-form" onSubmit={handleRegister}>
          <div className="auth-field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
            <span aria-hidden="true">↑</span>
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}