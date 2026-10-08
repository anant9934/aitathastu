"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, User, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from") || "/student";
  const from = (rawFrom.startsWith("/") && !rawFrom.startsWith("//") && !rawFrom.includes("://")) ? rawFrom : "/student";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to create account. Please try again.");
      }

      // Successfully created account & session cookie set
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
          <span>START PERSISTENT JOURNEY</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Begin with your name and email. Goals, evidence, and your pathway follow directly inside your workspace.
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
          <label htmlFor="name" className="auth-label">
            Your name
          </label>
          <div className="auth-input-wrap">
            <User size={18} className="auth-input-icon" />
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Priya Sharma"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="auth-input"
            />
          </div>
        </div>

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
            Password (min. 6 characters)
          </label>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
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
            <span>Creating account…</span>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="auth-footer-prompt">
        <span>Already have an account?</span>{" "}
        <Link href={`/sign-in?from=${encodeURIComponent(from)}`} className="auth-link">
          Sign in
        </Link>
      </div>

      <div className="auth-eora-aside">
        <div className="auth-eora-avatar">E</div>
        <div className="auth-eora-quote">
          “A small start is enough. One goal and honest evidence can move you forward.”
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
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
        <Suspense fallback={<div className="auth-loading">Loading sign-up...</div>}>
          <SignUpContent />
        </Suspense>
      </main>
    </div>
  );
}
