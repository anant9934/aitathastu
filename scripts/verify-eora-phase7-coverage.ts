/**
 * EORA ALIVE PHASE 7 — ROUTE & DOM TARGET COVERAGE VERIFICATION SUITE
 *
 * Validates:
 * 1. All 16 routes have comprehensive, typed EoraPageContract definitions.
 * 2. All 16 routes have guided tours with concrete steps.
 * 3. All DOM targets across all tours exist in real source files.
 * 4. Fallback contract protects unregistered/future routes safely.
 * 5. Coverage report is accurate and reproducible.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  getAllPageContracts,
  getPageContract,
  isRouteCovered,
  getCoverageReport,
  getFallbackPageContract,
} from "../lib/eora/page-registry";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log("\n=== EORA ALIVE PHASE 7: COVERAGE VERIFICATION SUITE ===\n");

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1: Route Coverage
// ─────────────────────────────────────────────────────────────────────────────
console.log("GROUP 1: Page Contract Registration Across All 16 Routes");

const EXPECTED_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/onboarding",
  "/student",
  "/student/profile",
  "/student/skills",
  "/student/skills/python",
  "/student/projects",
  "/student/projects/proj-123",
  "/student/roadmap",
  "/student/connections",
  "/student/journey",
  "/student/assessments",
  "/student/interviews",
  "/verification",
];

for (const route of EXPECTED_ROUTES) {
  test(`Route '${route}' is recognized as covered`, () => {
    assert.strictEqual(isRouteCovered(route), true);
  });

  test(`Route '${route}' resolves to valid contract with title and purpose`, () => {
    const contract = getPageContract(route);
    assert.ok(contract, `Contract missing for ${route}`);
    assert.ok(contract.pageId, `pageId missing for ${route}`);
    assert.ok(contract.pageTitle.length > 0, `pageTitle empty for ${route}`);
    assert.ok(contract.pagePurpose.length > 10, `pagePurpose too short for ${route}`);
    assert.ok(contract.mainUserGoals.length > 0, `mainUserGoals empty for ${route}`);
    assert.ok(contract.availableFunctions.length > 0, `availableFunctions empty for ${route}`);
    assert.ok(contract.commonQuestions.length > 0, `commonQuestions empty for ${route}`);
    assert.ok(contract.guidedTour, `guidedTour missing for ${route}`);
    assert.ok(contract.guidedTour.steps.length > 0, `guidedTour has 0 steps for ${route}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2: Coverage Report & Fallback Behavior
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nGROUP 2: Coverage Reporting & Generic Fallback Safety");

test("getAllPageContracts returns exactly 16 registered contracts", () => {
  const all = getAllPageContracts();
  assert.strictEqual(all.length, 16);
});

test("getCoverageReport accurately tallies routes and sections", () => {
  const report = getCoverageReport();
  assert.strictEqual(report.total, 16);
  assert.strictEqual(report.routes.length, 16);
  for (const r of report.routes) {
    assert.ok(r.keySectionsCount >= 0);
    assert.ok(r.tourStepsCount >= 1);
  }
});

test("Unmapped route returns safe fallback contract without fabrication", () => {
  const fallback = getFallbackPageContract("/some/future/unknown-route");
  assert.strictEqual(fallback.pageId, "generic-fallback");
  assert.strictEqual(fallback.routePath, "/some/future/unknown-route");
  assert.strictEqual(fallback.mainUserGoals.length >= 1, true);
  assert.strictEqual(fallback.guidedTour.steps.length >= 1, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3: DOM Target Verification Across All Source Code
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nGROUP 3: DOM Target Physical Deployment Check");

function collectAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(entry.name)) {
        collectAllSourceFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const sourceFiles = [
  ...collectAllSourceFiles(path.resolve(__dirname, "../app")),
  ...collectAllSourceFiles(path.resolve(__dirname, "../components")),
];

const sourceCodeCombined = sourceFiles.map((f) => fs.readFileSync(f, "utf-8")).join("\n");

// Gather all targetIds from all 16 page tours
const allContracts = getAllPageContracts();
const uniqueTargetIds = new Set<string>();

for (const contract of allContracts) {
  for (const step of contract.guidedTour.steps) {
    uniqueTargetIds.add(step.targetId);
  }
}

for (const targetId of Array.from(uniqueTargetIds).sort()) {
  test(`DOM target '${targetId}' is physically deployed in source files`, () => {
    const exists = sourceCodeCombined.includes(targetId);
    assert.ok(
      exists,
      `Target id '${targetId}' is declared in a tour but not found in any source file!`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log(`  EORA Phase 7 Coverage Verification Results`);
console.log(`  Passed: ${passed}  |  Failed: ${failed}  |  Total: ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("  ✓ All Phase 7 coverage checks passed successfully.\n");
}
