import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let seal: (s: string) => string;
let open: (s: string) => string;

beforeAll(async () => {
  process.env.AUTH_SECRET = 'test-secret-for-secret-box-round-trip';
  ({ seal, open } = await import('@/lib/utils/secretBox'));
});

/**
 * The refresh token is a long-lived credential to a channel's earnings, so the
 * two properties that matter are: it round trips exactly, and a tampered value
 * fails loudly rather than decrypting to something plausible.
 */
describe('secretBox', () => {
  it('round trips a value', () => {
    const secret = '1//0gTokenLooksLikeThis-_wIth.punctuation';
    expect(open(seal(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time', () => {
    // A fresh IV per call: identical tokens must not produce identical rows.
    expect(seal('same')).not.toBe(seal('same'));
  });

  it('rejects a tampered ciphertext rather than returning garbage', () => {
    const sealed = seal('original');
    const parts = sealed.split('.');
    // Flip the last character of the ciphertext.
    const last = parts[3];
    parts[3] = last.slice(0, -1) + (last.at(-1) === 'A' ? 'B' : 'A');

    expect(() => open(parts.join('.'))).toThrow();
  });

  it('rejects a value that is not in the expected format', () => {
    expect(() => open('not-sealed')).toThrow(/expected format/);
  });

  it('handles unicode', () => {
    const secret = 'கர்த்தரின் இதயத்துடிப்பு';
    expect(open(seal(secret))).toBe(secret);
  });
});
