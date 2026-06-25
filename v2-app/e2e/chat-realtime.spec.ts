/**
 * E2E: Chat realtime — two browser contexts (coach + trainee).
 *
 * Prerequisite: E2E_COACH_EMAIL and E2E_TRAINEE_EMAIL must have an accepted
 * coach_link in the DB. Run these tests with credentials set in env.
 *
 *   E2E_COACH_EMAIL=... E2E_COACH_PASS=... E2E_TRAINEE_EMAIL=... E2E_TRAINEE_PASS=... npx playwright test
 */
import { test, expect } from '@playwright/test';
import { signInCoach, signInTrainee, TRAINEE_EMAIL } from './helpers/auth';

// Unread badge on the trainee top-bar (TopBar.svelte .unread-badge)
const UNREAD = '.unread-badge';

test.describe('Chat realtime + unread badge', () => {
  test('coach sends message → trainee sees unread badge immediately', async ({ browser }) => {
    // Two isolated browser contexts (separate Supabase sessions).
    const coachCtx   = await browser.newContext();
    const traineeCtx = await browser.newContext();
    const coachPage   = await coachCtx.newPage();
    const traineePage = await traineeCtx.newPage();

    // Sign in both users.
    await signInCoach(coachPage);
    await signInTrainee(traineePage);

    // Coach: open the trainee's row.
    await coachPage.locator('.row.trainee').filter({ hasText: TRAINEE_EMAIL }).click();
    // Coach: open the Chat tab inside the trainee view.
    await coachPage.getByRole('button', { name: /chat/i }).click();
    await coachPage.waitForSelector('.chat-input, textarea', { timeout: 8_000 });

    // Coach: type and send a unique message.
    const uniqueMsg = `E2E test ${Date.now()}`;
    await coachPage.locator('.chat-input, textarea').fill(uniqueMsg);
    await coachPage.keyboard.press('Enter');
    // Confirm message appeared in coach's bubble list.
    await expect(coachPage.locator('.bubble').filter({ hasText: uniqueMsg })).toBeVisible({ timeout: 5_000 });

    // Trainee: unread badge should appear within a few seconds (realtime).
    await expect(traineePage.locator(UNREAD)).toBeVisible({ timeout: 10_000 });

    await coachCtx.close();
    await traineeCtx.close();
  });

  test('trainee opens chat → unread badge clears', async ({ browser }) => {
    const coachCtx   = await browser.newContext();
    const traineeCtx = await browser.newContext();
    const coachPage   = await coachCtx.newPage();
    const traineePage = await traineeCtx.newPage();

    await signInCoach(coachPage);
    await signInTrainee(traineePage);

    // Coach sends a message first.
    await coachPage.locator('.row.trainee').first().click();
    await coachPage.getByRole('button', { name: /chat/i }).click();
    await coachPage.waitForSelector('.chat-input, textarea', { timeout: 8_000 });
    const msg = `clear-test ${Date.now()}`;
    await coachPage.locator('.chat-input, textarea').fill(msg);
    await coachPage.keyboard.press('Enter');
    await expect(coachPage.locator('.bubble').filter({ hasText: msg })).toBeVisible({ timeout: 5_000 });

    // Wait for trainee badge to appear.
    await expect(traineePage.locator(UNREAD)).toBeVisible({ timeout: 10_000 });

    // Trainee: click the chat button (TopBar.svelte .chat-btn) — this opens the coach
    // chat overlay and triggers markMessagesRead, which clears the badge.
    await traineePage.locator('.chat-btn').click();
    // After reading, badge should disappear.
    await expect(traineePage.locator(UNREAD)).toBeHidden({ timeout: 8_000 });

    await coachCtx.close();
    await traineeCtx.close();
  });
});
