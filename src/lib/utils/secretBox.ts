import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption for secrets held in the database.
 *
 * The only current caller is the YouTube OAuth refresh token — a long-lived
 * credential to someone's YouTube earnings. A database dump, a stray backup, or
 * a `SELECT *` in a log must not be enough to read it.
 *
 * AES-256-GCM rather than plain AES: GCM authenticates the ciphertext, so a
 * tampered row fails to decrypt instead of silently yielding garbage that the
 * caller would then send to Google.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the size GCM is specified for.
const VERSION = 'v1';

export class SecretKeyMissingError extends Error {
  constructor() {
    super(
      'AUTH_SECRET is not set. It is required to encrypt stored credentials — add it to your environment.',
    );
    this.name = 'SecretKeyMissingError';
  }
}

/**
 * Derive the 32-byte key from the app secret.
 *
 * `AUTH_SECRET` is reused rather than adding another variable to configure and
 * lose: it already exists for NextAuth, is already required in production, and
 * is already the thing whose leak compromises the deployment. SHA-256 is used
 * only to reach the fixed key LENGTH from a high-entropy secret — this is not
 * password hashing, and the input is not a password.
 */
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length === 0) throw new SecretKeyMissingError();
  return createHash('sha256').update(secret).digest();
}

export function isSecretBoxConfigured(): boolean {
  const secret = process.env.AUTH_SECRET;
  return Boolean(secret && secret.trim().length > 0);
}

/**
 * Encrypt a string. The output is self-describing —
 * `v1.<iv>.<authTag>.<ciphertext>`, all base64url — so the format can change
 * later without guessing how existing rows were written.
 */
export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
    '.',
  );
}

/**
 * Decrypt a string produced by `seal`.
 *
 * Throws on a malformed or tampered value rather than returning null: a caller
 * that cannot read the credential must stop, not carry on with an empty one and
 * report a confusing authentication failure from Google instead.
 */
export function open(sealed: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored secret is not in the expected format.');
  }

  const [, iv, tag, ciphertext] = parts;

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
