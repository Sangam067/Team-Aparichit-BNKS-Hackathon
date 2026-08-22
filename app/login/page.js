"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Login failed."
        );
      }

      // Save logged-in user
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // Go to learning page
      router.push("/test-learning");
    } catch (error) {
      console.error("Login error:", error);
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

      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-tabs" aria-label="Account access">
          <span className="auth-tab auth-tab-active">Sign in</span>
          <Link className="auth-tab" href="/register">Sign up</Link>
        </div>
        <p className="auth-kicker">Welcome back</p>
        <h1 id="login-title">Log in to continue</h1>
        <p className="auth-subtitle">Return to your learning adventure.</p>

        <form className="auth-form" onSubmit={handleLogin}>
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
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
            <span aria-hidden="true">↑</span>
          </button>
        </form>

        <p className="auth-switch">New to GameEdu? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}