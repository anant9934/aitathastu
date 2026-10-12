import assert from "node:assert/strict";
import { safeDraft } from "../lib/onboarding-v2";
import { studentEntryPath } from "../lib/student-entry";

const partial = safeDraft({ role: "student", currentScreen: 6, completed: false });
assert.equal(partial.currentScreen, 6);
assert.equal(studentEntryPath(partial, null), "/onboarding");
assert.equal(studentEntryPath(null, null), "/onboarding");

const completed = safeDraft({ role: "student", completed: true });
assert.equal(studentEntryPath(completed, null), "/student");
assert.equal(studentEntryPath(completed, null, "/student/projects"), "/student/projects");
assert.equal(studentEntryPath(completed, null, "/student/../faculty"), "/student");
assert.equal(studentEntryPath(completed, null, "//external.example"), "/student");
assert.equal(studentEntryPath(null, { primaryPriority: "learn" }), "/student");
assert.equal(studentEntryPath(completed, { metadata: { requestedRole: "faculty" } }), "/faculty");
assert.equal(safeDraft({ currentScreen: 99 }).currentScreen, undefined);
console.log("V5.6 student entry and screen restoration: 10/10 passed");
