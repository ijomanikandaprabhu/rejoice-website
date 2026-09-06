import type { Metadata } from 'next';

import { appConfig } from '@/config/app.config';
import { seoConfig } from '@/config/seo.config';

/**
 * One metadata builder used by every page (section 32).
 *
 * Keeping it here means canonical URLs, Open Graph and Twitter tags are
 * consistent across the site and only have to be corrected in one place.
 */

export type PageSeo = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'video.other';
  publishedTime?: Date | string;
  noIndex?: boolean;
};

export function absoluteUrl(path = '/'): string {
  return new URL(path, appConfig.url).toString();
}

/**
 * The true pixel size of a social card image.
 *
 * `og:image:width` / `height` were hardcoded to 1200×630 for every page, but a
 * video page's image is a YouTube thumbnail and none of them are that size.
 * Facebook and X lay the card out from the declared numbers before the image
 * loads, so misreporting them produces the wrong crop.
 *
 * Measured over the 1,662 public videos: 1,486 store `maxresdefault`
 * (1280×720), 167 `sddefault` (640×480) and 9 `hqdefault` (480×360). The last
 * two are 4:3 — YouTube pads them — and they stay that way here rather than
 * being rewritten to a `maxresdefault` URL that YouTube never generated and
 * would serve as a 404.
 */
export function imageDimensions(url: string): { width: number; height: number } {
  if (url.includes('maxresdefault')) return { width: 1280, height: 720 };
  if (url.includes('sddefault')) return { width: 640, height: 480 };
  if (url.includes('hqdefault')) return { width: 480, height: 360 };
  if (url.includes('mqdefault')) return { width: 320, height: 180 };
  // The site's own card, and anything else we ship, is authored at 1.91:1.
  return { width: 1200, height: 630 };
}

export function buildMetadata({
  title,
  description = seoConfig.defaultDescription,
  path = '/',
  image = seoConfig.defaultOgImage,
  type = 'website',
  publishedTime,
  noIndex = false,
}: PageSeo = {}): Metadata {
  const fullTitle = title ? seoConfig.titleTemplate.replace('%s', title) : seoConfig.defaultTitle;
  const url = absoluteUrl(path);
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);
  const { width, height } = imageDimensions(imageUrl);

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    /*
     * `noindex, follow` — never `nofollow`.
     *
     * Excluded pages are still crawl paths. A `?q=` listing is kept out of the
     * index because it is thin and effectively infinite, but the song and video
     * links on it are the same links as everywhere else, and telling Google to
     * ignore them throws away crawling of the catalogue for no benefit.
     */
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: appConfig.name,
      locale: seoConfig.locale,
      type: type === 'video.other' ? 'video.other' : type,
      images: [{ url: imageUrl, width, height, alt: fullTitle }],
      ...(publishedTime
        ? { publishedTime: new Date(publishedTime).toISOString() }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      // The object form, so the card carries the same alt text the Open Graph
      // image does. A share card is often the only thing a screen reader user
      // is given of a link.
      images: [{ url: imageUrl, alt: fullTitle }],
    },
  };
}

