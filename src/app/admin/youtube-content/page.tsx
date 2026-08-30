import type { Prisma } from '@prisma/client';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ActionButton } from '@/components/admin/ActionForm';
import {
  BulkProvider,
  RowCheckbox,
  SelectAllCheckbox,
} from '@/components/admin/BulkSelection';
import { BulkBar } from '@/components/admin/BulkVisibility';
import { ChannelAvatars } from '@/components/admin/ChannelAvatars';
import { Pagination } from '@/components/admin/Pagination';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { resolvePerPage, RowsPerPage } from '@/components/admin/RowsPerPage';
import { SearchField } from '@/components/admin/SearchField';
import { TypeTabs, type VideoType } from '@/components/admin/TypeTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { pageSizes } from '@/config/app.config';
import { buildVideoListWhere, type VideoListParams } from '@/features/youtube/contentFilters';
import {
  bulkSetVideoVisibilityAction,
  toggleVideoVisibilityAction,
} from '@/features/youtube/actions';
import { prisma } from '@/lib/db/prisma';
import { cn, formatDate } from '@/lib/utils';
import { fallbackThumbnailUrl, hasVideoOverrides } from '@/lib/utils/videoDisplay';

export const dynamic = 'force-dynamic';

type SearchParams = VideoListParams & {
  page?: string;
  perPage?: string;
};

const VIDEO_TYPES: VideoType[] = ['all', 'videos', 'shorts'];

/* `all` rather than '' — Radix Select reserves the empty string. */
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'recent', label: 'Recently imported' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'regular', label: 'Regular videos' },
  { value: 'ai', label: 'AI disclosed' },
];

