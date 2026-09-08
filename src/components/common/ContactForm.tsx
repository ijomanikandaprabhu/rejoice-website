'use client';

import { Loader2, Send } from 'lucide-react';
import { useState } from 'react';

import { WhatsAppIcon } from '@/components/common/WhatsAppIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { contactForm } from '@/config/content.config';
import { whatsappEnquiryUrl, whatsappNumber } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

/**
 * The enquiry form.
 *
 * Posts to /api/contact, which re-validates with the same Zod schema and applies
 * the rate limit — client validation is convenience only, never the guard.
 *
 * Copy rule followed here: the button says what happens, and the confirmation
 * uses the same verb back. Errors say what to fix, in the site's voice, without
 * apologising.
 */

type Errors = Record<string, string>;

const fieldClass =
  'w-full rounded-input border border-white/10 bg-white/[0.03] px-4 py-3 text-body text-site-fg placeholder:text-site-muted/50 transition-colors duration-200 focus:border-site-accent focus:bg-white/[0.05] focus:outline-none';

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="t-label mb-2 block">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-site-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({
  /**
   * Preselects "I'm Interested In". The Services page links here with
   * `?service=<id>`, which `/contact` resolves to one of `contactForm.interests`
   * — so an enquiry arrives already tagged with the offering it came from.
   */
  defaultInterest,
  /**
   * The label's own number, from Settings, threaded down by `/contact`.
   *
   * Optional and unvalidated on the way in: `whatsappNumber` decides whether it
   * can be used, and the button is simply absent when it cannot.
   */
  whatsappPhone,
}: {
  defaultInterest?: string;
  whatsappPhone?: string;
} = {}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');
  const fields = contactForm.fields;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(event.currentTarget);
  }

  /*
   * The one submission path, so the WhatsApp button records the enquiry exactly
   * as the primary button does. WhatsApp is an ADDITIONAL route to the label,
   * not a replacement for the row in the admin and the email.
   */
  async function submit(form: HTMLFormElement) {
    setStatus('sending');
    setErrors({});
    setMessage('');

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrors(data.errors ?? {});
        setMessage(data.message ?? 'That did not send. Try again in a moment.');
        return;
      }

      form.reset();
      setStatus('sent');
      setMessage(data.message ?? 'Message sent. We will reply by email.');
    } catch {
      setStatus('error');
      setMessage('That did not send. Check your connection and try again.');
    }
  }

  /*
   * Whether the button can exist at all. A blank or local-format number in
   * Settings means no button rather than a link that 404s in front of someone.
   */
  const canWhatsapp = whatsappNumber(whatsappPhone) !== null;

  function handleWhatsapp(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;

    /*
     * The form is `noValidate`, which only suppresses validation on submit —
     * `reportValidity` still shows the browser's own required-field prompts. Far
     * better than opening WhatsApp with an empty message in it.
     */
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? '');

    // `website` is the honeypot and is deliberately not read.
    const url = whatsappEnquiryUrl(whatsappPhone, {
      name: read('name'),
      email: read('email'),
      phone: read('phone'),
      subject: read('subject'),
      message: read('message'),
    });
    if (!url) return;

    /*
     * OPENED FIRST, and synchronously. `window.open` is only allowed while the
     * click still counts as a user gesture; move it after the `await` below and
     * Safari and Firefox block it. This is also why it is a button calling
     * `window.open` rather than the anchor this codebase otherwise prefers for
     * third-party links — the fields are uncontrolled, so an `href` computed at
     * render would carry whatever the form held when it last rendered, which is
     * nothing.
     */
    window.open(url, '_blank', 'noopener,noreferrer');

    // And then the ordinary submission, so the enquiry is still recorded.
    void submit(form);
  }

  if (status === 'sent') {
    return (
      <div className="card-gloss px-6 py-14 text-center">
        <div className="relative z-20">
          <span className="mx-auto grid size-14 place-items-center rounded-pill bg-site-accent shadow-ember">
            <svg
              viewBox="0 0 24 24"
              className="size-6 stroke-white"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <p className="t-h3 mt-5 text-site-fg">{message}</p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="btn-ghost mt-4 text-sm"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {status === 'error' && message ? (
        <p
          role="alert"
          className="rounded-sm2 border border-site-accent/40 bg-site-accent/10 px-4 py-3 text-body text-site-fg"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={fields.name.label} name="name" error={errors.name}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder={fields.name.placeholder}
            className={fieldClass}
          />
        </Field>

        <Field label={fields.email.label} name="email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={fields.email.placeholder}
            className={fieldClass}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={fields.phone.label} name="phone" error={errors.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={fields.phone.placeholder}
            className={fieldClass}
          />
        </Field>

        {/*
         * "I'm Interested In" writes to the enquiry's EXISTING `subject`
         * column, so seven fixed options needed no migration and the admin
         * list shows them unchanged.
         *
         * shadcn's Select rather than a native one: it is the site's own
         * component, and Radix renders a hidden native select when `name` is
         * set, so the value still arrives in `FormData` with no client state
         * here. The default skin is the ADMIN palette (`border-input`,
         * `bg-popover`, `ring-ring`), so site tokens are restated on the
         * trigger and the list — the same treatment the channel dialog needed.
         */}
        <Field label={fields.interest.label} name="subject" error={errors.subject}>
          <Select name="subject" defaultValue={defaultInterest}>
            <SelectTrigger
              id="subject"
              className={cn(
                fieldClass,
                'h-auto justify-between text-left font-normal shadow-none',
                'data-[placeholder]:text-site-muted/50',
                'focus:ring-0 focus:ring-offset-0',
              )}
            >
              <SelectValue placeholder={fields.interest.placeholder} />
            </SelectTrigger>

            <SelectContent className="border-white/10 bg-site-surface text-site-fg">
              {contactForm.interests.map((interest) => (
                <SelectItem
                  key={interest}
                  value={interest}
                  className="text-body focus:bg-white/[0.06] focus:text-site-accent"
                >
                  {interest}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={fields.message.label} name="message" error={errors.message}>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          placeholder={fields.message.placeholder}
          className={cn(fieldClass, 'resize-y')}
        />
      </Field>

      {/* Honeypot — hidden from people, filled in by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {/* Wrapper rather than `mx-auto` on the buttons, so the form's `space-y-6`
          rhythm is untouched and the pills keep their intrinsic width. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="btn-primary disabled:opacity-60"
        >
          {/*
            The paper plane becomes a spinner while the message is in flight,
            rather than sitting still beside the word "Sending". `.btn` already
            supplies `inline-flex` and `gap-2`, so the glyph needs no layout of
            its own — the same arrangement as the "Watch on YouTube" button.
          */}
          {status === 'sending' ? (
            <Loader2 aria-hidden className="size-[1.15em] animate-spin" />
          ) : (
            <Send aria-hidden className="size-[1.15em]" />
          )}
          {status === 'sending' ? 'Sending' : contactForm.submitLabel}
        </button>

        {canWhatsapp ? (
          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={status === 'sending'}
            className="btn-secondary disabled:opacity-60"
          >
            <WhatsAppIcon />
            {contactForm.whatsappLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
