import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

import { getSmtpCredentials } from '@/config/mail.config';

/**
 * Outgoing mail, over SMTP.
 *
 * A thin wrapper so callers never touch nodemailer or credentials directly, and
 * so "not configured" is a normal, expected state rather than an error — see
 * `isMailConfigured`.
 */

export type OutgoingMail = {
  to: string;
  subject: string;
  /** Plain text only. Nothing here builds HTML from user-supplied content. */
  text: string;
  /** Where a reply should go, when that is not the sending account. */
  replyTo?: string;
};

/**
 * Reused across invocations.
 *
 * Building a transport opens a connection pool; on a warm serverless instance
 * creating one per email would be wasteful, and Gmail rate-limits connections
 * more aggressively than messages.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const credentials = getSmtpCredentials();
  if (!credentials) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: { user: credentials.user, pass: credentials.password },
    });
  }

  return transporter;
}

/**
 * Sends a message. Returns false when mail is not configured.
 *
 * Throws only on a genuine send failure, so callers can distinguish "there are
 * no credentials" from "the credentials are wrong".
 */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const credentials = getSmtpCredentials();

  await transport.sendMail({
    // Gmail rewrites `from` to the authenticated account anyway, so it is set
    // to the same address rather than pretending otherwise.
    from: credentials?.user,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    replyTo: mail.replyTo,
  });

  return true;
}
