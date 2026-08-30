'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { disconnect } from '@/services/youtube/analyticsService';
import {
  carouselSettingsSchema,
  fieldErrors,
  contactSettingsSchema,
} from '@/lib/validation';
import { getSocialSettings, saveSetting, type SocialLink } from './queries';
import { sanitizeSvg } from '@/lib/utils/svg';
import { slugify } from '@/lib/utils';

/** Global settings mutations (section 24). */

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

/**
 * Save the contact details.
 *
 * Named for what it does. It was `saveGeneralSettingsAction` and also carried the
 * site name, logo URL and favicon URL, from when Settings had a General card.
 * That card is gone — the site name comes from `app.config.ts` and the other two
 * were never read by anything — so this is now only the three contact fields.
 * The storage key stays `general`, which leaves the existing row readable as it
 * is.
 */
export async function saveContactSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = contactSettingsSchema.safeParse({
    contactEmail: formData.get('contactEmail') ?? '',
    contactPhone: formData.get('contactPhone') ?? '',
    contactAddress: formData.get('contactAddress') ?? '',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await saveSetting('general', parsed.data);

  // These show on the contact page and in the footer of every page.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');

  return { ok: true, message: 'Contact details saved.' };
}

/**
 * Save the ordered carousel picks.
 *
 * The ids arrive as one JSON string in a hidden field, because the picker is a
 * client component managing ten slots — sending ten named inputs would make the
 * empty-slot case fiddly and the ORDER implicit. Parsed defensively: bad JSON
 * is treated as an empty selection rather than throwing.
 */
export async function saveCarouselSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let ids: unknown = [];
  try {
    ids = JSON.parse(String(formData.get('videoIds') ?? '[]'));
  } catch {
    ids = [];
  }

  const parsed = carouselSettingsSchema.safeParse({ videoIds: ids });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await saveSetting('carousel', parsed.data);

  revalidatePath('/creations');
  revalidatePath('/admin/settings');

  const n = parsed.data.videoIds.length;
  return { ok: true, message: n === 0 ? 'Carousel cleared.' : `Carousel saved — ${n} video${n === 1 ? '' : 's'}.` };
}

/**
 * Save the social links, including any newly uploaded icons.
 *
 * The rows arrive as parallel `social.<n>.*` fields plus an optional file per
 * row. An icon is only replaced when a file was actually chosen — otherwise the
 * stored one is carried forward, so editing a URL does not silently wipe the
 * icon beside it.
 */
export async function saveSocialLinksAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const existing = await getSocialSettings();
  const byId = new Map(existing.links.map((l) => [l.id, l]));

  const ids = formData.getAll('social.id').map(String);
  const links: SocialLink[] = [];
  const errors: Record<string, string> = {};

  for (const [index, rawId] of ids.entries()) {
    const label = String(formData.get(`social.${index}.label`) ?? '').trim();
    const url = String(formData.get(`social.${index}.url`) ?? '').trim();

    // A row with no label is a row the administrator cleared out. Drop it
    // rather than storing a nameless entry.
    if (!label) continue;

    if (label.length > 40) {
      errors[`social.${index}.label`] = 'Keep the name under 40 characters.';
      continue;
    }

    if (url && !/^https?:\/\//i.test(url)) {
      errors[`social.${index}.url`] = 'Enter a full address starting with https://';
      continue;
    }

    const id = rawId || slugify(label) || String(index);
    let svg = byId.get(id)?.svg ?? '';

    const file = formData.get(`social.${index}.icon`);
    if (file instanceof File && file.size > 0) {
      const result = sanitizeSvg(await file.text());
      if (!result.ok) {
        errors[`social.${index}.icon`] = result.error;
        continue;
      }
      svg = result.svg;
    }

    links.push({ id, label, url, svg });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await saveSetting('social', { links });

  // Socials appear in the footer of every page, on the contact page and in the
  // homepage's structured data, so the whole site is refreshed.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');

  return { ok: true, message: 'Social links saved.' };
}

/**
 * Disconnect the Google account used for YouTube analytics.
 *
 * Removes the stored credential and the cached report from the Rejoice
 * database. It does NOT revoke the grant on Google's side — the owner does that
 * at myaccount.google.com/permissions, and saying so is more honest than
 * implying this button reached into their Google account (Rule 5).
 */
export async function disconnectYouTubeAnalyticsAction(): Promise<void> {
  await requireAdmin();
  await disconnect();
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
}