export default async function VideoContentPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);
  const take = resolvePerPage(searchParams.perPage, pageSizes.adminVideos);

  const type: VideoType = VIDEO_TYPES.includes(searchParams.type as VideoType)
    ? (searchParams.type as VideoType)
    : 'all';

  /*
   * Channels load FIRST because the default channel comes from them.
   *
   * Three states, and the middle one is new: an ABSENT `channel` now means "the
   * default channel", `all` means every channel, and an id means that channel.
   * Absent used to mean everything, so `all` is now the only way to say it.
   */
  const channels = await prisma.youTubeChannel.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, thumbnail: true },
  });

  const showingAllChannels = searchParams.channel === 'all';
  const activeChannel = showingAllChannels
    ? undefined
    : (searchParams.channel ?? channels[0]?.id);

  /*
   * One canonical set of filter params, used by the row query, the tab counts,
   * every href builder and the bulk bar.
   *
   * `searchParams.channel` must not be read past this point. On a fresh load it
   * is absent while the table shows ONE channel, so anything reading it raw
   * would disagree with what is on screen — and in the bulk bar's case would
   * "select all matching" across both channels.
   */
  const params: VideoListParams = {
    q: searchParams.q,
    filter: searchParams.filter,
    channel: activeChannel,
    type: searchParams.type,
  };

  const where = buildVideoListWhere(params);

  /*
   * Counts for the tabs come from the filter WITHOUT `type`, so each tab reports
   * what it would yield under the other active filters. Sharing `where` would
   * collapse all three to whatever is currently selected.
   */
  const whereWithoutType = buildVideoListWhere({ ...params, type: undefined });

  const [videos, total, byShape] = await Promise.all([
    prisma.youTubeVideo.findMany({
      where,
      orderBy: [{ youtubePublishedAt: 'desc' }],
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        youtubeVideoId: true,
        youtubeTitle: true,
        isShort: true,
        isAiDisclosed: true,
        youtubeThumbnail: true,
        youtubePublishedAt: true,
        // All eight override columns, so the "edited" marker below reflects any
        // hand-editing rather than just a custom title.
        displayTitle: true,
        displayDescription: true,
        displayThumbnail: true,
        seoTitle: true,
        seoDescription: true,
        isVisible: true,
        channel: { select: { name: true } },
      },
    }),
    prisma.youTubeVideo.count({ where }),
    prisma.youTubeVideo.groupBy({
      by: ['isShort'],
      _count: true,
      where: whereWithoutType,
    }),
  ]);

  const shortsCount = byShape.find((row) => row.isShort)?._count ?? 0;
  const videosCount = byShape.find((row) => !row.isShort)?._count ?? 0;
  const typeCounts: Record<VideoType, number> = {
    all: shortsCount + videosCount,
    videos: videosCount,
    shorts: shortsCount,
  };

  const pageCount = Math.max(Math.ceil(total / take), 1);

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set('q', searchParams.q);
    if (searchParams.filter && searchParams.filter !== 'all') p.set('filter', searchParams.filter);
    setChannel(p);
    if (type !== 'all') p.set('type', type);
    if (take !== pageSizes.adminVideos) p.set('perPage', String(take));
    if (n > 1) p.set('page', String(n));
    const query = p.toString();
    return query ? `/admin/youtube-content?${query}` : '/admin/youtube-content';
  };

  /*
   * `channel=all` is written out EXPLICITLY, unlike every other param.
   *
   * These builders used to drop it, because an absent channel and `all` meant
   * the same thing. They no longer do: absent now resolves to the default
   * channel, so omitting `all` would quietly throw the operator back onto one
   * channel the moment they paged or switched tab.
   */
  const setChannel = (p: URLSearchParams) => {
    if (showingAllChannels) p.set('channel', 'all');
    else if (activeChannel && activeChannel !== channels[0]?.id) p.set('channel', activeChannel);
  };

  /** Switching channel keeps the other filters but drops `page` — page 40 of one
   * channel is meaningless in another. */
  const channelHref = (next: string | undefined) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set('q', searchParams.q);
    if (searchParams.filter && searchParams.filter !== 'all') p.set('filter', searchParams.filter);
    // `undefined` here means the operator asked for everything, which must be
    // written as `all` — leaving it out would resolve back to the default.
    if (next) p.set('channel', next);
    else p.set('channel', 'all');
    if (type !== 'all') p.set('type', type);
    if (take !== pageSizes.adminVideos) p.set('perPage', String(take));
    const query = p.toString();
    return query ? `/admin/youtube-content?${query}` : '/admin/youtube-content';
  };

  /** Switching type keeps the other filters but drops `page` — page 12 of Shorts
   * means nothing once you are looking at Videos. */
  const typeHref = (next: VideoType) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set('q', searchParams.q);
    if (searchParams.filter && searchParams.filter !== 'all') p.set('filter', searchParams.filter);
    setChannel(p);
    if (next !== 'all') p.set('type', next);
    if (take !== pageSizes.adminVideos) p.set('perPage', String(take));
    const query = p.toString();
    return query ? `/admin/youtube-content?${query}` : '/admin/youtube-content';
  };

  return (
    <>
      {/* Title, blurb and channel picker centred as one masthead. */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">YouTube Content</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Choose which imported videos appear on the Rejoice website. Hiding a video here never
          changes anything on YouTube.
        </p>

        <div className="mt-5 flex justify-center">
          <ChannelAvatars channels={channels} current={activeChannel} buildHref={channelHref} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{total.toLocaleString()}</span>{' '}
        video{total === 1 ? '' : 's'} found
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
      </p>

      {/*
       * Above the branch, not inside the table card: a type with no rows must
       * still show the tabs, or there is no way back out of an empty view.
       */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeTabs current={type} counts={typeCounts} buildHref={typeHref} />

        {/*
         * No wrapping form. Both controls navigate client-side and merge into
         * the existing query params — a native GET submit reloaded the whole
         * document, which is what made the channel logos flash.
         */}
        <div className="flex flex-wrap items-center gap-2">
          <QuerySelect
            param="filter"
            id="filter"
            ariaLabel="Filter"
            value={searchParams.filter ?? 'all'}
            clearValue="all"
            options={FILTERS}
            className="h-9 w-[11rem]"
          />

          {/*
           * No Reset button: each control clears itself in one click. The search
           * box has its own X, and the dropdown's "All" is its cleared state.
           */}
          <SearchField defaultValue={searchParams.q ?? ''} />
        </div>
      </div>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            {/* Distinguish "the filter matches nothing" from "you have paged
                past the end", which used to read identically. */}
            {total > 0 ? (
              <>
                <p className="font-medium">Nothing on this page</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {total.toLocaleString()} video{total === 1 ? '' : 's'} match — go back to page 1.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={pageHref(1)}>Back to page 1</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">No videos match</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try clearing the filters, or sync a channel to import videos.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <BulkProvider>
          <BulkBar
            action={bulkSetVideoVisibilityAction}
            total={total}
            pageIds={videos.map((v) => v.id)}
            params={{
              q: searchParams.q,
              filter: searchParams.filter,
              // The RESOLVED channel, never raw `searchParams.channel`: on a
              // fresh load that is absent while the table shows ONE channel, so
              // escalating would act across BOTH.
              channel: activeChannel,
              // Without this, escalating on Shorts would act on ALL videos.
              type: searchParams.type,
            }}
          />

          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox ids={videos.map((v) => v.id)} />
                  </TableHead>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead className="hidden md:table-cell">Channel</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video, i) => {
                  const title = video.displayTitle ?? video.youtubeTitle;
                  const thumb =
                    video.displayThumbnail ??
                    video.youtubeThumbnail ??
                    fallbackThumbnailUrl(video.youtubeVideoId);

                  return (
                    <TableRow key={video.id}>
                      <TableCell className="align-top">
                        <RowCheckbox id={video.id} />
                      </TableCell>

                      {/*
                       * Position in the CURRENT filtered view, not a stable id —
                       * it shifts as soon as a filter changes or a video is
                       * hidden. Numbering runs on across pages so it matches the
                       * "101–125 of 1,748" the footer reports.
                       */}
                      <TableCell className="text-right align-top text-sm tabular-nums text-muted-foreground">
                        {(page - 1) * take + i + 1}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Image
                            src={thumb}
                            alt=""
                            width={96}
                            height={54}
                            className="h-[54px] w-24 shrink-0 rounded object-cover"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/admin/youtube-content/${video.id}`}
                              className="line-clamp-2 font-medium hover:underline"
                            >
                              {title}
                            </Link>
                            {/*
                             * A div, not a p: `Badge` renders a div, and a div
                             * inside a p is invalid HTML — the browser hoists it
                             * out and hydration then mismatches.
                             */}
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {formatDate(video.youtubePublishedAt)}
                                {hasVideoOverrides(video) ? ' · edited' : ''}
                              </span>
                              {/*
                               * Set by the sync from the video's shape, not its
                               * length — see `isVertical` in youtubeClient.ts.
                               */}
                              {video.isShort ? (
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-panel-short/15 px-1.5 py-0 text-[0.6875rem] text-panel-short"
                                >
                                  Short
                                </Badge>
                              ) : null}
                              {/*
                               * The UPLOADER declared this as altered or
                               * synthetic. A disclosure, not detection — an
                               * undisclosed AI video carries no badge.
                               */}
                              {video.isAiDisclosed ? (
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-panel-ai/15 px-1.5 py-0 text-[0.6875rem] text-panel-ai"
                                >
                                  AI
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {video.channel.name}
                      </TableCell>

                      <TableCell>
                        <ActionButton
                          action={toggleVideoVisibilityAction}
                          hiddenFields={{ id: video.id }}
                          variant={video.isVisible ? 'default' : 'outline'}
                          size="sm"
                          pendingLabel="…"
                          className={cn('gap-1.5', !video.isVisible && 'text-muted-foreground')}
                        >
                          {video.isVisible ? (
                            <Eye className="size-3.5" />
                          ) : (
                            <EyeOff className="size-3.5" />
                          )}
                          {video.isVisible ? 'Showing' : 'Hidden'}
                        </ActionButton>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button asChild variant="link" size="sm">
                          <Link href={`/admin/youtube-content/${video.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </BulkProvider>
      )}

      {/*
       * Footer row: size control and pager share one line and one baseline.
       * Stacked they read as misaligned, since one sits right and the other
       * centre. Below `sm` they stack, pager first.
       */}
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
        <RowsPerPage perPage={take} page={page} total={total} />

        <Pagination page={page} pageCount={pageCount} buildHref={pageHref} />
      </div>
    </>
  );
}
