/**
 * config.ts — Centralized access-control allow-lists.
 *
 * COACH_EMAILS: users allowed to use the coach surface.
 *   Server-side: profiles.is_coach = true must also be set (see supabase_rls.sql).
 *   Client-side: this list gates the UI. Both must stay in sync.
 *
 * PRESENTATION_EMAILS: users allowed to switch to the presentation (light) theme.
 *
 * When adding a coach: add here + run UPDATE profiles SET is_coach = true WHERE id = '<uuid>';
 */
export const COACH_EMAILS: string[] = [
  'timo.anis@gmail.com',
  'kreete.suvi@gmail.com',
];

export const PRESENTATION_EMAILS: string[] = [
  'timo.anis@gmail.com',
];
