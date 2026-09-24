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
/**
 * The crawlers behind AI answers, named rather than left to the wildcard.
 *
 * They were already allowed — everything is, under `*` — so this changes no
 * permission. It states the decision instead of leaving it to a default, which
 * matters because the default is the thing that silently changes when a crawler
 * starts treating an unnamed site as opt-out.
 *
 * The owner's decision was to be readable by them: the studio wants to be the
 * answer when somebody asks about Tamil gospel music production. Naming each
 * agent, with the same two exclusions everything else gets, is how that is said
 * out loud. To reverse it, change `allow` to `disallow` here — one line, and
 * the reason it is one line is that it is a decision worth being able to undo.
 */
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
  'Amazonbot',
] as const;

export default function robots(): MetadataRoute.Robots {
  const shared = {
    allow: ['/', '/api/image', '/api/media'],
    disallow: [
      '/admin/',
      '/api/',
      /*
       * Addresses carrying a query, which are the ones that CANNOT be cached.
       *
       * Every other page is served from a cached copy, so a crawler reading it
       * costs nothing. These are built per request: `?page=17` on a channel,
       * `?q=` on a search, `?v=` on the Shorts feed. The largest channel alone
       * runs to 36 pages, and a crawler working through them wakes the database
       * once per address — which, with the five-minute rebuild, is how a month's
       * database allowance disappeared and the site went down.
       *
       * Nothing is lost by this. The sitemap lists all 1,541 real addresses —
       * every song, video and channel — so a crawler reaches everything without
       * walking the pager. Search results were already marked "do not index"
       * (`listingMetadata`); this stops them being fetched at all rather than
       * fetched and then discarded.
       *
       * Visitors are unaffected: robots.txt speaks only to crawlers. Clicking
       * "next page" or searching works exactly as before.
       */
      '/*?page=',
      '/*?q=',
      '/*?v=',
      // A query anywhere after the first parameter, e.g. `?q=x&page=2`.
      '/*&page=',
      '/*&q=',
    ],
  };

  return {
    rules: [
      { userAgent: '*', ...shared },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, ...shared })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
