/**
 * The contact form's WhatsApp route.
 *
 * Both functions are pure and free of `server-only` and of `@/lib/db/prisma`,
 * because the caller is a client component. `features/enquiries/notify.ts` — the
 * obvious place for this — cannot be imported from the browser at all; its first
 * line is `import 'server-only'`.
 */

export type EnquiryFields = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
};

/**
 * The label's own number, reduced to the bare digits `wa.me` takes.
 *
 * Returns `null` unless the stored number is in international form, and that
 * refusal is the point of the function rather than an edge case. `contactPhone`
 * in Settings is free text — validated only as `z.string().trim().max(60)` — so
 * it can arrive as `+91 91766 00765`, `098765 43210` or `(0422) 123-4567`. Only
 * the first carries a country code, and there is no honest way to guess one for
 * the others: a wrong guess builds a link to a stranger, and a missing code
 * makes `wa.me` 404 silently in front of a visitor.
 *
 * So a number we cannot be sure of means no button. The Phone field in admin
 * Settings says as much, because otherwise the button would simply vanish with
 * no explanation.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  /*
   * A `+` ahead of the first digit is the only evidence we have that a country
   * code is present. Brackets and spaces may precede it — `(+91) 91766 00765`
   * is a perfectly ordinary way to write one — so it is "before any digit"
   * rather than "first character".
   */
  if (!/^[\s()]*\+/.test(phone)) return null;

  const digits = phone.replace(/\D/g, '');

  /*
   * Shortest real international number is seven digits (Niue, Tokelau); the
   * longest the E.164 standard allows is fifteen. Anything outside that is a
   * typo, and a link built from it would fail in front of someone.
   */
  if (digits.length < 7 || digits.length > 15) return null;

  return digits;
}

/**
 * The message itself, written as the visitor rather than as the label.
 *
 * Deliberately NOT sharing a builder with `buildEnquiryEmail`. That one is the
 * label talking to itself — "New enquiry from …", with a link into the admin —
 * which would be nonsense arriving in a personal WhatsApp inbox apparently sent
 * by the enquirer. Same facts, different speaker.
 *
 * Empty fields are dropped rather than shown blank, the way the email already
 * omits an empty `Phone:` line. The honeypot never appears here because it is
 * not part of this type.
 */
export function buildEnquiryWhatsappText(enquiry: EnquiryFields): string {
  const { name, email, phone, subject, message } = enquiry;

  const parts = [`Hello Rejoice, I'm ${name.trim()}.`];

  if (subject?.trim()) parts.push(`I'm interested in ${subject.trim()}.`);

  parts.push(message.trim());

  /*
   * The contact details last, in one sentence. WhatsApp already carries the
   * sender's number, so their own `phone` is only worth repeating when it is a
   * different one they would rather be reached on.
   */
  const reach = [email.trim(), phone?.trim()].filter(Boolean).join(' or ');
  if (reach) parts.push(`You can reach me at ${reach}.`);

  return parts.join('\n\n');
}

/** The full link to open. `null` when there is no usable number. */
export function whatsappEnquiryUrl(
  phone: string | null | undefined,
  enquiry: EnquiryFields,
): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;

  return `https://wa.me/${number}?text=${encodeURIComponent(buildEnquiryWhatsappText(enquiry))}`;
}
