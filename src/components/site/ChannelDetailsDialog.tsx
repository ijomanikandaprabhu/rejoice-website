'use client';

import Image from 'next/image';
import * as React from 'react';

import { YouTubeIcon } from '@/components/common/YouTubeIcon';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
  channel: {
    name: string;
    url: string;
    thumbnail: string | null;
    description: string | null;
  };
  /** Extra classes for the trigger — the channel page stretches it on mobile. */
  className?: string;
};

/**
 * "Channel details" — the channel's description and counts in a modal.
 *
 * Radix handles the focus trap, Escape and the scroll lock. What it does NOT
 * handle is the colour: `DialogContent`'s defaults (`bg-background`, `ring-ring`)
 * are the ADMIN palette — the admin dialogs opt into it by passing
 * `admin-theme`. The public site paints from `site-*` tokens on black, so the
 * surface is restated here rather than inherited.
 */
export function ChannelDetailsDialog({ channel, className }: Props) {
  return (
    <Dialog>
      <DialogTrigger className={cn('btn-secondary px-5 text-sm', className)}>
        Channel details
      </DialogTrigger>

      <DialogContent // `sm:rounded-[20px]` as well as the base: DialogContent ships
        // `sm:rounded-lg`, which otherwise wins from the `sm` breakpoint up.
        className="max-w-lg rounded-[20px] border-white/10 bg-site-surface text-site-fg sm:rounded-[20px]"
        /*
         * Deliberately no `DialogDescription`, so this opts out by hand.
         *
         * Radix logs "Missing `Description` or `aria-describedby={undefined}`"
         * on every open otherwise. The title names the dialog, and the channel
         * description below is a body paragraph rather than a summary — wiring
         * it up as the description would make a screen reader read the whole
         * thing, and YouTube descriptions run to paragraphs.
         */
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-left text-h3">
            {channel.thumbnail ? (
              <Image
                src={channel.thumbnail}
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-pill object-cover"
              />
            ) : null}
            {channel.name}
          </DialogTitle>
        </DialogHeader>

        {channel.description ? (
          // `whitespace-pre-line` keeps the paragraph breaks YouTube stores.
          <p className="max-h-[45vh] overflow-y-auto whitespace-pre-line text-sm leading-[1.7] text-site-muted">
            {channel.description}
          </p>
        ) : (
          <p className="text-sm text-site-muted">This channel has no description.</p>
        )}

        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary mt-2 w-fit px-5 text-sm"
        >
          <YouTubeIcon />
          Visit on YouTube
        </a>
      </DialogContent>
    </Dialog>
  );
}
