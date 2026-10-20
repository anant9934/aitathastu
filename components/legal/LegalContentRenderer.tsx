"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

export function formatInlineText(text: string): React.ReactNode[] {
  // Split on [VERIFY: ...], links [text](url), and bold **text**
  const regex = /(\[VERIFY:[^\]]*\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Check [VERIFY: ...]
    if (part.startsWith("[VERIFY:") && part.endsWith("]")) {
      const inner = part.slice(8, -1).trim();
      return (
        <span
          key={index}
          className="inline-flex items-center gap-1 rounded bg-accent-warm/15 px-2 py-0.5 font-mono text-2xs font-medium text-accent-warm-bright border border-accent-warm/30 align-middle my-0.5"
          title="This item awaits verification by the platform owner or qualified legal counsel"
        >
          <span className="size-1.5 rounded-full bg-accent-warm-bright animate-pulse" aria-hidden="true" />
          Awaiting Verification{inner ? `: ${inner}` : ""}
        </span>
      );
    }

    // Check markdown link [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkHref = linkMatch[2];
      const isExternal = linkHref.startsWith("http");

      if (isExternal) {
        return (
          <a
            key={index}
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-warm underline decoration-accent-warm/40 hover:text-accent-warm-bright hover:decoration-accent-warm-bright transition-colors"
          >
            {linkText}
          </a>
        );
      }

      return (
        <Link
          key={index}
          href={linkHref}
          className="text-accent-warm underline decoration-accent-warm/40 hover:text-accent-warm-bright hover:decoration-accent-warm-bright transition-colors"
        >
          {linkText}
        </Link>
      );
    }

    // Check bold **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-text-primary">
          {boldText}
        </strong>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function LegalContentRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-text-muted">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Check if markdown table
        if (trimmed.includes("|") && trimmed.includes("\n|")) {
          const tableRows = trimmed.split("\n").filter((r) => r.trim().startsWith("|"));
          if (tableRows.length >= 2) {
            const parseRow = (row: string) =>
              row
                .split("|")
                .slice(1, -1)
                .map((cell) => cell.trim());
            const headerCells = parseRow(tableRows[0]);
            const isSeparator = (r: string) => r.replace(/[\s|:-]/g, "").length === 0;
            const bodyRows = tableRows.slice(1).filter((r) => !isSeparator(r));

            return (
              <div key={idx} className="my-4 overflow-x-auto rounded-lg border border-border-medium bg-bg-surface shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-medium bg-deep-espresso/50">
                      {headerCells.map((h, i) => (
                        <th key={i} className="px-3 py-2.5 font-semibold text-text-primary">
                          {formatInlineText(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-mono text-2xs sm:text-xs">
                    {bodyRows.map((r, rowIdx) => {
                      const cells = parseRow(r);
                      return (
                        <tr key={rowIdx} className="hover:bg-deep-espresso/30 transition-colors">
                          {cells.map((c, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 text-text-muted">
                              {formatInlineText(c)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Check bullet lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n(?=[- *])/).map((item) => item.replace(/^[- *]\s*/, "").trim());
          return (
            <ul key={idx} className="my-2 space-y-1.5 list-disc list-inside text-text-muted">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-1">
                  <span>{formatInlineText(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Check numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split(/\n(?=\d+\.\s)/).map((item) => item.replace(/^\d+\.\s*/, "").trim());
          return (
            <ol key={idx} className="my-2 space-y-1.5 list-decimal list-inside text-text-muted">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-1">
                  <span>{formatInlineText(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-text-muted">
            {formatInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
