import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The fault reporter, and mostly the limit on it.
 *
 * A broken page throws on every request. Without the limit, one fault on a page
 * getting a hundred visits an hour sends a hundred identical emails — which is
 * how these end up filtered into a folder nobody reads, at which point the
 * whole thing is worse than not having it.
 */

const sendMail = vi.fn().mockResolvedValue(true);
vi.mock('@/services/mail/mailer', () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }));
vi.mock('@/features/settings/queries', () => ({
  getGeneralSettings: async () => ({ contactEmail: 'rejoicegospelcommunications@gmail.com' }),
}));

/** The reporter and the limiter both hold module state, so each case gets its own. */
async function freshReporter() {
  vi.resetModules();
  const mod = await import('@/features/monitoring/report');
  return mod.reportFault;
}

describe('reportFault', () => {
  beforeEach(() => {
    sendMail.mockClear();
    // It stays silent outside production, so that has to be simulated here.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMTP_USER', 'sender@example.com');
    vi.stubEnv('SMTP_PASSWORD', 'app-password');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('emails when a fault is reported', async () => {
    const reportFault = await freshReporter();
    await reportFault({ scope: 'public-page', message: 'A page failed.' });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0] as { subject: string; to: string };
    expect(mail.subject).toContain('public-page');
    expect(mail.to).toBe('rejoicegospelcommunications@gmail.com');
  });

  it('sends once for the same fault however many times it happens', async () => {
    const reportFault = await freshReporter();
    for (let i = 0; i < 50; i += 1) {
      await reportFault({ scope: 'public-page', message: 'A page failed.' });
    }

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('still lets a different fault through immediately', async () => {
    const reportFault = await freshReporter();
    await reportFault({ scope: 'public-page', message: 'A page failed.' });
    await reportFault({ scope: 'contact-api', message: 'An enquiry could not be saved.' });

    // Throttling one fault must never mask a second, unrelated one.
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('says nothing outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const reportFault = await freshReporter();
    await reportFault({ scope: 'public-page', message: 'A page failed.' });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('never throws, even when sending the report itself fails', async () => {
    sendMail.mockRejectedValueOnce(new Error('SMTP refused the connection'));

    const reportFault = await freshReporter();

    /*
     * The one place in the codebase that must not use the normal error path: if
     * reporting a fault could raise a fault, a mail server being down would have
     * it calling itself for as long as the process lived.
     */
    await expect(
      reportFault({ scope: 'public-page', message: 'A page failed.' }),
    ).resolves.toBeUndefined();
  });

  it('includes what happened, without letting the stack run away', async () => {
    const reportFault = await freshReporter();
    const error = new Error('Connection terminated unexpectedly');

    await reportFault({
      scope: 'contact-api',
      message: 'An enquiry could not be saved.',
      error,
      context: { path: '/contact' },
    });

    const mail = sendMail.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain('Connection terminated unexpectedly');
    expect(mail.text).toContain('/contact');
    // Six frames at most, so the mail stays readable.
    expect(mail.text.split('\n').length).toBeLessThan(40);
  });
});
