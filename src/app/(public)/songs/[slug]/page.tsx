import Image from 'next/image';
import { notFound, permanentRedirect } from 'next/navigation';

import { CtaPanel } from '@/components/site/CtaPanel';
import { PlatformGrid } from '@/components/site/PlatformGrid';
import { ctaPanels } from '@/config/content.config';
import { getPublicSong, mediaUrl } from '@/features/songs/queries';
import { getPublicVideoBySlug } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

/**
 * One song: its cover, and where to hear it.
 *
 * THIS ROUTE ALSO CARRIES A REDIRECT IT DID NOT ASK FOR. Videos used to live at
 * `/songs/<database id>` before they moved to `/videos/<youtube id>`, and this
 * address is where those old links still land. A song is looked up first; if
 * there is none, the old video lookup runs and redirects. Dropping that would
 * break every link shared before the move, and the search ranking attached to
 * them, which is why it is handled here rather than being left behind when this
 * page took the slot.
 */

export const revalidate = 300;

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params) {
  const song = await getPublicSong(params.slug);
  if (!song) return buildMetadata({ title: 'Songs', path: '/songs' });

  return buildMetadata({
    title: song.artist ? `${song.title} — ${song.artist}` : song.title,
    description:
      song.description ||
      `Listen to ${song.title}${song.artist ? ` by ${song.artist}` : ''} from Rejoice Gospel Communications.`,
    path: `/songs/${song.slug}`,
    image: mediaUrl(song.coverId),
  });
}

export default async function SongPage({ params }: Params) {
  const song = await getPublicSong(params.slug);

  if (!song) {
    // The legacy address. A video that no longer exists, or was hidden, 404s
    // rather than redirecting somewhere unrelated.
    const video = await getPublicVideoBySlug(params.slug);
    if (!video) notFound();

    // Permanent (308): the address genuinely changed, so search engines should
    // carry the existing ranking across rather than treat this as temporary.
    permanentRedirect(`/videos/${video.youtubeVideoId}`);
  }

  /*
   * `PlatformGrid` already draws exactly this — a logo on a light plate, a
   * name, and a link that opens in a new tab — so the links are mapped into its
   * shape rather than a second grid being written. The light plate matters:
   * several of these marks are near-black and would vanish on this ground.
   */
  const platforms = song.links.map((link) => ({
    name: link.platform.name,
    logo: mediaUrl(link.platform.logoId),
    url: link.url,
  }));

  return (
    <>
      <section className="container-page pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-14">
          <div>
            <Image
              src={mediaUrl(song.coverId)}
              alt={`${song.title} cover art`}
              width={1200}
              height={1200}
              priority
              sizes="(min-width: 1024px) 26rem, 100vw"
              className="aspect-square w-full rounded-[18px] border border-white/10 object-cover"
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="t-label text-site-muted">
              {song.releasedAt ? formatDate(song.releasedAt) : 'Rejoice Gospel Communications'}
            </p>

            <h1 className="t-h1 mt-5">{song.title}</h1>

            {song.artist ? (
              <p className="mt-4 text-body leading-[1.7] text-site-fg">{song.artist}</p>
            ) : null}

            {song.description ? (
              <p className="mt-5 max-w-prose text-body leading-[1.7] text-site-muted">
                {song.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <h2 className="t-h3">Listen</h2>

          <div className="mt-6">
            {platforms.length === 0 ? (
              <p className="text-body leading-[1.7] text-site-muted">
                Streaming links for this release are coming shortly.
              </p>
            ) : (
              <PlatformGrid platforms={platforms} />
            )}
          </div>
        </div>
      </section>

      <div className="container-page pb-14 sm:pb-20">
        <CtaPanel {...ctaPanels.music} />
      </div>
    </>
  );
}
