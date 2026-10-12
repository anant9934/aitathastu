import assert from "node:assert/strict";
import { PURPOSES, composeWidgetIds, emptyWidgetLayout, normalizeWidgetLayout, validPurposeIds, validatePurposes, type WorkspaceRole } from "../lib/domain/adaptive-workspace";

for (const role of ["student", "faculty"] as WorkspaceRole[]) {
  const ids = PURPOSES[role].map((purpose) => purpose.id);
  assert.equal(ids.length, 6);
  assert.equal(validPurposeIds(role, [] ).length, 0, "No default purpose may be selected");
  for (const primary of ids) {
    const remaining = ids.filter((id) => id !== primary);
    for (const secondary of remaining) {
      for (const tertiary of remaining.filter((id) => id !== secondary)) {
        const ranking = validatePurposes(role, [primary, secondary, tertiary]);
        const widgets = composeWidgetIds(role, ranking, emptyWidgetLayout);
        assert.equal(widgets[0], PURPOSES[role].find((purpose) => purpose.id === primary)?.widget);
        assert.equal(new Set(widgets).size, 3);
      }
    }
  }
  assert.throws(() => validatePurposes(role, []));
  assert.throws(() => validatePurposes(role, [ids[0], ids[0]]));
  assert.throws(() => validatePurposes(role, [...ids.slice(0,4)]));
  assert.throws(() => validatePurposes(role, ["invented"]));
  const layout = normalizeWidgetLayout(role, { pinned: [PURPOSES[role][2].widget, "untrusted"], hidden: [PURPOSES[role][1].widget], order: [PURPOSES[role][1].widget, PURPOSES[role][0].widget], density: "compact", sizes: { [PURPOSES[role][0].widget]: "wide", untrusted: "wide" } });
  assert.deepEqual(layout.pinned, [PURPOSES[role][2].widget]);
  assert.equal(layout.density, "compact");
  assert.equal(layout.sizes.untrusted, undefined);
  const composed = composeWidgetIds(role, ids.slice(0,3), layout);
  assert.equal(composed[0], PURPOSES[role][2].widget);
  assert(!composed.includes(PURPOSES[role][1].widget));
}
console.log("Adaptive V4: all role/purpose combinations, ranking rules, and layout validation passed.");
