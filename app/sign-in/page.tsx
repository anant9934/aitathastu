"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from") || "/student";
  const from = (rawFrom.startsWith("/") && !rawFrom.startsWith("//") && !rawFrom.includes("://")) ? rawFrom : "/student";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to sign in. Please verify your credentials.");
      }

      // Successfully signed in -> route to destination
      router.push(from);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-eyebrow">
          <Sparkles size={14} />
          <span>AUTHENTICATED JOURNEY</span>
        </div>
        <h1 className="auth-title">Welcome back to Tathastu</h1>
        <p className="auth-subtitle">
          Your active goals, honest evidence, and next actions follow you seamlessly across devices.
        </p>
      </div>

      {error && (
        <div className="auth-error-banner" role="alert">
          <AlertCircle size={18} className="auth-error-icon" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">
            Email address
          </label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="auth-toggle-password"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-btn"
        >
          {loading ? (
            <span>Signing you in…</span>
          ) : (
            <>
              <span>Sign in to Workspace</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", margin: "1.25rem 0", color: "#64748b", fontSize: "0.8125rem" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
          <span style={{ padding: "0 0.75rem" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
        </div>

        <a
          href={`/api/auth/google/start?from=${encodeURIComponent(from)}`}
          className="auth-google-btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.625rem",
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#f8fafc",
            fontWeight: 500,
            fontSize: "0.9375rem",
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </a>
      </form>

      <div className="auth-footer-prompt">
        <span>New to AI Tathastu?</span>{" "}
        <Link href={`/sign-up?from=${encodeURIComponent(from)}`} className="auth-link">
          Create an account
        </Link>
      </div>

      <div className="auth-eora-aside">
        <div className="auth-eora-avatar">E</div>
        <div className="auth-eora-quote">
          “Your journey is saved with your account, so you can continue on another device.”
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="auth-page-container">
      <header className="auth-nav">
        <div className="auth-nav-inner">
          <Link href="/" className="brand">
            <div className="brand-mark">
              <span>T</span>
            </div>
            <div className="brand-text">
              <strong>Tathastu</strong>
              <small>PERSISTENT JOURNEY</small>
            </div>
          </Link>
          <Link href="/" className="auth-back-link">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <Suspense fallback={<div className="auth-loading">Loading sign-in...</div>}>
          <SignInContent />
        </Suspense>
      </main>
    </div>
  );
}
