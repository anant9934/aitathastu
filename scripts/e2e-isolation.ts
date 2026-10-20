/**
 * Environment for browser tests' own dev server. Every value is non-empty on
 * purpose: Next fills a variable from .env only when it is undefined, so these
 * can never be replaced by production settings.
 */
export const ISOLATED_ENV: Record<string, string> = {
  NODE_ENV: "development",
  DATABASE_MODE: "pglite",
  PGLITE_IN_MEMORY: "true",
  DATABASE_AUTO_MIGRATE: "true",
  DATABASE_URL: "pglite://isolated-e2e",
  DATABASE_URL_UNPOOLED: "pglite://isolated-e2e",
  NEON_BRANCH: "e2e-disabled",
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9",
  UPSTASH_REDIS_REST_TOKEN: "e2e-disabled",
};
