'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { buildVideoListWhere } from '@/features/youtube/contentFilters';
import { isMissingRow } from '@/lib/db/errors';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { clearedOverrides } from '@/lib/utils/videoDisplay';
import { addChannelSchema, fieldErrors, updateChannelSchema, updateVideoSchema } from '@/lib/validation';
import {
  connectChannel,
  disconnectChannel,
  refreshChannelMetadata,
} from '@/services/youtube/channelService';
import { recordSyncRun, syncChannel } from '@/services/youtube/videoSyncService';

/**
 * Admin mutations for channels and videos (sections 14, 17, 19, 21).
 *
 * Every action calls `requireAdmin()` first. Middleware already blocks
 * unauthenticated navigation, but a server action is its own endpoint and must
 * check for itself (section 37).
 */

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

const log = createLogger('youtubeActions');

/** Refresh every surface that can show video data. */
function revalidatePublicVideoPages() {
  revalidatePath('/', 'page');
  // '/videos', not '/songs': the video pages moved, and /songs is now the
  // platform directory with nothing nested under it.
  revalidatePath('/videos', 'layout');
  // 'layout', not the bare path: the same channel name and card text is drawn on
  // /creations/[id], and a page-scoped revalidate leaves those detail pages stale.
  revalidatePath('/creations', 'layout');
}

export async function addChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = addChannelSchema.safeParse({
    url: formData.get('url'),
    defaultVideoVisibility: formData.get('defaultVideoVisibility') ?? 'REVIEW_FIRST',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const channel = await connectChannel(parsed.data.url, parsed.data.defaultVideoVisibility);
    revalidatePath('/admin/youtube-channels');
    revalidatePath('/admin/youtube-content');
    revalidatePublicVideoPages();
    return { ok: true, message: `Connected ${channel.name} and imported its videos.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not connect that channel.',
    };
  }
}

export async function updateChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateChannelSchema.safeParse({
    id: formData.get('id'),
    defaultVideoVisibility: formData.get('defaultVideoVisibility'),
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { id, ...data } = parsed.data;
  await prisma.youTubeChannel.update({ where: { id }, data });

  revalidatePath('/admin/youtube-channels');
  revalidatePublicVideoPages();
  return { ok: true, message: 'Channel updated.' };
}

/** "Sync Now" (section 21). Runs a deep sweep. */
export async function syncChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'Missing channel.' };

  try {
    const result = await syncChannel(id, true);

    /*
     * A paused channel returns `{ ok: true, skipped: 1 }` without contacting
     * YouTube at all. Reported as success it read as "YouTube has nothing new",
     * which is the opposite of the truth — and worse, recording the run
     * overwrote the dashboard's record with a sync that never happened.
     */
    if (result.skipped > 0 && result.imported === 0 && result.updated === 0) {
      return { ok: false, message: 'This channel is paused. Resume it before syncing.' };
    }

    // Record it either way: a failed manual sync is still worth surfacing on the
    // dashboard, and a successful one must clear any earlier failure.
    await recordSyncRun([result]);

    if (!result.ok) return { ok: false, message: result.error ?? 'Synchronization failed.' };

    revalidatePath('/admin');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/youtube-channels');
    revalidatePath('/admin/youtube-content');
    revalidatePublicVideoPages();

    return {
      ok: true,
      message: `${result.channelName}: ${result.imported} new, ${result.updated} refreshed.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Synchronization failed.',
    };
  }
}

export async function refreshChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  try {
    await refreshChannelMetadata(id);
    revalidatePath('/admin/youtube-channels');
    // The name, logo and description this just pulled are drawn on /creations and
    // /creations/[id] too. Without this the public pages kept the old ones until
    // their 5-minute revalidate window lapsed.
    revalidatePublicVideoPages();
    return { ok: true, message: 'Channel details refreshed from YouTube.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Refresh failed.' };
  }
}

export async function disconnectChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  try {
    await disconnectChannel(id);
  } catch (error) {
    // Already gone (another tab): the desired state holds, so fall through.
    if (!isMissingRow(error)) {
      log.error(`Failed to disconnect channel ${id}`, error);
      return { ok: false, message: 'Could not disconnect the channel. Please try again.' };
    }
  }

  revalidatePath('/admin/youtube-channels');
  revalidatePath('/admin/youtube-content');
  revalidatePublicVideoPages();

  return { ok: true, message: 'Channel disconnected. The videos on YouTube are unaffected.' };
}

