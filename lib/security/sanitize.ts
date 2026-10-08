/**
 * Content Sanitization and XSS Defense for Phase D production readiness.
 * Sanitizes markdown, text, project descriptions, and user profile fields.
 */

/**
 * Strips dangerous HTML tags and script elements from user-supplied strings.
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== "string") return "";

  // Strip script tags and content
  let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Strip iframe, object, embed, applet, form tags
  cleaned = cleaned.replace(/<\/?(iframe|object|embed|applet|form|base|link|meta)\b[^>]*>/gi, "");

  // Strip inline event handlers like onclick, onload, onerror
  cleaned = cleaned.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Strip javascript: protocol in href or src
  cleaned = cleaned.replace(/\b(href|src)\s*=\s*["']?\s*javascript:[^"'>]+/gi, "");

  return cleaned.trim();
}

/**
 * Escapes characters for safe HTML rendering if plaintext must be rendered safely.
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
