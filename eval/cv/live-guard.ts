/**
 * Isolation for evaluation runs that call live AI providers (--ai-configs with
 * any AI stage). Imported first by run.ts, so it acts before any other module
 * code, and it does not trust the command line or .env:
 *   - NODE_ENV=test and an in-memory PGlite database; every database URL is cleared
 *     (.env sets NODE_ENV=production and a production DATABASE_URL);
 *   - Upstash credentials are removed, so AI quota counters stay in process memory
 *     instead of the production Redis that real students' quotas use;
 *   - outbound HTTP is allowed only to the three provider APIs, and a hard ceiling
 *     caps the number of provider requests (CV_EVAL_MAX_PROVIDER_REQUESTS); past it,
 *     requests are refused before anything is sent.
 */

export const PROVIDER_HOSTS = ["api.groq.com", "generativelanguage.googleapis.com", "openrouter.ai"] as const;

export interface LiveGuardStats { allowed: Record<string, number>; refusedOverCeiling: number; blockedHosts: Record<string, number>; ceiling: number }

export function installLiveEvalGuard(opts: { env: NodeJS.ProcessEnv; ceiling: number; target?: { fetch: typeof fetch } }): { stats: LiveGuardStats; uninstall: () => void } {
  const { env } = opts;
  (env as Record<string, string | undefined>).NODE_ENV = "test";
  env.DATABASE_MODE = "pglite";
  env.PGLITE_IN_MEMORY = "true";
  for (const k of Object.keys(env)) if (/^(?:DATABASE_URL|DATABASE_URL_UNPOOLED|POSTGRES_[A-Z_]*|PG(?:HOST|USER|PASSWORD|DATABASE|PORT)|DATABASE_TRANSPORT|NEON_[A-Z_]*)$/.test(k)) env[k] = "";
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;

  const target = opts.target ?? globalThis;
  const realFetch = target.fetch;
  const stats: LiveGuardStats = { allowed: {}, refusedOverCeiling: 0, blockedHosts: {}, ceiling: opts.ceiling };
  let sent = 0;
  target.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const url = new URL(href);
    if (url.protocol === "file:" || url.protocol === "data:") return realFetch(input, init);
    if (!(PROVIDER_HOSTS as readonly string[]).includes(url.hostname)) {
      stats.blockedHosts[url.hostname] = (stats.blockedHosts[url.hostname] ?? 0) + 1;
      throw new Error(`Evaluation guard: blocked request to ${url.hostname}`);
    }
    if (sent >= opts.ceiling) {
      stats.refusedOverCeiling++;
      throw new Error("Evaluation guard: provider request ceiling reached; nothing was sent.");
    }
    sent++;
    stats.allowed[url.hostname] = (stats.allowed[url.hostname] ?? 0) + 1;
    return realFetch(input, init);
  }) as typeof fetch;
  return { stats, uninstall: () => { target.fetch = realFetch; } };
}

const configs = (process.argv.includes("--ai-configs") ? process.argv[process.argv.indexOf("--ai-configs") + 1] ?? "" : "").split(",").filter(Boolean);
export const LIVE_AI = configs.some((c) => c !== "deterministic");
export let liveGuardStats: LiveGuardStats | null = null;

if (LIVE_AI) {
  if (process.env.CV_EVAL_ALLOW_LIVE_AI !== "yes") {
    console.error("--ai-configs with AI stages calls live providers and spends API credits. Set CV_EVAL_ALLOW_LIVE_AI=yes to run it.");
    process.exit(2);
  }
  const ceiling = Number(process.env.CV_EVAL_MAX_PROVIDER_REQUESTS ?? 132);
  if (!Number.isInteger(ceiling) || ceiling < 1) {
    console.error("CV_EVAL_MAX_PROVIDER_REQUESTS must be a positive integer.");
    process.exit(2);
  }
  liveGuardStats = installLiveEvalGuard({ env: process.env, ceiling }).stats;
}
