/**
 * Outgoing mail configuration.
 *
 * Used for the notification sent when a contact enquiry arrives. Credentials are
 * read on the server only and never reach the browser (section 37).
 *
 * Every field is optional: with nothing set, `isMailConfigured()` is false and
 * the notification is skipped. A site with no SMTP credentials still accepts
 * enquiries exactly as before — mail is an addition, never a requirement.
 */

export const mailConfig = {
  /** Gmail's SMTP endpoint; overridable for any other provider. */
  defaultHost: 'smtp.gmail.com',
  /** 465 is implicit TLS, which is what Gmail expects. */
  defaultPort: 465,
} as const;

export type SmtpCredentials = {
  host: string;
  port: number;
  /** True for port 465. Port 587 upgrades with STARTTLS instead. */
  secure: boolean;
  user: string;
  password: string;
};

function trimmed(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getSmtpCredentials(): SmtpCredentials | null {
  const user = trimmed(process.env.SMTP_USER);
  const password = trimmed(process.env.SMTP_PASSWORD);

  // Both are required. A half-configured install is treated as unconfigured
  // rather than failing at send time.
  if (!user || !password) return null;

  const host = trimmed(process.env.SMTP_HOST) || mailConfig.defaultHost;
  const port = Number(trimmed(process.env.SMTP_PORT)) || mailConfig.defaultPort;

  return { host, port, secure: port === 465, user, password };
}

export function isMailConfigured(): boolean {
  return getSmtpCredentials() !== null;
}
