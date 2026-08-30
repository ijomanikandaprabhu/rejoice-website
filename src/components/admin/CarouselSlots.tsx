'use client';

import { EyeOff, Plus, Search, X } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { searchAdminVideosAction, type VideoPick } from '@/features/youtube/actions';
import { cn } from '@/lib/utils';

const SLOTS = 10;

/**
 * Ten ordered slots for the Channels page carousel.
 *
 * Clicking a slot opens a search dialog: the newest videos to start with, then
 * whatever the search finds. One click fills the slot.
 *
 * Slot order IS carousel order, which is the reason this replaced a boolean
 * column — a flag on the video cannot express sequence. The ids ride in one
 * hidden field as JSON rather than ten named inputs, so the ORDER survives the
 * round trip intact. Empty slots do not: the picks are compacted on save, so
 * filling slots 1, 2 and 7 stores three videos and they reload into 1, 2 and 3.
 * That matches the public carousel, which is a sequential row with no concept of
 * a gap.
 */
export function CarouselSlots({ initial }: { initial: VideoPick[] }) {
  // Fixed length, so an empty slot is a real position rather than a missing one.
  const [slots, setSlots] = React.useState<(VideoPick | null)[]>(() => {
    const next: (VideoPick | null)[] = Array.from({ length: SLOTS }, () => null);
    initial.slice(0, SLOTS).forEach((video, index) => {
      next[index] = video;
    });
    return next;
  });

  const [openSlot, setOpenSlot] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<VideoPick[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  /*
   * Back to page 1 whenever the search changes.
   *
   * Without this, typing while on page 3 asks for page 3 of a result set that
   * may only have one — and the list comes back empty for a search that does
   * have matches.
   */
  React.useEffect(() => {
    setPage(1);
  }, [query]);

  // Debounced so typing does not fire a query per keystroke against ~1,700 rows.
  React.useEffect(() => {
    if (openSlot === null) return;
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const found = await searchAdminVideosAction(query, page);
        if (cancelled) return;
        setResults(found.items);
        setPageCount(found.pageCount);
        setTotal(found.total);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, page, openSlot]);

  const picked = slots.filter(Boolean) as VideoPick[];
  const chosenIds = picked.map((v) => v.id);
  const chosen = picked.length;
  const hiddenCount = picked.filter((v) => !v.isVisible).length;

  const pick = (video: VideoPick) => {
    if (openSlot === null) return;
    setSlots((prev) => {
      const next = [...prev];
      // Moving a video that is already in another slot, rather than duplicating it.
      const existing = next.findIndex((v) => v?.id === video.id);
      if (existing !== -1 && existing !== openSlot) next[existing] = null;
      next[openSlot] = video;
      return next;
    });
    setOpenSlot(null);
    setQuery('');
    setPage(1);
  };

  const clear = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* What the form actually submits. */}
      <input type="hidden" name="videoIds" value={JSON.stringify(chosenIds)} />

      {/*
       * The search only offers videos that are showing, so a hidden one cannot
       * be picked. It can still END UP hidden — chosen today, switched off in
       * YouTube Content tomorrow — and the carousel would then quietly show
       * fewer cards. That is what this warns about.
       */}
      {chosen > 0 ? (
        <p className="text-xs text-muted-foreground">
          {hiddenCount === 0 ? (
            <>
              <span className="font-medium text-panel-fg">{chosen}</span>{' '}
              {chosen === 1 ? 'video' : 'videos'} chosen — all will appear on the site.
            </>
          ) : (
            <>
              <span className="font-medium text-panel-fg">{chosen}</span> chosen, but only{' '}
              <span className="font-medium text-panel-fg">{chosen - hiddenCount}</span> will
              appear —{' '}
              <span className="font-medium text-panel-negative">
                {hiddenCount} {hiddenCount === 1 ? 'is' : 'are'} hidden
              </span>
              . Set them to Showing in YouTube Content, or swap them out.
            </>
          )}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {slots.map((video, index) => (
          <div key={index} className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setOpenSlot(index);
              }}
              aria-label={video ? `Change slot ${index + 1}` : `Add a video to slot ${index + 1}`}
              className={cn(
                'group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border text-xs transition-colors',
                video
                  ? 'border-white/10 bg-panel-alt'
                  : 'border-dashed border-white/15 bg-panel-alt/40 text-muted-foreground hover:border-panel-accent/60 hover:text-panel-accent',
              )}
            >
              {video ? (
                <Image
                  src={video.thumbnail}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover transition-opacity group-hover:opacity-70"
                />
              ) : (
                <Plus className="size-5" aria-hidden="true" />
              )}

              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                {index + 1}
              </span>

              {video && !video.isVisible ? (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-panel-negative/85 py-0.5 text-[10px] font-semibold text-black">
                  <EyeOff className="size-3" aria-hidden="true" />
                  Hidden
                </span>
              ) : null}
            </button>

            {video ? (
              <div className="flex items-start gap-1">
                <p className="line-clamp-2 flex-1 text-[11px] leading-tight text-muted-foreground">
                  {video.title}
                </p>
                <button
                  type="button"
                  onClick={() => clear(index)}
                  aria-label={`Clear slot ${index + 1}`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-panel-negative"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/60">Empty</p>
            )}
          </div>
        ))}
      </div>

      <Dialog open={openSlot !== null} onOpenChange={(open) => !open && setOpenSlot(null)}>
        <DialogContent className="admin-theme max-w-2xl font-admin">
          <DialogHeader>
            <DialogTitle>
              Choose a video for slot {openSlot === null ? '' : openSlot + 1}
            </DialogTitle>
            <DialogDescription>
              Only videos the carousel can show are listed — newest first. Shorts are
              left out because the carousel is landscape and would never display them.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search video titles…"
              className="pl-9"
            />
          </div>

          <div className="max-h-[22rem] space-y-1 overflow-y-auto pr-1">
            {loading && results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No videos match that search.
              </p>
            ) : (
              results.map((video) => {
                const already = chosenIds.includes(video.id);
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => pick(video)}
                    className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="relative block h-12 w-20 shrink-0 overflow-hidden rounded bg-panel-alt">
                      <Image src={video.thumbnail} alt="" fill sizes="80px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm text-panel-fg">{video.title}</span>
                      <span className="block text-xs text-muted-foreground">{video.channelName}</span>
                    </span>
                    {already ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-panel-accent">
                        In use
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            {/*
             * A local two-button pager rather than `components/admin/Pagination`:
             * that one is a Server Component building `<Link href>`s, and this
             * dialog's page lives in state with no URL to drive.
             */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {pageCount}
                {total > 0 ? ` · ${total} ${total === 1 ? 'video' : 'videos'}` : ''}
              </span>
            </div>

            <Button type="button" variant="ghost" onClick={() => setOpenSlot(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
