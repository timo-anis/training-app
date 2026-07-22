/**
 * biometric.test.ts — services/biometric.ts feature-detection + credential-key schema.
 *
 * jsdom implements neither navigator.credentials nor window.PublicKeyCredential, so
 * biometricSupported() is false and the WebAuthn calls take their guarded early-exit
 * paths. These tests pin those exits and the pure credential-key storage schema — the
 * parts that must never regress. The live Face ID happy path is validated on-device.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  biometricSupported,
  credentialKey,
  readCredentialId,
  clearCredentialId,
  hasCredential,
  verifyBiometric,
  registerBiometric,
} from '../services/biometric';

describe('biometricSupported', () => {
  it('is false in jsdom (no navigator.credentials / PublicKeyCredential)', () => {
    expect(biometricSupported()).toBe(false);
  });
});

describe('credential-key schema', () => {
  it('namespaces per user with a stable prefix', () => {
    expect(credentialKey('user-1')).toBe('timo_biolock_cred__user-1');
    expect(credentialKey('abc')).not.toBe(credentialKey('def'));
  });

  it('store -> read -> clear round-trips through localStorage', () => {
    const uid = 'user-42';
    localStorage.setItem(credentialKey(uid), 'CRED_B64URL');
    expect(readCredentialId(uid)).toBe('CRED_B64URL');
    expect(hasCredential(uid)).toBe(true);
    clearCredentialId(uid);
    expect(readCredentialId(uid)).toBeNull();
    expect(hasCredential(uid)).toBe(false);
  });

  it('is isolated per user', () => {
    localStorage.setItem(credentialKey('a'), 'AAA');
    expect(readCredentialId('a')).toBe('AAA');
    expect(readCredentialId('b')).toBeNull();
    clearCredentialId('a');
  });
});

describe('guarded WebAuthn calls in jsdom', () => {
  beforeEach(() => localStorage.clear());

  it('registerBiometric returns "unsupported" without WebAuthn', async () => {
    expect(await registerBiometric('u', 'u@example.com')).toBe('unsupported');
  });

  it('verifyBiometric returns "unsupported" without WebAuthn', async () => {
    expect(await verifyBiometric('u')).toBe('unsupported');
  });
});
