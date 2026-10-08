import type { ProfileDetails } from "@/lib/onboarding";

const sectionNames = /^(education|academics|academic background|academic qualifications|qualifications|education\s*&\s*qualifications|skills|technical skills|core skills|key skills|technical competencies|technical proficiencies|areas of expertise|experience|work experience|professional experience|employment history|work history|relevant experience|projects|key projects|certifications|summary|professional summary|profile|about me|contact)$/i;

function cleanHeading(line: string) {
  return line.replace(/[*_#:`]/g, "").trim().replace(/:$/, "").trim();
}

function section(lines: string[], headings: RegExp, limit: number) {
  const index = lines.findIndex((line) => headings.test(cleanHeading(line)));
  if (index < 0) return "";
  const contents: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const cleaned = cleanHeading(line);
    if (sectionNames.test(cleaned)) break;
    if (line.length > 200) break;
    contents.push(line.replace(/^[•\-–—*]\s*|^\d+[\.)]\s*/, "").trim());
    if (contents.length >= limit) break;
  }
  return contents.filter(Boolean).join("; ").slice(0, 500);
}

export function resumeSuggestions(text: string): ProfileDetails {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => Boolean(line) && !/^--\s*\d+\s+of\s+\d+\s*--$/.test(line));
  const name = lines.slice(0, 8).find((line) => {
    const cleaned = cleanHeading(line);
    const words = cleaned.split(/\s+/);
    return words.length >= 2 && words.length <= 4 && cleaned.length <= 60 && /^[\p{L}.'’\- ]+$/u.test(cleaned) && !sectionNames.test(cleaned) && !/curriculum|resume|vitae|email|phone|contact|profile/i.test(cleaned);
  }) ?? "";
  return {
    name,
    education: section(lines, /^(education|academics|academic background|academic qualifications|qualifications|education\s*&\s*qualifications)$/i, 3),
    skills: section(lines, /^(skills|technical skills|core skills|key skills|technical competencies|technical proficiencies|areas of expertise)$/i, 3),
    experience: section(lines, /^(experience|work experience|professional experience|employment history|work history|relevant experience)$/i, 3),
  };
}


export function resumeDiscovery(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const items = (heading: RegExp) => section(lines, heading, 8).split(";").map(item => item.trim()).filter(item => item.length >= 4 && item.length <= 140);
  return {
    certifications: items(/^(certifications|certificates|licenses)$/i),
    projects: items(/^(projects|key projects|academic projects|personal projects)$/i),
  };
}
