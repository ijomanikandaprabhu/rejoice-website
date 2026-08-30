import { z } from 'zod';

/** All request/form validation lives here so rules are defined once (section 3.2). */

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Enter a valid email address').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(5000),
  /**
   * Honeypot: bots fill hidden fields, humans do not.
   *
   * Deliberately NOT `.max(0)`. That rejected a filled honeypot at validation,
   * so the bot got a 400 whose field errors named `website` — telling it exactly
   * which field to leave blank next time, and making the route's "answer as if
   * it worked" branch unreachable. Accepting any value lets that branch run.
   */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const addChannelSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Enter a YouTube channel URL')
    .refine((v) => v.includes('youtube.com') || v.startsWith('UC') || v.startsWith('@'), {
      message: 'Enter a YouTube channel URL, @handle or channel ID',
    }),
  defaultVideoVisibility: z.enum(['AUTO_SHOW', 'REVIEW_FIRST']).default('REVIEW_FIRST'),
});

export const updateChannelSchema = z.object({
  id: z.string().min(1),
  defaultVideoVisibility: z.enum(['AUTO_SHOW', 'REVIEW_FIRST']),
  isActive: z.coerce.boolean(),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

/**
 * Editable website display fields (section 17).
 * Note there is deliberately no `youtubeVideoId` — it must never be edited (Rule 8).
 */
export const updateVideoSchema = z.object({
  id: z.string().min(1),
  displayTitle: optionalText(200),
  displayDescription: optionalText(5000),
  displayThumbnail: optionalText(500),
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
  isVisible: z.coerce.boolean(),
  showChannelName: z.coerce.boolean(),
  isAiDisclosed: z.coerce.boolean(),
});

/*
 * Contact details only.
 *
 * This also carried `siteName`, `logo` and `favicon` while the Settings screen
 * had a General card. That card is gone — the site name lives in
 * `app.config.ts`, and the logo and favicon fields were never read by anything.
 * The fields had to come out of the SCHEMA at the same time as the markup: the
 * General and Contact cards share one form and one action, so a required
 * `siteName` with no input to supply it would have failed validation on every
 * attempt to save a phone number.
 */
export const contactSettingsSchema = z.object({
  // Rendered as a `mailto:` link on the contact page and in the footer, so a
  // malformed address ships a broken link. Empty is still allowed — an empty
  // field hides the row, which is the documented way to leave it out.
  contactEmail: z.string().trim().max(200).email('Enter a valid email address').or(z.literal('')),
  contactPhone: z.string().trim().max(60),
  contactAddress: z.string().trim().max(400),
});

/**
 * The Channels carousel picks. Ten at most, and the cap is enforced here rather
 * than trusted from the form — the value arrives as a hidden field.
 */
export const carouselSettingsSchema = z.object({
  videoIds: z.array(z.string().trim().min(1)).max(10),
});

export const adminEmailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const adminPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(200)
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Flatten a ZodError into a simple field -> message map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
