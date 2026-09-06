import { notFound, permanentRedirect } from 'next/navigation';

import { BackButton } from '@/components/site/Section';
import { CtaPanel } from '@/components/site/CtaPanel';
import { PlatformGrid } from '@/components/site/PlatformGrid';
import { VinylCover } from '@/components/site/VinylCover';
import { ctaPanels } from '@/config/content.config';
import { getPublicSong, mediaUrl } from '@/features/songs/queries';
import { getPublicVideoBySlug } from '@/features/youtube/queries';
import { breadcrumbJsonLd, buildMetadata, songJsonLd } from '@/lib/seo';
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
    // "by", not a dash: this is the browser tab and the Google result, where
    // the words do the joining better than punctuation does.
    title: song.artist ? `${song.title} by ${song.artist}` : song.title,
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
      {/*
       * This page carried no structured data at all, which left the one page
       * type on the site that is unambiguously about a piece of music saying
       * nothing about it. The breadcrumb states where the page sits; the site
       * shows a labelled back control rather than a drawn trail, which the
       * markup is allowed to describe.
       */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            songJsonLd({
              title: song.title,
              slug: song.slug,
              artist: song.artist,
              description: song.description,
              image: mediaUrl(song.coverId),
              releasedAt: song.releasedAt,
              links: song.links,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Songs', path: '/songs' },
              { name: song.title, path: `/songs/${song.slug}` },
            ]),
          ),
        }}
      />

      <section className="container-page pb-16 pt-8 sm:pb-20 sm:pt-10">
        {/* Labelled rather than a bare arrow: it stands alone at the top of the
            page, so it should say where it goes — the same reasoning as the
            video page's. */}
        <BackButton href="/songs" label="Songs" ariaLabel="Back to songs" />

        {/*
         * The media column is wider than the sleeve on purpose: the record
         * emerges to the right of it, and a column sized to the square would
         * push the disc under the title.
         */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,34rem)_1fr] lg:gap-14">
          <div>
            <VinylCover src={mediaUrl(song.coverId)} alt={`${song.title} cover art`} />
          </div>

          <div className="flex flex-col justify-center">
            {/*
              * The release date, or nothing at all.
              *
              * This used to fall back to "Rejoice Gospel Communications" when a
              * song had no date. That was written while the form still had a
              * date field; once the field was removed, no song has one, so
              * every page announced the label's own name to visitors already on
              * the label's website. An empty line says less and means more.
              */}
            {/*
              * The release date when there is one, otherwise the label's short
              * name.
              *
              * "Rejoice", not "Rejoice Gospel Communications": the full name
              * ran wider than the title it sat above, and a visitor is already
              * on the label's website — the long form reads as letterhead. The
              * full name still appears in the page's search description, where
              * it is doing real work.
              *
              * The gap belongs to this line, not to the heading. As `mt-5` on
              * the title it would survive this being absent.
              */}
            <p className="t-label mb-5 text-site-muted">
              {song.releasedAt ? formatDate(song.releasedAt) : 'Rejoice'}
            </p>

            <h1 className="t-h1">{song.title}</h1>

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
