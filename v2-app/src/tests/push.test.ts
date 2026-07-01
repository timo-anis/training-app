/**
 * push.test.ts — unit tests for services/push.ts
 *
 * push.ts is intentionally OFF by default (no VAPID key, no service worker wiring).
 * These tests verify every early-exit path returns the correct PushReason and that
 * getPushState() accurately reflects the browser environment.
 *
 * The jsdom test environment does not implement ServiceWorker, PushManager, or the
 * standalone display-mode, so the not-configured/unsupported/not-standalone paths
 * are the defaults. Tests that need VAPID key presence use vi.resetModules() +
 * vi.doMock() + dynamic import to exercise the configured paths.
 *
 * push.ts imports supabase (used only in the subscribe/unsubscribe paths, not in the
 * early-exit paths tested here) — supabase is mocked to keep tests self-contained.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock: applies to the static import at the bottom of this describe block.
// vi.resetModules() tests use vi.doMock() instead (see each beforeEach).
vi.mock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));

// ── Default state (no VAPID key, jsdom environment) ───────────────────────────
describe('without VAPID key (default build)', () => {
  // Import push once — no env stubbing, no resetModules.
  // VAPID_PUBLIC_KEY is '' because VITE_VAPID_PUBLIC_KEY is undefined in tests.
  let push: typeof import('../services/push');

  beforeEach(async () => {
    push = await import('../services/push');
  });

  it('isPushConfigured() returns false', () => {
    expect(push.isPushConfigured()).toBe(false);
  });

  it('pushSupported() returns false in jsdom (no ServiceWorker/PushManager)', () => {
    expect(push.pushSupported()).toBe(false);
  });

  it('isStandalone() returns false in jsdom', () => {
    expect(push.isStandalone()).toBe(false);
  });

  it('getPushState() reflects jsdom environment correctly', () => {
    const state = push.getPushState();
    expect(state.configured).toBe(false);
    expect(state.supported).toBe(false);
    expect(state.standalone).toBe(false);
    expect(['unsupported', 'default', 'granted', 'denied']).toContain(state.permission);
  });

  it('enablePush() returns "not-configured" immediately without touching the network', async () => {
    const reason = await push.enablePush('user-1');
    expect(reason).toBe('not-configured');
  });
});

// ── With VAPID key present but no service worker ──────────────────────────────
describe('with VAPID key configured, no service worker (jsdom)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BDummy-vapid-key-for-testing-only');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('isPushConfigured() returns true', async () => {
    const { isPushConfigured } = await import('../services/push');
    expect(isPushConfigured()).toBe(true);
  });

  it('enablePush() returns "unsupported" (no ServiceWorker in jsdom)', async () => {
    const { enablePush } = await import('../services/push');
    const reason = await enablePush('user-1');
    expect(reason).toBe('unsupported');
  });

  it('getPushState() shows configured=true, supported=false', async () => {
    const { getPushState } = await import('../services/push');
    const state = getPushState();
    expect(state.configured).toBe(true);
    expect(state.supported).toBe(false);
  });
});

// ── With service worker mocked but not standalone ─────────────────────────────
describe('with VAPID key + service worker mocked, not standalone', () => {
  let savedSWDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BDummy-vapid-key-for-testing-only');

    // Inject minimal serviceWorker + PushManager + Notification so pushSupported()=true
    savedSWDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }) },
      configurable: true,
      writable: true,
    });
    if (!('PushManager' in window)) {
      Object.defineProperty(window, 'PushManager', { value: {}, configurable: true });
    }
    if (!('Notification' in window)) {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'default', requestPermission: async () => 'default' },
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    if (savedSWDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', savedSWDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).serviceWorker;
    }
  });

  it('pushSupported() returns true when APIs are present', async () => {
    const { pushSupported } = await import('../services/push');
    expect(pushSupported()).toBe(true);
  });

  it('enablePush() returns "not-standalone" (no matchMedia/standalone in jsdom)', async () => {
    const { enablePush } = await import('../services/push');
    // isStandalone() checks window.matchMedia and navigator.standalone — both absent
    const reason = await enablePush('user-1');
    expect(reason).toBe('not-standalone');
  });
});
