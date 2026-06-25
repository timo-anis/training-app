/**
 * E2E: Revoke flow — coach revokes access, both sides lose visibility.
 *
 * ⚠️  This test is DESTRUCTIVE — it revokes the coach_link between the
 * test accounts. After this test runs, the accounts are no longer linked.
 * Re-invite manually (coach invites trainee) to restore the link.
 *
 * Run separately from other tests:
 *   npx playwright test e2e/revoke.spec.ts
 */
import { test, expect } from '@playwright/test';
import { signInCoach, signInTrainee, TRAINEE_EMAIL } from './helpers/auth';

test.describe('Revoke flow', () => {
  test('revoke cuts coach access to trainee data', async ({ browser }) => {
    const coachCtx   = await browser.newContext();
    const traineeCtx = await browser.newContext();
    const coachPage   = await coachCtx.newPage();
    const traineePage = await traineeCtx.newPage();

    await signInCoach(coachPage);
    await signInTrainee(traineePage);

    // Verify coach can see trainee before revoke.
    await expect(coachPage.locator('.row.trainee').filter({ hasText: TRAINEE_EMAIL })).toBeVisible();

    // Revoke: click Revoke button (first click = "Confirm" state, second = actual revoke).
    const revokeBtn = coachPage.locator('.row.trainee')
      .filter({ hasText: TRAINEE_EMAIL })
      .locator('.row-action.danger');
    await revokeBtn.click();               // → "Confirm"
    await revokeBtn.click();               // → actual revoke

    // Coach: trainee row should disappear.
    await expect(coachPage.locator('.row.trainee').filter({ hasText: TRAINEE_EMAIL }))
      .toBeHidden({ timeout: 8_000 });

    // Trainee: reload and confirm main app is visible (coach link gone).
    await traineePage.reload();
    await traineePage.waitForSelector('.month-cal', { timeout: 10_000 });
    // The coach-active section should not be visible after revoke.
    await expect(traineePage.locator('.coach-active, .coach-connected')).toBeHidden();

    await coachCtx.close();
    await traineeCtx.close();
  });
});
