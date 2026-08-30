import { appConfig } from '@/config/app.config';
import { prisma } from '@/lib/db/prisma';

/** Global site settings (section 24), stored as JSON so new keys need no migration. */

/*
 * Contact details. The key is still `general` so the existing row is read as it
 * stands — `getSetting` spreads `{...defaults, ...row.value}`, so the
 * `siteName`, `logo` and `favicon` keys still sitting in that JSON are simply
 * ignored now that they are not on the type. No migration, nothing to rewrite.
 */
export type GeneralSettings = {
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
};

/**
 * Videos chosen for the Channels page carousel, in the order they appear.
 *
 * Stored here rather than as a column on the video because ORDER is the point,
 * and `SiteSetting` is key/value JSON precisely so settings like this need no
 * migration.
 */
export type CarouselSettings = { videoIds: string[] };

/**
 * One social account: a label, where it points, and the uploaded icon.
 *
 * `svg` holds the icon's markup itself. It lives in this JSON store rather than
 * on disk because the runtime filesystem is read-only on a serverless host, so a
 * file written into `public/` would not survive a deploy — and an SVG is just
 * text, small enough to sit beside the setting it belongs to.
 *
 * The markup is sanitised on the way in and rendered through an `<img>`, never
 * inline. See `src/lib/utils/svg.ts` for why both matter.
 */
export type SocialLink = { id: string; label: string; url: string; svg: string };
export type SocialSettings = { links: SocialLink[] };

export const defaultCarouselSettings: CarouselSettings = { videoIds: [] };

/**
 * The accounts Rejoice already publishes, so the footer and contact page are not
 * blank before anyone opens the admin. Icons start empty — upload them in
 * Settings; a link without one still renders, using its label.
 */
export const defaultSocialSettings: SocialSettings = {
  links: [
    { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@RejoiceGospelCommunications', svg: '' },
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/rejoicegospelcommunications/', svg: '' },
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/rejoicegospelmusic', svg: '' },
  ],
};

export const defaultGeneralSettings: GeneralSettings = {
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
};

async function getSetting<T extends object>(key: string, defaults: T): Promise<T> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  if (!row) return defaults;
  return { ...defaults, ...(row.value as Partial<T>) };
}

export async function saveSetting(key: string, value: object): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

export const getGeneralSettings = () => getSetting('general', defaultGeneralSettings);
export const getCarouselSettings = () => getSetting('carousel', defaultCarouselSettings);

export async function getSocialSettings(): Promise<SocialSettings> {
  const stored = await getSetting('social', defaultSocialSettings);

  /*
   * `getSetting` spreads stored JSON over the defaults with a bare cast, so a
   * row holding the wrong shape would reach the page as garbage. `links` is the
   * one field here that is iterated, and a non-array would throw on `.map`
   * during render — fall back rather than take the site down.
   */
  return Array.isArray(stored.links) ? stored : defaultSocialSettings;
}
