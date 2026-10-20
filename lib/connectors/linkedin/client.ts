/**
 * AI TATHASTU — LINKEDIN PROFILE REFERENCE
 *
 * Validates and normalizes the LinkedIn profile URL a student enters. Profile
 * data comes from the public-profile extraction
 * (lib/services/linkedin-extraction-service.ts); LinkedIn passwords, cookies
 * and data-export archives are not used.
 */

export interface LinkedInProfileReference {
  valid: boolean;
  username: string;
  normalizedUrl: string;
  error?: string;
}

/**
 * Validates and normalizes LinkedIn profile URLs or handles.
 */
export function validateLinkedInUrl(input: string): LinkedInProfileReference {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, username: "", normalizedUrl: "", error: "LinkedIn URL or handle is required." };
  }

  // Handle case where user provided just their handle e.g. "anant-kumar"
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const cleanHandle = trimmed.replace(/^@/, "");
    if (/^[a-zA-Z0-9\-_%]{3,100}$/.test(cleanHandle)) {
      return {
        valid: true,
        username: cleanHandle,
        normalizedUrl: `https://www.linkedin.com/in/${cleanHandle}`,
      };
    }
  }

  try {
    const rawWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(rawWithProtocol);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, username: "", normalizedUrl: "", error: "HTTPS protocol is required." };
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && host !== "www.linkedin.com" && !host.endsWith(".linkedin.com")) {
      return { valid: false, username: "", normalizedUrl: "", error: "Domain must be linkedin.com." };
    }

    // Path must start with /in/
    const match = parsed.pathname.match(/^\/in\/([a-zA-Z0-9\-_%]+)\/?$/i);
    if (!match || !match[1]) {
      return { valid: false, username: "", normalizedUrl: "", error: "Profile path must be in format /in/your-username" };
    }

    const username = decodeURIComponent(match[1]);
    return {
      valid: true,
      username,
      normalizedUrl: `https://www.linkedin.com/in/${username}`,
    };
  } catch {
    return { valid: false, username: "", normalizedUrl: "", error: "Malformed LinkedIn URL provided." };
  }
}
