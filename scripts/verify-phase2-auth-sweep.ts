/**
 * Task 2.6.3: every handler under /api/student/** answers 401 without a
 * session, and /student pages redirect to /sign-in. Calls the running dev
 * server (default http://localhost:3100, the test-database server).
 *
 *   node --import tsx scripts/verify-phase2-auth-sweep.ts
 */
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const BASE = process.env.VISUAL_BASE_URL || "http://localhost:3100";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

function toUrlPath(file: string) {
  const parts = path.dirname(file).split(path.sep).slice(1); // drop "app"
  return "/" + parts.map((p) => (p.startsWith("[") ? "x-test-id" : p)).join("/");
}

async function main() {
  const notGated: string[] = [];
  let checked = 0;
  for (const file of routeFiles(path.join("app", "api", "student"))) {
    const src = readFileSync(file, "utf8");
    const url = toUrlPath(file);
    for (const method of METHODS) {
      if (!src.includes(`function ${method}(`) && !src.includes(`const ${method} `)) continue;
      checked++;
      const res = await fetch(BASE + url, {
        method,
        headers: { "Content-Type": "application/json", Origin: BASE },
        body: method === "GET" ? undefined : "{}",
        redirect: "manual",
      });
      if (res.status !== 401) notGated.push(`${method} ${url} -> ${res.status}`);
    }
  }
  const pages: string[] = [];
  for (const page of ["/student", "/student/profile", "/student/skills", "/student/projects", "/student/connections"]) {
    const res = await fetch(BASE + page, { redirect: "manual" });
    pages.push(`${page} -> ${res.status} ${res.headers.get("location") ?? ""}`);
  }
  const demo = await fetch(`${BASE}/api/student/dashboard?demo=true`);
  console.log(JSON.stringify({ handlersChecked: checked, notReturning401: notGated, pages, dashboardDemoParam: demo.status }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
