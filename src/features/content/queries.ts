import {
  bentoCards,
  channelsHoverLine,
  contactPage,
  homeContent,
  platforms,
  services,
  type BentoCard,
  type ContactCopy,
  type HomeContent,
  type Platform,
  type Service,
} from '@/config/content.config';
import { getGeneralSettings, getSocialSettings } from '@/features/settings/queries';

/**
 * Website content.
 *
 * Copy comes from `config/content.config.ts`. What lives in the database is the
 * part the administrator changes without a deploy: email, phone and address
 * under Settings → General, and the social accounts and their icons under
 * Settings → Social links.
 *
 * `getContactDetails` is the single place those two sources are combined, so the
 * contact page and the footer cannot drift apart.
 */

export { homeContent, services, platforms, bentoCards, channelsHoverLine };
export type { HomeContent, ContactCopy, Service, Platform, BentoCard };

/**
 * `icon` is the uploaded SVG's markup, empty when none has been uploaded yet.
 * Optional so callers that only need the address — the homepage's structured
 * data, for one — are unaffected.
 */
/**
 * `id` is carried through, not just the label: `SocialButtons` picks each
 * button's brand tint from it (`youtube` -> red, `facebook` -> blue, …), and
 * anything unrecognised falls back to neutral. Dropping it here rendered the
 * whole row in identical grey — icons correct, colours silently gone.
 */
export type SocialLink = { id: string; label: string; href: string; icon?: string };

export type ContactDetails = ContactCopy & {
  email: string;
  phone: string;
  address: string;
  socials: SocialLink[];
};

export async function getContactDetails(): Promise<ContactDetails> {
  const [settings, social] = await Promise.all([getGeneralSettings(), getSocialSettings()]);

  return {
    // Heading and intro come from the Contact page copy; the three details
    // below are administrator-editable settings.
    heading: contactPage.hero.heading,
    text: contactPage.hero.paragraphs[0],
    email: settings.contactEmail,
    phone: settings.contactPhone,
    address: settings.contactAddress,
    /*
     * From the database, edited in Settings → Social links.
     *
     * Every social surface on the site — the footer, the contact page, the video
     * page buttons and the homepage's `sameAs` structured data — reads this one
     * function, so they cannot disagree about which accounts exist.
     *
     * Empty URLs are dropped here so no caller has to filter them again.
     */
    socials: social.links
      .filter((link) => link.url.length > 0)
      .map((link) => ({ id: link.id, label: link.label, href: link.url, icon: link.svg })),
  };
}

/** Services are ordered in the config file; visibility is just presence. */
export function getVisibleServices(): Service[] {
  return services;
}
