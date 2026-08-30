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
    /*
     * The flipped character is in the MIDDLE, not at the end.
     *
     * base64url encodes in four-character groups, and the final group can carry
     * unused trailing bits — so altering the last character sometimes decodes to
     * the identical bytes and the test passed or failed depending on the random
     * IV. A middle character always changes a whole byte.
     */
    const sealed = seal('a secret worth protecting');
    const parts = sealed.split('.');
    const body = parts[3];
    const at = Math.floor(body.length / 2);
    parts[3] = body.slice(0, at) + (body[at] === 'A' ? 'B' : 'A') + body.slice(at + 1);

    expect(parts[3]).not.toBe(body);
    expect(() => open(parts.join('.'))).toThrow();
  });

  it('rejects a tampered authentication tag', () => {
    const sealed = seal('a secret worth protecting');
    const parts = sealed.split('.');
    const tag = parts[2];
    const at = Math.floor(tag.length / 2);
    parts[2] = tag.slice(0, at) + (tag[at] === 'A' ? 'B' : 'A') + tag.slice(at + 1);

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