/** VideoObject structured data for a video detail page (section 32). */
export function videoJsonLd(video: {
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: Date;
  youtubeVideoId: string;
  durationSeconds: number | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description.slice(0, 500),
    thumbnailUrl: [video.thumbnail],
    uploadDate: video.publishedAt.toISOString(),
    embedUrl: `https://www.youtube.com/embed/${video.youtubeVideoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
    ...(video.durationSeconds ? { duration: `PT${video.durationSeconds}S` } : {}),
    publisher: {
      '@type': 'Organization',
      name: appConfig.name,
      url: appConfig.url,
    },
  };
}

export function organizationJsonLd(social: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appConfig.name,
    description: appConfig.description,
    url: appConfig.url,
    ...(social.length > 0 ? { sameAs: social } : {}),
  };
}

/**
 * Metadata for a listing page that paginates and searches (section 32).
 *
 * ## Why this exists
 *
 * `/songs/all`, `/shorts/all` and every channel page carry a `?page=` and a
 * `?q=`. All three used to export a plain `metadata` object, which cannot see
 * `searchParams`, so every page of every listing declared the same canonical:
 * page one. Google was told that page 2 of 36 was a duplicate of page 1 — and
 * the videos that only appear on page 2 have no other claim to being indexed.
 *
 * So a paginated page now points at itself. Page one keeps the bare path,
 * because `?page=1` and the path are the same page and only one of them should
 * be the address.
 *
 * ## Search results are a different case
 *
 * `?q=` pages are excluded outright. They are thin, effectively infinite in
 * number, and generated by whatever a visitor happened to type — the classic
 * way a clean site ends up with thousands of near-empty URLs in the index.
 * `follow` stays on, so the links out of them still carry weight.
 */
export function listingMetadata({
  title,
  description,
  basePath,
  page = 1,
  query = '',
}: {
  title: string;
  description: string;
  basePath: string;
  page?: number;
  query?: string;
}): Metadata {
  return buildMetadata({
    // A comma, not a dash: this is public copy and the site carries no em
    // dashes. It also has to survive being truncated in a search result.
    title: page > 1 ? `${title}, page ${page}` : title,
    description,
    path: page > 1 ? `${basePath}?page=${page}` : basePath,
    noIndex: query.length > 0,
  });
}

/**
 * WebSite structured data for the homepage (section 32).
 *
 * NO `SearchAction`, deliberately. The usual reason to emit one is Google's
 * sitelinks searchbox, and Google withdrew support for that in late 2024, so it
 * would be markup describing a feature that no longer exists. This site also
 * has no single search address to point it at — searching is per listing
 * (`/songs/all?q=`, `/shorts/all?q=`, and each channel) rather than site-wide.
 *
 * `WebSite` still earns its place: it names the site as distinct from the
 * organisation that runs it, which is what lets a brand search resolve to the
 * site rather than to a company entity.
 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appConfig.name,
    url: appConfig.url,
    description: appConfig.description,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: appConfig.name, url: appConfig.url },
  };
}

/**
 * BreadcrumbList for a detail page (section 32).
 *
 * This is what turns the grey URL line in a search result into a readable
 * trail. The site shows a labelled "back" control rather than a visible
 * breadcrumb, and that is fine: the guidance asks that the markup match the
 * page's real position in the hierarchy, not that a particular widget be drawn.
 *
 * Pass the trail without the site root; it is added here so every page agrees
 * on what the first crumb is called.
 */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  const items = [{ name: 'Home', path: '/' }, ...trail];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * MusicRecording for a song page (section 32).
 *
 * Song pages carried no structured data at all, which left the one page type
 * that is unambiguously *about a piece of music* saying nothing about it.
 *
 * `byArtist` is omitted rather than guessed when a song has no artist recorded:
 * an empty `name` on a `MusicGroup` is worse than no `byArtist`, because it
 * asserts an artist exists and is nameless.
 */
export function songJsonLd(song: {
  title: string;
  slug: string;
  artist: string | null;
  description: string | null;
  image: string | null;
  releasedAt: Date | null;
  links: { url: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    url: absoluteUrl(`/songs/${song.slug}`),
    ...(song.artist ? { byArtist: { '@type': 'MusicGroup', name: song.artist } } : {}),
    ...(song.description ? { description: song.description } : {}),
    ...(song.image ? { image: absoluteUrl(song.image) } : {}),
    ...(song.releasedAt ? { datePublished: song.releasedAt.toISOString().slice(0, 10) } : {}),
    // Where to hear it. These are the streaming links the page already shows,
    // which is exactly what `sameAs` is for: other addresses for this same work.
    ...(song.links.length > 0 ? { sameAs: song.links.map((link) => link.url) } : {}),
    publisher: { '@type': 'Organization', name: appConfig.name, url: appConfig.url },
  };
}

/**
 * Organization contact details for `/contact` (section 32).
 *
 * NOT `LocalBusiness`. That type asserts somewhere the public can turn up to
 * during opening hours, and Rejoice is a production house reached by phone and
 * email. Claiming it invites a storefront listing that does not exist, and the
 * `openingHours` and `priceRange` it wants would be invented.
 *
 * `Organization` with a `contactPoint` says the true thing: here is who they
 * are and how to reach them. All three details are already printed on the page
 * itself, so nothing is being published that was not public.
 *
 * `url` matches the homepage's Organization exactly, which is what lets Google
 * treat the two as one entity rather than two companies with the same name.
 */
export function contactJsonLd(contact: { email: string; phone: string; address: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appConfig.name,
    url: appConfig.url,
    ...(contact.address
      ? { address: { '@type': 'PostalAddress', streetAddress: contact.address } }
      : {}),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.phone ? { telephone: contact.phone } : {}),
        availableLanguage: ['en', 'ta'],
      },
    ],
  };
}
