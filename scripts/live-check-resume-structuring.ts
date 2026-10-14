/**
 * REAL-COST check (Task 1.1.2): one resume-structuring call per named
 * provider, each forced by giving the router only that provider's keys.
 * Loads only *_API_KEY(S) and *_MODEL from .env — never DATABASE_URL — and
 * runs with NODE_ENV=test so no audit row is written anywhere.
 *
 *   node --import tsx scripts/live-check-resume-structuring.ts groq gemini openrouter cerebras
 */
import fs from "node:fs";

const SAMPLE = `Asha Rao | Pune, India | asha.rao@example.com
github.com/asha-rao-dev
EDUCATION
Indian Institute of Technology Delhi | B.Tech, Computer Science | 2021 – Present | CGPA 8.7
EXPERIENCE
Zeta Analytics | Bengaluru, India | Machine Learning Intern | May 2024 – Jul 2024
• Built a churn model in PyTorch that cut false positives by 18%.
PROJECTS
Pathified | https://pathified.app | github.com/asha-rao-dev/pathified
AI career-path recommender. Tech: Next.js, Python, FastAPI
SKILLS
Python, PyTorch, SQL, Docker`;

const ENV_KEYS: Record<string, string[]> = {
  groq: ["GROQ_API_KEYS", "GROQ_API_KEY", "GROQ_MODEL"],
  gemini: ["GEMINI_API_KEYS", "GEMINI_API_KEY", "GEMINI_MODEL"],
  openrouter: ["OPENROUTER_API_KEYS", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
  cerebras: ["CEREBRAS_API_KEYS", "CEREBRAS_API_KEY", "CEREBRAS_MODEL"],
  mistral: ["MISTRAL_API_KEYS", "MISTRAL_API_KEY", "MISTRAL_MODEL"],
  sambanova: ["SAMBANOVA_API_KEYS", "SAMBANOVA_API_KEY", "SAMBANOVA_MODEL"],
};

function readEnvFile() {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const file = readEnvFile();
  (process.env as Record<string, string>).NODE_ENV = "test";
  delete process.env.UPSTASH_REDIS_REST_URL; // quota in memory: no writes to the shared Redis
  const { IntelligenceRouter } = await import("../lib/intelligence/router");
  const { structureResumeText } = await import("../lib/resume/structure");
  for (const provider of process.argv.slice(2)) {
    // Keep any *_MODEL override given on the command line; drop every key.
    for (const keys of Object.values(ENV_KEYS)) for (const k of keys) if (!k.endsWith("_MODEL")) delete process.env[k];
    for (const k of ENV_KEYS[provider]) if (file[k] && !process.env[k]) process.env[k] = file[k];
    const started = Date.now();
    try {
      const out = await structureResumeText(SAMPLE, "live-check", new IntelligenceRouter());
      const d = out.data;
      console.log(`${provider}: OK ${Date.now() - started}ms model=${out.model} attempts=${out.attempts.map((a) => a.outcome).join(">")}`
        + ` | name=${d.name} edu=${d.education[0]?.institution} end=${d.education[0]?.end_date} exp=${d.experience[0]?.company}/${d.experience[0]?.location}`
        + ` proj=${d.projects[0]?.name} repo=${d.projects[0]?.repository} skills=${d.skills.length}`);
    } catch (error) {
      const e = error as { message: string; attempts?: unknown };
      console.log(`${provider}: FAIL ${Date.now() - started}ms ${e.message} ${JSON.stringify(e.attempts ?? [])}`);
    }
  }
}

main();
