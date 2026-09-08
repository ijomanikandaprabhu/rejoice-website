import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';

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
  /**
   * The plain-text part, and STILL REQUIRED even when `html` is given.
   *
   * It is what a text-only client renders, and a message with no text part
   * scores worse with spam filters. `renderMail` in ./template builds both from
   * one description so they cannot drift.
   */
  text: string;
  /**
   * The HTML part. Build it with `renderMail`, never by hand: this used to be
   * plain text only precisely because the body is composed almost entirely of
   * attacker-supplied strings, and that template is where the escaping lives.
   */
  html?: string;
  /** Where a reply should go, when that is not the sending account. */
  replyTo?: string;
};

/**
 * Reused across invocations.
 *
 * The comment that stood here claimed building a transport opens a connection
 * pool. It did not: no `pool` option was set, so every message paid a fresh TLS
 * connection and a full Gmail AUTH handshake, and with no timeouts anywhere a
 * slow greeting had nothing to stop it. Measured on the contact form: 3.1s
 * typical and 9.5s at the tail, all of it spent with a visitor watching a
 * "Sending" button.
 *
 * It is true now — measured with the pool's connection counter, three sends
 * share one connection: 3.3s for the first, then 1.55s each. What is left is
 * Gmail accepting the message on an already-open socket, not a handshake, and
 * it is irreducible for as long as the send is awaited.
 *
 * Each option below is load bearing:
 *
 *   - `greetingTimeout` is the important one. A socket Gmail accepts and then
 *     says nothing on is exactly the unbounded case; nothing else caps it.
 *   - `maxConnections` stays low because Gmail rate-limits CONNECTIONS harder
 *     than messages, and this sends one mail per enquiry. Headroom, not
 *     throughput.
 *
 * On serverless the pool has an obvious hazard: it holds open sockets on this
 * module-level singleton, and freezing the instance severs them without the
 * process being told, so a thawed pool can hand back a dead connection. That is
 * survivable rather than fatal — nodemailer's pool re-queues a message whose
 * connection closes mid-send and retries it on a fresh one
 * (`nodemailer/lib/smtp-pool/index.js`, the `close` handler) — and the timeouts
 * bound how long the discovery takes. The pool earns its keep most where the
 * process is long-lived: local development and any self-hosted deployment.
 *
 * Deliberately NOT here: `verify()`. It is a round trip per send, which is the
 * very cost being removed.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const credentials = getSmtpCredentials();
  if (!credentials) return null;

  if (!transporter) {
    /*
     * Typed explicitly. With `pool: true` in a bare object literal, TypeScript
     * cannot pick between `createTransport`'s overloads and reports `host` as
     * an unknown property; naming the pooled options type settles it.
     */
    const options: SMTPPool.Options = {
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: { user: credentials.user, pass: credentials.password },
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      /* Generous: a long HTML body is legitimately slower than a handshake. */
      socketTimeout: 10_000,
    };

    transporter = nodemailer.createTransport(options);
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
    html: mail.html,
    replyTo: mail.replyTo,
  });

  return true;
}
