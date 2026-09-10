import { appConfig, publicNav } from '@/config/app.config';
import { services } from '@/config/content.config';
import { getChannelsWithVideos } from '@/features/youtube/queries';
import { absoluteUrl } from '@/lib/seo';

/**
 * `/llms.txt` — the site explained in plain sentences, for the crawlers behind
 * AI answers.
 *
 * A convention rather than a standard: nothing is obliged to read this. It costs
 * one small text file, and the alternative is leaving an answer engine to infer
 * the business from a homepage that is mostly a wall of video thumbnails.
 *
 * GENERATED, not written by hand, and that is the whole point. Every fact here
 * already exists somewhere the site itself renders — the description from
 * `appConfig`, the offerings from `content.config`, the channels from the
 * database. A hand-written copy would be accurate on the day it was written and
 * quietly wrong six months later, which is worse than not having one: a
 * confident, stale answer is harder to correct than no answer.
 *
 * Deliberately short. The sitemap already lists 1,541 URLs; repeating them here
 * would bury the four sentences that actually identify the company.
 */

/* Matches the public pages, so a newly connected channel appears within 5 min. */
export const revalidate = 300;

export async function GET(): Promise<Response> {
  /*
   * The channels are the one part that comes from the database, so a failure
   * here degrades the file rather than failing the request. A crawler asking
   * for this should never get a 500 because YouTube data was briefly
   * unavailable — an incomplete description beats none.
   */
  const channels = await getChannelsWithVideos(0).catch(() => []);

  const lines = [
    `# ${appConfig.legalName}`,
    '',
    `> ${appConfig.description}`,
    '',
    `${appConfig.legalName} — also written simply as "${appConfig.name}" — has produced`,
    `Tamil Christian and gospel music since ${appConfig.foundingYear}. The studio is based in`,
    `${appConfig.place.addressLocality}, ${appConfig.place.addressRegion}, India, and publishes its work`,
    'on YouTube as well as the streaming platforms.',
    '',
    '## What it does',
    '',
    ...services.map((service) => `- **${service.title}**: ${service.lead}`),
    '',
    '## Main pages',
    '',
    ...publicNav.map((item) => `- [${item.label}](${absoluteUrl(item.href)})`),
    `- [All songs](${absoluteUrl('/songs/all')})`,
    `- [Short videos](${absoluteUrl('/shorts')})`,
    '',
  ];

  if (channels.length > 0) {
    lines.push(
      '## YouTube channels',
      '',
      ...channels.map((channel) => `- [${channel.name}](${channel.url})`),
      '',
    );
  }

  lines.push(
    '## Notes',
    '',
    `- The full list of pages is at ${absoluteUrl('/sitemap.xml')}.`,
    '- Song and video pages carry schema.org MusicRecording and VideoObject data.',
    '- Administration pages under /admin are private and are not for indexing.',
    '',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Same 5 minutes the pages use, with a stale window so a slow rebuild
      // never leaves a crawler waiting.
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
