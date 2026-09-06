import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';

/**
 * Keep administration and API routes out of search results (section 34).
 *
 * WITH TWO EXCEPTIONS, AND THEY MATTER. Every image on this site is served
 * from `/api` — artwork and channel logos through `/api/media/<id>`, and every
 * YouTube thumbnail through the `/api/image` proxy. A blanket `Disallow: /api/`
 * therefore told Google it may not fetch a single picture on the site: 439 of
 * them on the homepage alone, and the `og:image` of every song page.
 *
 * The cost was invisible because nothing looked broken. Facebook and X ignore
 * robots.txt, so social previews kept working; only Google obeyed, and only
 * Google's image index and rich results went without. For a music and video
 * label that is the wrong thing to give away silently.
 *
 * So the two image paths are allowed and the rest of `/api` stays shut. The
 * order is deliberate: `allow` rules are more specific than the `/api/`
 * disallow, and every major crawler resolves a conflict in favour of the
 * longest matching rule, so `/api/image` wins for images while `/api/youtube`,
 * `/api/contact` and the rest stay disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/image', '/api/media'],
      disallow: ['/admin/', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
