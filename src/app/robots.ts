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
    disallow: ['/admin/', '/api/'],
  };

  return {
    rules: [
      { userAgent: '*', ...shared },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, ...shared })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
