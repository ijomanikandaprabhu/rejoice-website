import 'server-only';

import { appConfig } from '@/config/app.config';
import { isMailConfigured } from '@/config/mail.config';
import { getGeneralSettings } from '@/features/settings/queries';
import { rateLimit } from '@/lib/utils/rateLimit';
import { sendMail } from '@/services/mail/mailer';
import { renderMail } from '@/services/mail/template';

/**
 * Emails Rejoice when the site breaks.
 *
 * There was no monitoring at all: a page could start failing overnight and the
 * first anyone knew was somebody mentioning it. This is the smallest thing that
 * fixes that — no account to open, no monthly fee, no dashboard to learn. It
 * reuses the mail setup the contact form already uses and the address already in
 * Settings.
 *
 * WHAT IT DOES NOT DO, and this is worth being straight about rather than
 * discovering later: it sees faults the SERVER knows about. Something that
 * breaks only inside one visitor's browser reaches this only if a React error
 * boundary reports it, which is why `/api/report` exists alongside. It is not a
 * substitute for a real monitoring service; it is the difference between finding
 * out today and finding out never.
 */

export type Fault = {
  /** Where it happened: 'public-page', 'admin', 'contact-api', 'youtube-sync'. */
  scope: string;
  /** One line, written for a person: "The songs page could not be loaded". */
  message: string;
  /** The thrown value, if there was one. */
  error?: unknown;
  /** Anything that helps place it — the path, Next's error digest. */
  context?: Record<string, string | undefined>;
};

/**
 * One email per fault signature per hour.
 *
 * A broken page throws on every request, and a page getting a hundred visits an
 * hour would otherwise send a hundred identical emails — which is how someone
 * ends up filtering these into a folder they never read, at which point the
 * whole thing is worse than useless. The signature is scope plus message, so a
 * DIFFERENT fault still gets through immediately.
 *
 * The counter is per server instance, as `rateLimit` is a module-level Map, so
 * a busy site running several instances may send a few copies rather than one.
 * That is a flood guard doing its job approximately, which is all it needs to do.
 */
const ONE_PER = 60 * 60 * 1000;

export async function reportFault(fault: Fault): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'production') return;
    if (!isMailConfigured()) return;

    const signature = `fault:${fault.scope}:${fault.message}`;
    if (!rateLimit(signature, 1, ONE_PER).allowed) return;

    const { contactEmail } = await getGeneralSettings();
    if (!contactEmail) return;

    await sendMail(buildFaultEmail(fault, contactEmail));
  } catch (error) {
    /*
     * `console.error`, deliberately, and not `log.error`.
     *
     * If reporting a fault could itself report a fault, a mail server that is
     * down would have this calling itself for as long as the process lived. The
     * reporter is the one place in the codebase that must not use the normal
     * error path.
     */
    console.error('[fault-report] could not send the fault email', error);
  }
}

function buildFaultEmail(fault: Fault, to: string) {
  const detail = describe(fault.error);
  const context = Object.entries(fault.context ?? {}).filter(([, v]) => v);

  const { html, text } = renderMail({
    heading: 'Site error',
    intro: fault.message,
    rows: [
      { label: 'Where', value: fault.scope },
      ...context.map(([label, value]) => ({ label, value: String(value) })),
      { label: 'When', value: new Date().toISOString() },
    ],
    message: `${detail}\n\nOnly one email is sent per hour for the same fault, so this may have happened more than once.`,
    action: { label: 'Open the admin', href: `${appConfig.url}/admin` },
  });

  return { to, subject: `Rejoice site error: ${fault.scope}`, text, html };
}

/** Errors arrive as anything at all, so this never assumes a shape. */
function describe(error: unknown): string {
  if (!error) return 'No further detail was attached.';

  if (error instanceof Error) {
    /*
     * Six frames, not the whole stack. The top of a stack is where the fault is;
     * the rest is framework internals, and a wall of them in an email is what
     * stops it being read.
     */
    const stack = error.stack ? `\n\n${error.stack.split('\n').slice(0, 6).join('\n')}` : '';
    return `${error.name}: ${error.message}${stack}`;
  }

  try {
    return String(error).slice(0, 800);
  } catch {
    return 'The error could not be described.';
  }
}