/** The "Show on Website" switch — the most important control (section 14). */
/**
 * Show or hide many videos at once (the bulk bar on Admin → YouTube Content).
 *
 * Two modes, and the difference matters:
 *
 *   - `mode=filter` re-derives the set HERE with the same `buildVideoListWhere`
 *     the list page used to render. No id list is trusted, so a forged post
 *     cannot name arbitrary rows, and the set cannot drift from what was on
 *     screen.
 *   - otherwise the posted ids are used, capped at the largest page size — an
 *     unbounded `IN (…)` is the thing to avoid.
 *
 * One `updateMany`, not N updates.
 */
const BULK_ID_LIMIT = 100;

export async function bulkSetVideoVisibilityAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const isVisible = formData.get('visible') === 'true';

  let where: Prisma.YouTubeVideoWhereInput;

  if (formData.get('mode') === 'filter') {
    where = buildVideoListWhere({
      q: str(formData.get('q')),
      filter: str(formData.get('filter')),
      channel: str(formData.get('channel')),
      type: str(formData.get('type')),
    });
  } else {
    const ids = formData.getAll('ids').map(String).filter(Boolean);
    if (ids.length === 0 || ids.length > BULK_ID_LIMIT) return;
    where = { id: { in: ids } };
  }

  await prisma.youTubeVideo.updateMany({ where, data: { isVisible } });

  revalidatePath('/admin/youtube-content');
  /*
   * No per-video `revalidatePath` here, unlike the single toggle below.
   * `revalidatePublicVideoPages` already revalidates '/videos' at LAYOUT scope,
   * which covers every nested video page — and in filter mode the per-video loop
   * would be hundreds of calls.
   */
  revalidatePublicVideoPages();
}

/** Undefined for an absent or empty field, so it never becomes a filter of ''. */
function str(value: FormDataEntryValue | null): string | undefined {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : undefined;
}

export async function toggleVideoVisibilityAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const video = await prisma.youTubeVideo.findUnique({
    where: { id },
    // youtubeVideoId is the PUBLIC address, and the only id that can revalidate
    // the video's own page — `id` here is the database key, which no public URL
    // uses any more.
    select: { isVisible: true, youtubeVideoId: true },
  });
  if (!video) return;

  await prisma.youTubeVideo.update({
    where: { id },
    data: { isVisible: !video.isVisible },
  });

  revalidatePath('/admin/youtube-content');
  revalidatePublicVideoPages();
  /*
   * The video's OWN page, explicitly.
   *
   * This is the fast path for taking something down, and the editor screen
   * already does this — leaving it out here meant a direct link to the video
   * could keep serving a cached page after the toggle. Whether the layout
   * revalidation above already covers nested routes could not be confirmed
   * without a production build, so this states the intent rather than relying
   * on it.
   */
  revalidatePath(`/videos/${video.youtubeVideoId}`);
}

/** One row in the carousel picker's search results. */
export type VideoPick = {
  id: string;
  title: string;
  channelName: string;
  thumbnail: string;
  /**
   * Whether this video can actually appear on the public site.
   *
   * The carousel query filters by the same rule, so a picked video that is
   * hidden is silently dropped from the row. Surfacing it here is what stops
   * that being a surprise — pick ten, see four, wonder why.
   */
  isVisible: boolean;
};

/**
 * Search videos for the carousel picker.
 *
 * A server action rather than an API route on purpose: a route handler would be
 * a new publicly addressable endpoint needing its own guard, whereas this
 * carries `requireAdmin()` inline and has no URL of its own. It reads the whole
 * video table, so that guard is the point.
 *
 * An empty query returns the newest videos, which is exactly what the dialog
 * shows before anything is typed — one function covers both states.
 *
 * ONLY videos the carousel can actually render are returned. It drops anything
 * hidden, so offering hidden videos here just invites picking ten and seeing
 * four. Filtering at the source removes the trap rather than warning about it.
 *
 * SHORTS are excluded for exactly the same reason, and it is the same trap: the
 * public carousel reads `publiclyVisibleLandscape`, which is the visibility rule
 * PLUS `isShort: false`. A Short picked here would be accepted, saved, and then
 * never appear — silently. They are not a rare case either; they were 22 of the
 * 57 videos this used to offer.
 *
 * Paged rather than capped. It used to stop at 10 rows (20 when searching) with
 * no way past them, which left most of the catalogue unreachable unless you
 * guessed a search term.
 */
