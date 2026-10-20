import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

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

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function startIsolatedServer(OUT: string): Promise<{ base: string; proc: ChildProcess }> {
  if (process.env.E2E_BASE_URL) throw new Error("E2E_BASE_URL is not supported: this script only drives a server it started with an isolated database.");
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join("node_modules", ".bin", "next"), "dev", "-p", String(port)], {
    env: { ...process.env, ...ISOLATED_ENV },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const log = fs.createWriteStream(path.join(OUT, "server.log"));
  proc.stdout?.pipe(log);
  proc.stderr?.pipe(log);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server did not start in 120 s")), 120_000);
    proc.stdout?.on("data", (d: Buffer) => { if (/Ready in/.test(d.toString())) { clearTimeout(timer); resolve(); } });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`dev server exited (${code})`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  await fetch(`${base}/onboarding`); // compile once before timing anything
  return { base, proc };
}

