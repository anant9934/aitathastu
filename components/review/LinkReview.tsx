"use client";

/**
 * Links review (Task 2.1.4): every profile link found in the CV or added
 * earlier, editable in place. The check is a local shape check (right site,
 * a real profile path), never a network call.
 */
import React, { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, Check, PencilSimple, Plus, WarningCircle, X } from "@phosphor-icons/react/dist/ssr";
import { Button, IconButton } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusChip";

export const LINK_PLATFORMS: { id: string; label: string; host: RegExp; example: string }[] = [
  { id: "github", label: "GitHub", host: /(^|\.)github\.com$/, example: "https://github.com/your-handle" },
  { id: "linkedin", label: "LinkedIn", host: /(^|\.)linkedin\.com$/, example: "https://www.linkedin.com/in/your-name" },
  { id: "leetcode", label: "LeetCode", host: /(^|\.)leetcode\.(com|cn)$/, example: "https://leetcode.com/u/your-handle" },
  { id: "hackerrank", label: "HackerRank", host: /(^|\.)hackerrank\.com$/, example: "https://www.hackerrank.com/profile/your-handle" },
  { id: "kaggle", label: "Kaggle", host: /(^|\.)kaggle\.com$/, example: "https://www.kaggle.com/your-handle" },
  { id: "orcid", label: "ORCID", host: /(^|\.)orcid\.org$/, example: "https://orcid.org/0000-0002-1825-0097" },
  { id: "google_scholar", label: "Google Scholar", host: /^scholar\.google\./, example: "https://scholar.google.com/citations?user=..." },
  { id: "huggingface", label: "Hugging Face", host: /(^|\.)huggingface\.co$/, example: "https://huggingface.co/your-handle" },
  { id: "portfolio", label: "Portfolio", host: /./, example: "https://your-site.dev" },
];
const label = (id: string) => LINK_PLATFORMS.find((p) => p.id === id)?.label ?? id;

/** Plain-language problem with a link, or null when it looks right. */
export function checkLink(platform: string, raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Add a link.";
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); } catch { return "This doesn't look like a web address."; }
  const spec = LINK_PLATFORMS.find((p) => p.id === platform);
  if (spec && !spec.host.test(url.hostname.toLowerCase())) return `This isn't a ${spec.label} address. Expected something like ${spec.example}.`;
  if (platform !== "portfolio" && url.pathname.replace(/\/+$/, "") === "" && !url.search) return `Add your profile path, e.g. ${spec?.example ?? "/your-handle"}.`;
  return null;
}

const normalise = (raw: string) => (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);

export function LinkReview({ links, discovered, onChange }: {
  links: Partial<Record<string, string>>;
  discovered?: Partial<Record<string, string>>;
  onChange: (next: Partial<Record<string, string>>) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const entries = Object.entries(links).filter((e): e is [string, string] => Boolean(e[1]) && !String(e[1]).startsWith("Archive:"));
  const free = LINK_PLATFORMS.filter((p) => !links[p.id]);

  return (
    <div className="flex flex-col gap-3">
      {free.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => { setAdding(true); setEditing(null); }}>Add link</Button>
        </div>
      )}
      {adding && (
        <LinkForm platforms={free.map((p) => p.id)} onCancel={() => setAdding(false)} onSave={(platform, url) => { onChange({ ...links, [platform]: url }); setAdding(false); }} />
      )}
      {entries.length === 0 && !adding && (
        <p className="rounded-[var(--radius-control)] border border-dashed border-line-strong/60 px-4 py-5 text-sm text-muted">
          No profile links yet. Add GitHub, LinkedIn or any profile you want counted as evidence.
        </p>
      )}
      <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line empty:hidden">
        {entries.map(([platform, url]) => {
          const problem = checkLink(platform, url);
          return (
            <li key={platform} className="px-3.5 py-3">
              {editing === platform ? (
                <LinkForm platforms={[platform]} initial={url} onCancel={() => setEditing(null)} onSave={(_, next) => { onChange({ ...links, [platform]: next }); setEditing(null); }} />
              ) : (
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-medium">{label(platform)}</p>
                    <a className="link inline-flex max-w-full items-center gap-1 break-all text-sm" href={normalise(url)} target="_blank" rel="noopener noreferrer">
                      {url}<ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {discovered?.[platform] && <Tag>From CV</Tag>}
                      {problem
                        ? <span className="inline-flex items-center gap-1 text-xs text-warning"><WarningCircle size={14} weight="bold" aria-hidden="true" />{problem}</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-verified"><Check size={14} weight="bold" aria-hidden="true" />Looks right</span>}
                    </div>
                  </div>
                  <span className="flex gap-1">
                    <IconButton label={`Edit ${label(platform)} link`} onClick={() => { setEditing(platform); setAdding(false); }}><PencilSimple size={16} aria-hidden="true" /></IconButton>
                    <IconButton label={`Remove ${label(platform)} link`} className="text-muted hover:text-danger" onClick={() => onChange({ ...links, [platform]: "" })}><X size={16} aria-hidden="true" /></IconButton>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LinkForm({ platforms, initial = "", onSave, onCancel }: { platforms: string[]; initial?: string; onSave: (platform: string, url: string) => void; onCancel: () => void }) {
  const [platform, setPlatform] = useState(platforms[0]);
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  return (
    <form
      noValidate
      className="grid gap-3 rounded-[var(--radius-control)] border border-signal/50 bg-surface p-3.5 sm:grid-cols-[12rem_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = checkLink(platform, url);
        if (problem) { setError(problem); input.current?.focus(); return; }
        onSave(platform, normalise(url));
      }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
    >
      {platforms.length > 1 && (
        <SelectField label="Site" value={platform} onChange={(e) => { setPlatform(e.target.value); setError(null); }}>
          {platforms.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </SelectField>
      )}
      <TextField
        ref={input}
        wrapperClassName={platforms.length > 1 ? undefined : "sm:col-span-2"}
        label={`${label(platform)} link`}
        type="url"
        inputMode="url"
        value={url}
        placeholder={LINK_PLATFORMS.find((p) => p.id === platform)?.example}
        error={error}
        onChange={(e) => { setUrl(e.target.value); setError(null); }}
      />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" size="sm" variant="primary">Save link</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
