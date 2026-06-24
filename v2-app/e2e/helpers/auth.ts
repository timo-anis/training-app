import { type Page } from '@playwright/test';

export const COACH_EMAIL   = process.env.E2E_COACH_EMAIL   ?? 'timo.anis@gmail.com';
export const COACH_PASS    = process.env.E2E_COACH_PASS    ?? '';
export const TRAINEE_EMAIL = process.env.E2E_TRAINEE_EMAIL ?? 'timoanis+test6@gmail.com';
export const TRAINEE_PASS  = process.env.E2E_TRAINEE_PASS  ?? '';

/** Sign in on the trainee PWA (index.html). */
export async function signInTrainee(page: Page, email = TRAINEE_EMAIL, pass = TRAINEE_PASS) {
  await page.goto('/');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(pass);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait until the main app is visible (not the auth card)
  await page.waitForSelector('.hero-card, .month-cal, [data-testid="main-view"]', { timeout: 15_000 });
}

/** Sign in on the coach surface (coach.html). */
export async function signInCoach(page: Page, email = COACH_EMAIL, pass = COACH_PASS) {
  await page.goto('/coach.html');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(pass);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait until the coach dashboard is loaded
  await page.waitForSelector('.dash', { timeout: 15_000 });
}
