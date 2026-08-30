import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExpandableText } from '@/components/common/ExpandableText';
import { YouTubeIcon } from '@/components/common/YouTubeIcon';
import { LinkedText } from '@/components/common/LinkedText';
import { SocialButtons } from '@/components/site/SocialButtons';
import { BackButton, SeeMoreFromChannel } from '@/components/site/Section';
import { LazyYouTubeEmbed } from '@/components/youtube/LazyYouTubeEmbed';
import { VideoTile } from '@/components/site/VideoTile';
import { getSocialSettings } from '@/features/settings/queries';
import { getLatestVideos, getPublicVideoBySlug } from '@/features/youtube/queries';
import { buildMetadata, videoJsonLd } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

export const revalidate = 300;

type Params = { params: { videoId: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const video = await getPublicVideoBySlug(params.videoId);
  if (!video) return buildMetadata({ title: 'Video not found', noIndex: true });

  return buildMetadata({
    title: video.seoTitle,
    description: video.seoDescription,
    path: `/videos/${video.youtubeVideoId}`,
    image: video.thumbnail,
    type: 'video.other',
    publishedTime: video.publishedAt,
  });
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}


export default async function VideoPage({ params }: Params) {
  const video = await getPublicVideoBySlug(params.videoId);

  // A hidden video must not be reachable by guessing its URL.
  if (!video) notFound();

  /*
   * One canonical address per video.
   *
   * The lookup also accepts a database id so links shared before this move keep
   * working, but those are redirected rather than served — otherwise the same
   * video would live at two URLs and split its own search ranking.
   */
  if (params.videoId !== video.youtubeVideoId) {
    permanentRedirect(`/videos/${video.youtubeVideoId}`);
  }

  const social = await getSocialSettings();
  const related = (await getLatestVideos(10)).filter((v) => v.id !== video.id).slice(0, 9);
  const duration = formatDuration(video.durationSeconds);

  /*
   * Back goes to the channel this video belongs to, not the channels board.
   *
   * You reach a video by browsing a channel, so the board is a level too far up
   * — it drops you out of what you were looking at. The handle is the canonical
   * segment; the id is accepted by the channel route too and covers a channel
   * imported without one.
   */
  const channelSlug = video.channel.handle ?? video.channel.id;

  return (
    <div className="container-page py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd(video)) }}
      />

      {/* Labelled here, unlike the channel page's bare icon: this button stands
          alone at the top of the page, so it says where it goes. */}
      <BackButton
        href={`/creations/${channelSlug}`}
        label={video.channel.name}
        ariaLabel={`Back to ${video.channel.name}`}
      />

      {/*
       * One column, full width.
       *
       * The player used to sit in an 8-of-12 grid with a sidebar beside it.
       * `min-w-0` and the wrapping rules below are kept from the mobile
       * overflow fix — the descriptions contain unbreakable runs (an 80
       * character dash divider, social URLs joined with no spaces) that
       * otherwise force the page wider than the screen.
       */}
      <div className="mt-8 min-w-0">
        <LazyYouTubeEmbed
          youtubeVideoId={video.youtubeVideoId}
          title={video.title}
          thumbnail={video.thumbnail}
        />

        {/* `anywhere`, not Tailwind's `break-words`: only `anywhere` reduces the
            element's min-content width, which is what actually lets the column
            shrink. `break-word` wraps visually and leaves the bug. */}
        {/* `font-medium` overrides `t-h1`'s light weight on purpose: this title is
              knocked down to 24px, and 300 at that size is thin and weak. The
              light weight is for display headings, not for a 24px line. */}
          <h1 className="t-h1 mt-8 text-[1.5rem] font-medium [overflow-wrap:anywhere] sm:text-[2rem]">
          {video.title}
        </h1>

        {/*
         * The facts that used to sit in a boxed "Details" panel, as one quiet
         * line. Same three values under the same conditions: runtime only when
         * known, channel only when the administrator has switched it on.
         */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-site-muted">
          <time dateTime={video.publishedAt.toISOString()}>{formatDate(video.publishedAt)}</time>
          {duration ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{duration}</span>
            </>
          ) : null}
          {video.showChannelName ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.channel.name}</span>
            </>
          ) : null}
        </p>

        {video.description ? (
          <ExpandableText className="prose-site mt-6 max-w-3xl" lines={4}>
            {/* The URLs in here become links. Rendered as elements rather than
                injected HTML — see LinkedText for why that matters. */}
            <p>
              <LinkedText text={video.description} />
            </p>
          </ExpandableText>
        ) : null}

        {/*
         * `justify-between`: the YouTube button stays left, the social row sits
         * at the right edge. On a narrow screen the row wraps, and a lone item
         * on a wrapped line falls back to the left — which is where it belongs
         * on a phone.
         */}
        <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <a
            href={video.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <YouTubeIcon />
            Watch on YouTube
          </a>

          <SocialButtons links={social.links} shareTitle={video.title} />
        </div>

        {related.length > 0 ? (
          <div className="mt-16">
            <p className="t-label">Next</p>
            {/* The channel page's grid exactly, so the two screens line up. */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map((item, i) => (
                <VideoTile key={item.id} video={item} size="small" index={i} />
              ))}
            </div>

            {/* Inside the `related` check, not after it: with nothing above it a
                lone "see more" would read as an orphan, and the header button
                already links back to the channel. */}
            <SeeMoreFromChannel slug={channelSlug} name={video.channel.name} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
