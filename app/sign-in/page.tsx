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
