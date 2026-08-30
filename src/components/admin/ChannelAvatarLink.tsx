'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * One channel avatar in the filter row, with its tooltip.
 *
 * ## Why this is split out of `ChannelAvatars`
 *
 * A Radix tooltip needs a Client Component, but `ChannelAvatars` cannot become
 * one: the page passes it `buildHref` — a FUNCTION — and functions cannot cross
 * the server/client boundary. So the parent stays server-side and keeps calling
 * `buildHref` itself, while this child takes only serializable props.
 *
 * ## Why the tooltip is not just the channel name
 *
 * Clicking the ACTIVE avatar clears the filter, and that is the only way back to
 * all channels from this row — behaviour with nothing on screen to announce it.
 * The tooltip is the natural place to say so, which is why the active state gets
 * different text.
 *
 * The `sr-only` name stays: Radix associates tooltip content through
 * `aria-describedby`, which is a description, not the accessible name. Without
 * the span this would be a link called nothing.
 */
export function ChannelAvatarLink({
  href,
  name,
  thumbnail,
  active,
}: {
  href: string;
  name: string;
  thumbnail: string | null;
  active: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'rounded-full transition-opacity',
            active ? 'opacity-100' : 'opacity-60 hover:opacity-100',
          )}
        >
          <Avatar
            className={cn(
              'size-14 ring-offset-2 ring-offset-background transition-shadow',
              active ? 'ring-2 ring-panel-accent' : 'ring-1 ring-border',
            )}
          >
            {thumbnail ? (
              <AvatarImage asChild src={thumbnail}>
                <Image src={thumbnail} alt="" width={56} height={56} />
              </AvatarImage>
            ) : null}
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">{name}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {active ? `${name} — click to show all channels` : name}
      </TooltipContent>
    </Tooltip>
  );
}

export default ChannelAvatarLink;
