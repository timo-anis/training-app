/**
 * E2E: trainee core-path smoke tests — the workout-critical paths the DoD calls
 * out (boot, day render, add exercise, mark set done, data persists).
 *
 * ⚠️  NOT YET RUN IN CI. Requires the test trainee password as an env var and a
 * Playwright browser (chromium) — neither is available in the analysis sandbox,
 * so these were written against the real component selectors but not executed.
 * To run locally / in CI:
 *   npm i && npx playwright install chromium
 *   E2E_TRAINEE_EMAIL=timoanis+test6@gmail.com E2E_TRAINEE_PASS=… \
 *     npx playwright test e2e/trainee-smoke.spec.ts
 * (playwright.config.ts already boots the vite dev server on :5173.)
 *
 * These run against the SHARED test trainee account, so the mutating test adds a
 * uniquely-named exercise and deletes it again to stay idempotent. NEVER point
 * these at Timo's real account.
 */
import { test, expect, type Page } from '@playwright/test';
import { signInTrainee } from './helpers/auth';

async function addExercise(page: Page, name: string) {
  // Entry point differs for an empty vs non-empty day: prefer the always-present
  // "+ Add exercise" trigger; fall back to the empty-day "Start blank" button.
  const trigger = page.locator('.add-ex-trigger');
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  } else {
    await page.locator('.welcome-secondary').click();
  }
  const input = page.locator('.add-ex-input');
  await input.waitFor({ state: 'visible', timeout: 5_000 });
  await input.fill(name);
  // Confirm via the panel's confirm button (Enter also works).
  await page.locator('.btn-confirm').click();
  await expect(page.locator('.exercise-card').filter({ hasText: name })).toBeVisible();
}

test.describe('Trainee core paths', () => {
  test('boot renders the core surfaces (calendar + day heading)', async ({ page }) => {
    await signInTrainee(page);
    await expect(page.locator('.month-cal')).toBeVisible();
    await expect(page.locator('.day-label')).toBeVisible();
  });

  test('add exercise, mark a set done, and it survives a reload', async ({ page }) => {
    await signInTrainee(page);
    const name = `E2E Smoke ${Date.now()}`;
    const card = page.locator('.exercise-card').filter({ hasText: name });

    // Add
    await addExercise(page, name);

    // Mark the first set done → the done button reflects pressed state.
    const doneBtn = card.locator('.donebtn').first();
    await doneBtn.click();
    await expect(doneBtn).toHaveAttribute('aria-pressed', 'true');

    // Data-integrity promise: the done state persists across a reload (cloud+local).
    await page.reload();
    await page.waitForSelector('.month-cal', { timeout: 15_000 });
    const cardAfter = page.locator('.exercise-card').filter({ hasText: name });
    await expect(cardAfter.locator('.donebtn').first()).toHaveAttribute('aria-pressed', 'true');

    // Cleanup — keep the shared account idempotent.
    await cardAfter.locator('.del-ex-btn').click();
    await expect(page.locator('.exercise-card').filter({ hasText: name })).toBeHidden({ timeout: 8_000 });
  });
});
