/**
 * biometric.ts — WebAuthn platform-authenticator wrapper for the app-open lock.
 *
 * On iPhone the platform authenticator is Face ID; on a Mac it's Touch ID; on
 * Windows it's Hello. This module is the ONLY place that touches
 * navigator.credentials. Everything degrades gracefully: on a browser/context
 * without WebAuthn, or with no registered credential, every call returns a clear
 * reason instead of throwing. Modeled on services/push.ts.
 *
 * The credentialId is stored per-user in localStorage — it is a public handle,
 * not a secret. v1 does NOT verify the assertion signature server-side: this is a
 * privacy/convenience lock on top of an already-valid Supabase session, not a
 * cryptographic re-authentication. See BIOMETRIC_LOCK_SPEC_2026-07-22.md.
 */

export type BioReason =
  | 'ok'
  | 'unsupported'    // browser lacks WebAuthn / PublicKeyCredential
  | 'no-credential'  // nothing registered for this user on this device
  | 'cancelled'      // user dismissed the Face ID / Touch ID prompt
  | 'error';         // anything else

const CRED_KEY_PREFIX = 'timo_biolock_cred__';

/** localStorage key holding the base64url credentialId for a user. Pure — testable. */
export function credentialKey(userId: string): string {
  return `${CRED_KEY_PREFIX}${userId}`;
}

/** True if this browser can do platform WebAuthn at all. */
export function biometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function' &&
    typeof (window as Window & { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined'
  );
}

export function readCredentialId(userId: string): string | null {
  try {
    return localStorage.getItem(credentialKey(userId));
  } catch {
    return null;
  }
}

function writeCredentialId(userId: string, idB64Url: string): void {
  try {
    localStorage.setItem(credentialKey(userId), idB64Url);
  } catch {
    /* ignore */
  }
}

/** Remove this user's stored credential handle (called when the lock is disabled). */
export function clearCredentialId(userId: string): void {
  try {
    localStorage.removeItem(credentialKey(userId));
  } catch {
    /* ignore */
  }
}

/** Has this user registered a lock credential on this device? */
export function hasCredential(userId: string): boolean {
  return readCredentialId(userId) !== null;
}

// ── base64url <-> ArrayBuffer (URL-safe, unpadded) ───────────────────────────
function bufToB64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBuf(b64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  // Explicit ArrayBuffer (not ArrayBufferLike) so it satisfies BufferSource under
  // TS strict — same pattern as services/push.ts urlBase64ToUint8Array.
  const c = new Uint8Array(new ArrayBuffer(32));
  (globalThis.crypto ?? window.crypto).getRandomValues(c);
  return c;
}

function isCancel(err: unknown): boolean {
  return err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

/**
 * Register a platform credential for this user and persist its id.
 * `label` is a human-readable name for the OS prompt (e.g. the user's email).
 * rp.id is intentionally omitted so the browser defaults it to the current
 * effective domain — stable on the custom domain, and works on localhost too.
 */
export async function registerBiometric(userId: string, label: string): Promise<BioReason> {
  if (!biometricSupported()) return 'unsupported';
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'Training App' },
        user: {
          id: new TextEncoder().encode(userId),
          name: label,
          displayName: label,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          // Device-bound, NON-discoverable credential (not an iCloud passkey).
          // With a matching allowCredentials on verify, iOS goes straight to
          // Face ID instead of showing the "pick a passkey" account sheet —
          // the native-style re-auth prompt. (LocalAuthentication/LAContext,
          // the fully sheet-less native path, is not available to a PWA.)
          residentKey: 'discouraged',
          requireResidentKey: false,
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return 'error';
    writeCredentialId(userId, bufToB64Url(cred.rawId));
    return 'ok';
  } catch (err) {
    return isCancel(err) ? 'cancelled' : 'error';
  }
}

/**
 * Verify the user via their registered platform credential (Face ID / Touch ID).
 * Returns 'no-credential' if nothing is registered on this device.
 */
export async function verifyBiometric(userId: string): Promise<BioReason> {
  if (!biometricSupported()) return 'unsupported';
  const idB64 = readCredentialId(userId);
  if (!idB64) return 'no-credential';
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ type: 'public-key', id: b64UrlToBuf(idB64) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return assertion ? 'ok' : 'error';
  } catch (err) {
    return isCancel(err) ? 'cancelled' : 'error';
  }
}
