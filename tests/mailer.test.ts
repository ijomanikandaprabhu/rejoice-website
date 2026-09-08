import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The transport's options, which are the whole of the fix for a contact form
 * that took up to 9.5 seconds to answer.
 *
 * There was no coverage of this file at all before, and the comment above the
 * transport claimed a connection pool that the code did not configure. These
 * tests exist so the claim and the code cannot drift apart again — the timeouts
 * in particular are easy to read as noise and delete.
 */

const sendMailSpy = vi.fn().mockResolvedValue({ messageId: 'test' });
/*
 * Typed with an explicit parameter so `mock.calls[0][0]` is reachable — inferred
 * from a zero-argument factory, TypeScript reads the call tuple as empty.
 */
const createTransport = vi.fn((_options: Record<string, unknown>) => ({
  sendMail: sendMailSpy,
}));

vi.mock('nodemailer', () => ({
  default: { createTransport },
  createTransport,
}));

const MAIL = {
  to: 'someone@example.com',
  subject: 'Subject',
  text: 'Body',
};

/**
 * `transporter` is module-level state, so every case needs a fresh copy of the
 * module or the singleton from the previous one answers instead.
 */
async function freshSendMail() {
  vi.resetModules();
  const mod = await import('@/services/mail/mailer');
  return mod.sendMail;
}

describe('the SMTP transport', () => {
  beforeEach(() => {
    createTransport.mockClear();
    sendMailSpy.mockClear();
    vi.stubEnv('SMTP_USER', 'sender@example.com');
    vi.stubEnv('SMTP_PASSWORD', 'app-password');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pools its connections, so a message does not pay for a new handshake', async () => {
    const sendMail = await freshSendMail();
    await sendMail(MAIL);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
    });
  });

  it('gives every stage of a send a deadline', async () => {
    const sendMail = await freshSendMail();
    await sendMail(MAIL);

    /*
     * `greetingTimeout` is the one that matters: a socket the server accepts
     * and then says nothing on has no other bound. Without these three, a slow
     * Gmail could hold the visitor's request open indefinitely.
     */
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  });

  it('builds the transport once and reuses it', async () => {
    const sendMail = await freshSendMail();
    await sendMail(MAIL);
    await sendMail(MAIL);

    expect(sendMailSpy).toHaveBeenCalledTimes(2);
    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  it('does nothing, rather than throwing, when SMTP is not configured', async () => {
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');

    const sendMail = await freshSendMail();

    await expect(sendMail(MAIL)).resolves.toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
