import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the contact endpoint does, and crucially what it does NOT wait for.
 *
 * The email is the only slow step — 3.7-3.8s measured on the live site, because
 * that is how long Gmail takes — so the visitor is answered before it runs. The
 * cases below pin the two halves of that being safe: everything the visitor
 * depends on happens before the response, and a mail failure never reaches them.
 */

const order: string[] = [];

const create = vi.fn(async () => {
  order.push('enquiry.create');
});
const raise = vi.fn(async () => {
  order.push('raise');
});
const notifyAndRecord = vi.fn(async () => {
  order.push('notify');
  return true;
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    enquiry: {
      create: async () => {
        await create();
        return { id: 'e1' };
      },
    },
  },
}));
vi.mock('@/features/notifications/notify', () => ({ raise }));
vi.mock('@/features/enquiries/notify', () => ({ notifyAndRecord }));

/**
 * A different IP per request. The rate limiter is a module-level `Map` capped at
 * five per fifteen minutes, so a shared address would make later cases here
 * assert against a 429 instead of the handler.
 */
let nextIp = 0;
function submit(body: Record<string, unknown> = {}) {
  nextIp += 1;
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${nextIp}`,
    },
    body: JSON.stringify({
      name: 'Blessy Catherine',
      email: 'blessy@example.com',
      message: 'We would like a quote for a worship video.',
      ...body,
    }),
  });
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    order.length = 0;
    vi.clearAllMocks();
  });

  it('stores the enquiry and rings the bell before it goes near the email', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const response = await POST(submit());

    expect(response.status).toBe(200);
    /*
     * `raise` is one local insert of a few milliseconds. It used to run after
     * the mail, which meant it waited on a network round trip to Google — and so
     * did the visitor.
     */
    expect(order).toEqual(['enquiry.create', 'raise', 'notify']);
  });

  it('still answers the visitor when the email cannot be sent', async () => {
    notifyAndRecord.mockResolvedValueOnce(false);

    const { POST } = await import('@/app/api/contact/route');
    const response = await POST(submit());

    /*
     * The enquiry is stored either way, so the visitor is told the truth. The
     * unsent mail is recorded as `notifiedAt: null` for the daily sweep, which
     * is what makes answering early safe rather than merely fast.
     */
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Message sent. We will reply by email.',
    });
  });

  it('does not fail the request when the email throws outright', async () => {
    notifyAndRecord.mockRejectedValueOnce(new Error('SMTP refused the connection'));

    const { POST } = await import('@/app/api/contact/route');

    // Without a local await this would surface as an unhandled rejection.
    const response = await POST(submit());
    expect(response.status).toBe(200);
  });

  it('answers a honeypot submission without storing or sending anything', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const response = await POST(submit({ website: 'http://spam.example' }));

    expect(response.status).toBe(200);
    expect(order).toEqual([]);
  });
});