/*
 * NOT exported: this file carries `'use server'`, where every export must be an
 * async function — a plain constant makes the whole module fail to compile
 * ("Only async functions are allowed to be exported in a 'use server' file"),
 * which 500s every page that transitively imports it. The client never needs
 * the number anyway; it reads `pageCount` off the response.
 */
const CAROUSEL_PICKER_PAGE_SIZE = 10;

export type VideoPickPage = {
  items: VideoPick[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchAdminVideosAction(
  query: string,
  page = 1,
): Promise<VideoPickPage> {
  await requireAdmin();

  const q = query.trim();
  /*
   * The same rule the public carousel query uses: the per-video switch, the
   * channel being active, AND landscape only.
   */
  const showing = { isVisible: true, isShort: false, channel: { isActive: true } };

  const where = q
    ? {
        ...showing,
        OR: [
          { youtubeTitle: { contains: q, mode: 'insensitive' as const } },
          { displayTitle: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : showing;

  const current = Math.max(1, Math.trunc(page));

  /*
   * Count and page in one transaction, so the total can never describe a
   * different set of rows than the ones returned beside it.
   *
   * `youtubePublishedAt desc` alone is a stable order here: no two of these
   * videos share a timestamp, which is what stops `skip`/`take` duplicating or
   * dropping rows between pages.
   */
  const [total, rows] = await prisma.$transaction([
    prisma.youTubeVideo.count({ where }),
    prisma.youTubeVideo.findMany({
      where,
      orderBy: [{ youtubePublishedAt: 'desc' }],
      skip: (current - 1) * CAROUSEL_PICKER_PAGE_SIZE,
      take: CAROUSEL_PICKER_PAGE_SIZE,
      select: {
      id: true,
      youtubeTitle: true,
      displayTitle: true,
      youtubeThumbnail: true,
      displayThumbnail: true,
      youtubeVideoId: true,
        isVisible: true,
        channel: { select: { name: true, isActive: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.displayTitle ?? row.youtubeTitle,
      channelName: row.channel.name,
      thumbnail:
        row.displayThumbnail ??
        row.youtubeThumbnail ??
        `https://i.ytimg.com/vi/${row.youtubeVideoId}/hqdefault.jpg`,
      // Matches the `publiclyVisible` rule the carousel query uses: an inactive
      // channel hides its videos too, not just the per-video switch.
      isVisible: row.isVisible && row.channel.isActive,
    })),
    total,
    page: current,
    // At least 1, so an empty result set still reads as "Page 1 of 1".
    pageCount: Math.max(1, Math.ceil(total / CAROUSEL_PICKER_PAGE_SIZE)),
  };
}

/** Save the website display details for one video (section 17). */
export async function updateVideoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateVideoSchema.safeParse({
    id: formData.get('id'),
    displayTitle: formData.get('displayTitle'),
    displayDescription: formData.get('displayDescription'),
    displayThumbnail: formData.get('displayThumbnail'),
    seoTitle: formData.get('seoTitle'),
    seoDescription: formData.get('seoDescription'),
    isVisible: formData.get('isVisible') === 'on',
    showChannelName: formData.get('showChannelName') === 'on',
    isAiDisclosed: formData.get('isAiDisclosed') === 'on',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { id, ...data } = parsed.data;

  // Note there is no youtubeVideoId here — it is never editable (Rule 8). It is
  // returned only so the video's public page can be revalidated by its address.
  const video = await prisma.youTubeVideo.update({
    where: { id },
    data,
    select: { youtubeVideoId: true },
  });

  revalidatePath('/admin/youtube-content');
  revalidatePath(`/admin/youtube-content/${id}`);
  revalidatePath(`/videos/${video.youtubeVideoId}`);
  revalidatePublicVideoPages();

  return { ok: true, message: 'Website display details saved.' };
}

/**
 * "Reset to YouTube Details" (section 19).
 *
 * Clears the website overrides so the page falls back to the imported YouTube
 * values. Publishing decisions (visible, featured, homepage, order) are left
 * alone, and YouTube itself is untouched.
 */
export async function resetVideoOverridesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'Missing video.' };

  const video = await prisma.youTubeVideo.update({
    where: { id },
    data: clearedOverrides(),
    select: { youtubeVideoId: true },
  });

  revalidatePath(`/admin/youtube-content/${id}`);
  revalidatePath('/admin/youtube-content');
  revalidatePath(`/videos/${video.youtubeVideoId}`);
  revalidatePublicVideoPages();

  return { ok: true, message: 'Website overrides removed. Showing the YouTube details again.' };
}
