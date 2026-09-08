import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The order the contact endpoint does its work in.
 *
 * The email is the only slow step — around 1.5 seconds even on a warm pooled
 * connection, because that is simply how long Gmail takes to accept a message —
 * so nothing that can go in front of it should sit behind it.
 *
 * The companion guarantee, that a mail failure never turns a stored enquiry into
 * an error for the visitor, is NOT asserted here. The route does not catch
 * around `notifyNewEnquiry`; it relies on that function swallowing its own
 * errors, so the test belongs where the behaviour is — `enquiryNotify.test.ts`.
 */

const order: string[] = [];

const create = vi.fn(async () => {
  order.push('enquiry.create');
});
const raise = vi.fn(async () => {
  order.push('raise');
});
const notifyNewEnquiry = vi.fn(async () => {
  order.push('notify');
});

vi.mock('@/lib/db/prisma', () => ({ prisma: { enquiry: { create } } }));
vi.mock('@/features/notifications/notify', () => ({ raise }));
vi.mock('@/features/enquiries/notify', () => ({ notifyNewEnquiry }));

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

  it('raises the admin notification before sending the email, not after', async () => {
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

  it('answers a honeypot submission without storing or sending anything', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const response = await POST(submit({ website: 'http://spam.example' }));

    expect(response.status).toBe(200);
    expect(order).toEqual([]);
  });
});
