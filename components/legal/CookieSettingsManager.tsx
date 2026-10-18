"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LockKey,
  SlidersHorizontal,
  CheckCircle,
  XCircle,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Feedback";

export interface CookiePreferences {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const STORAGE_KEY = "tathastu_cookie_preferences";

export function CookieSettingsManager() {
  const [prefs, setPrefs] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPrefs({
          essential: true,
          functional: parsed.functional !== false,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
        });
        if (parsed.updatedAt) {
          setSavedAt(new Date(parsed.updatedAt).toLocaleString());
        }
      }
    } catch {
      // Use defaults
    }
  }, []);

  const savePreferences = async (newPrefs: CookiePreferences) => {
    setSaving(true);
    const payload = {
      ...newPrefs,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setPrefs(newPrefs);
      setSavedAt(new Date().toLocaleString());

      // Send to server
      await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      }).catch(() => null);

      toast.success("Cookie preferences saved", "Your browser storage choices have been updated.");
    } catch {
      toast.error("Could not save choices", "Please check your browser permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => void savePreferences(prefs);

  const handleAcceptAll = () =>
    void savePreferences({
      essential: true,
      functional: true,
      analytics: true,
      marketing: false, // Marketing is kept false as no marketing SDKs exist
    });

  const handleRejectOptional = () =>
    void savePreferences({
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    });

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-lg border border-border-medium bg-bg-surface p-4 text-xs text-text-muted space-y-2">
        <div className="flex items-center gap-2 font-semibold text-warm-ivory">
          <Info size={16} className="text-accent-warm-bright shrink-0" aria-hidden="true" />
          <span>Transparent Storage Notice</span>
        </div>
        <p>
          AI Tathastu only uses browser storage necessary for core functionality, security, and optional interface personalization.
          We do NOT install third-party tracking pixels, advertising cookies, or cross-site fingerprinting technologies.
        </p>
        <p>
          Read the complete technical inventory in our{" "}
          <Link href="/cookies" className="text-accent-warm underline hover:text-accent-warm-bright">
            Cookie and Browser Storage Policy
          </Link>
          .
        </p>
      </div>

      {/* Category 1: Strictly Essential */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-warm-ivory">1. Strictly Essential Storage</h3>
              <span className="rounded bg-verified/20 px-2 py-0.5 font-mono text-2xs font-semibold text-verified border border-verified/30">
                Always Active
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Required for security, user authentication, and protecting against Cross-Site Request Forgery (CSRF).
              These cookies cannot be turned off as the website cannot function securely without them.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <LockKey size={20} className="text-verified" aria-hidden="true" />
          </div>
        </div>

        <div className="rounded-md bg-deep-espresso/50 p-3 text-2xs font-mono text-text-dim space-y-1 border border-border-subtle">
          <p className="font-semibold text-warm-ivory">Active items:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><span className="text-warm-ivory">tathastu_session</span>: HTTP-only session cookie (30-day lifetime)</li>
            <li><span className="text-warm-ivory">tathastu_gh_oauth_state</span>: GitHub OAuth CSRF token (10 min)</li>
            <li><span className="text-warm-ivory">tathastu_google_oauth_state / nonce</span>: Google sign-in replay tokens (10 min)</li>
          </ul>
        </div>
      </div>

      {/* Category 2: Functional & Preferences */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-warm-ivory">2. Functional &amp; Theme Preferences</h3>
              <span className="rounded bg-accent-warm/20 px-2 py-0.5 font-mono text-2xs font-semibold text-accent-warm-bright border border-accent-warm/30">
                Optional
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Remembers your dark/light theme choice, navigation preferences, and EORA guidance display settings.
              If disabled, default cinematic dark settings apply on every reload.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 pt-1">
            <input
              type="checkbox"
              checked={prefs.functional}
              onChange={(e) => setPrefs((prev) => ({ ...prev, functional: e.target.checked }))}
              className="sr-only peer"
              aria-label="Toggle functional storage"
            />
            <div className="w-11 h-6 bg-deep-espresso border border-border-interactive peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[2px] after:bg-warm-ivory after:border-border-medium after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-warm peer-checked:after:bg-bg-primary"></div>
          </label>
        </div>

        <div className="rounded-md bg-deep-espresso/50 p-3 text-2xs font-mono text-text-dim space-y-1 border border-border-subtle">
          <p className="font-semibold text-warm-ivory">Managed local keys:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><span className="text-warm-ivory">tathastu_theme</span>: Dark / Light appearance state</li>
            <li><span className="text-warm-ivory">tathastu_workspace_v1</span>: Local navigation layout state</li>
            <li><span className="text-warm-ivory">tathastu_eora_*</span>: EORA guideline collapse state</li>
          </ul>
        </div>
      </div>

      {/* Category 3: Analytics */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-warm-ivory">3. Website Performance &amp; Analytics</h3>
              <span className="rounded bg-border-medium px-2 py-0.5 font-mono text-2xs text-text-dim">
                None Installed
              </span>
            </div>
            <p className="text-xs text-text-muted">
              No third-party analytics trackers (such as Google Analytics, Mixpanel, or Hotjar) are installed or active.
              Default is OFF. If future performance analytics are enabled, this control will govern them.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 pt-1">
            <input
              type="checkbox"
              checked={prefs.analytics}
              onChange={(e) => setPrefs((prev) => ({ ...prev, analytics: e.target.checked }))}
              className="sr-only peer"
              aria-label="Toggle analytics storage"
            />
            <div className="w-11 h-6 bg-deep-espresso border border-border-interactive peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[2px] after:bg-warm-ivory after:border-border-medium after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-warm peer-checked:after:bg-bg-primary"></div>
          </label>
        </div>
      </div>

      {/* Category 4: Marketing & Advertising */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-warm-ivory">4. Marketing &amp; Cross-Site Tracking</h3>
              <span className="rounded bg-border-medium px-2 py-0.5 font-mono text-2xs text-text-dim">
                Disabled &amp; Prohibited
              </span>
            </div>
            <p className="text-xs text-text-muted">
              AI Tathastu does not display advertisements, sell student personal data, or utilize behavioral tracking pixels.
              In accordance with Indian child data safeguards (DPDP Act 2023), tracking and targeted advertising for students is strictly barred.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <XCircle size={20} className="text-text-dim" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="rounded-card border border-border-medium bg-bg-elevated p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div>
          {savedAt ? (
            <p className="text-2xs font-mono text-text-dim">Last saved: {savedAt}</p>
          ) : (
            <p className="text-2xs font-mono text-text-dim">Using standard privacy configuration</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRejectOptional}>
            Reject optional
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAcceptAll}>
            Accept recommended
          </Button>
          <Button variant="primary" size="sm" loading={saving} loadingLabel="Saving…" onClick={handleSave}>
            Save my choices
          </Button>
        </div>
      </div>
    </div>
  );
}
