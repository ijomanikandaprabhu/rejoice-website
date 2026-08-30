import { notFound, permanentRedirect } from 'next/navigation';

import { getPublicVideoBySlug } from '@/features/youtube/queries';

/**
 * The old video address, kept alive as a redirect.
 *
 * Videos used to live under `/songs/<database id>`, from when `/songs` was the
 * video catalogue. It is now the streaming-platform directory and holds no
 * videos, so the pages moved to `/videos/<youtubeVideoId>`.
 *
 * This cannot be a `next.config` rewrite: the old id and the new one are
 * different values, so translating between them needs a database lookup.
 *
 * Note `/songs` itself is a real page and is unaffected — this route only
 * matches a segment BELOW it.
 */

export const revalidate = 300;

type Params = { params: { id: string } };

export default async function LegacyVideoPage({ params }: Params) {
  const video = await getPublicVideoBySlug(params.id);

  // A video that no longer exists, or was hidden, 404s rather than redirecting
  // somewhere unrelated.
  if (!video) notFound();

  // Permanent (308): the address genuinely changed, so search engines should
  // carry the existing ranking across rather than treat this as temporary.
  permanentRedirect(`/videos/${video.youtubeVideoId}`);
}
