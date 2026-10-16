/**
 * The active goal is the target role (Task 2.1.1): onboarding no longer asks a
 * separate "big goal" or timeline. One wording for every place that shows it.
 */
export function roleGoalTitle(targetRole: string): string {
  const role = targetRole.trim();
  const first = role.split(/\s+/)[0] ?? "";
  // Acronyms are read letter by letter: "an ML Engineer", "an NLP Engineer", "a GenAI Engineer".
  const acronym = /^[A-Z]{2,}/.test(first);
  const vowelSound = acronym ? /^[AEFHILMNORSX]/.test(first) : /^[aeiou]/i.test(first);
  return `Become ${vowelSound ? "an" : "a"} ${role}`;
}
