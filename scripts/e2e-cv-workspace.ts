/**
 * Completes the CV review workspace in a browser test the way a student would:
 * ticks every section, keeps what the CV supplied for the required profile
 * fields, fills in only what is missing (synthetic test values), completes the
 * current education and saves. Returns what the page reported.
 */
import type { Page } from "playwright";

export async function completeCvReview(page: Page, opts: { timeoutMs?: number } = {}): Promise<{ saved: boolean; message: string }> {
  const review = page.locator('section[aria-labelledby="cv-review-title"]');
  await review.waitFor({ timeout: opts.timeoutMs ?? 120_000 });
  for (const button of await review.getByRole("button", { name: /^Tick all$/ }).all()) await button.click();

  const fill = async (label: RegExp, value: string) => {
    const input = review.getByLabel(label).first();
    if (!(await input.inputValue()).trim()) await input.fill(value);
  };
  const tick = async (name: RegExp) => {
    const box = review.getByRole("checkbox", { name }).first();
    if (!(await box.isChecked())) await box.check();
  };
  await fill(/^Full name/, "Test Student");
  await tick(/^Save Full name$/);
  await fill(/^Email/, "test.student@example.test");
  await tick(/^Save Email$/);
  const github = review.getByLabel(/^GitHub profile URL/).first();
  if (!/^https:\/\/github\.com\/[A-Za-z0-9-]+\/?$/.test(await github.inputValue())) await github.fill("https://github.com/test-student");
  await tick(/^Save GitHub profile URL$/);

  if (!(await review.locator('#cv-ws-education input[type="radio"]').count())) await review.getByRole("button", { name: "Add education" }).click();
  const current = review.locator("#cv-ws-education li", { has: page.locator('input[type="radio"]:checked') }).first();
  await current.getByRole("checkbox", { name: /^Save/ }).check();
  for (const [label, value] of [[/^Qualification/, "B.Tech"], [/^College/, "Test Institute of Technology"], [/^Specialization/, "Computer Science"], [/^Start year/, "2022"]] as const) {
    const field = current.getByLabel(label).first();
    if (!(await field.inputValue()).trim()) await field.fill(value);
  }
  await current.getByLabel(/^Education status/).selectOption("Pursuing");
  await current.getByLabel(/passing-out date/i).first().fill(`May ${new Date().getUTCFullYear() + 1}`);

  await page.getByRole("button", { name: /Save reviewed details/ }).click();
  const footer = review.locator("[aria-live=polite]").last();
  await page.waitForFunction(() => /Your reviewed details are saved|attention|missing|couldn't|could not|too large|reload/i.test(document.querySelector('section[aria-labelledby="cv-review-title"] [aria-live=polite]')?.textContent ?? ""), null, { timeout: 30_000 }).catch(() => undefined);
  const message = ((await footer.textContent()) ?? "").trim();
  return { saved: /Your reviewed details are saved/.test(message), message };
}
