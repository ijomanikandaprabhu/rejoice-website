import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

import type { Platform } from '@/config/content.config';
import { cn } from '@/lib/utils';

/**
 * The platform logos, as cards.
 *
 * Two states per card, decided by whether a `url` is set:
 *
 *   - with one, the card is a link opening in a new tab;
 *   - without, it is a plain `div` — visible, not clickable, no dead link.
 *
 * That is what lets the page ship before the profile URLs exist: pasting a URL
 * into `platforms` is the only change needed to light a card up.
 */
export function PlatformGrid({ platforms }: { platforms: readonly Platform[] }) {
  return (
    <ul
      className={cn(
        'grid gap-4',
        // Ten cards land as two clean rows of five at desktop; three across on
        // a tablet, two on a phone, where five would be 60px wide.
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
      )}
    >
      {platforms.map((platform) => (
        <li key={platform.name}>
          <PlatformCard platform={platform} />
        </li>
      ))}
    </ul>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  const inner = (
    <>
      {/*
       * A light plate under the logo.
       *
       * These are full-colour brand marks and several — Spotify's wordmark,
       * iTunes, Wynk — are dark or near-black, so on this page's ground they
       * would disappear. The plate is the same answer the homepage ring uses.
       */}
      <span className="flex h-20 items-center justify-center rounded-[12px] bg-white px-5">
        {platform.logo ? (
          <Image
            src={platform.logo}
            alt=""
            width={220}
            height={80}
            className="max-h-10 w-auto object-contain"
          />
        ) : (
          // No logo file yet: the name still identifies the platform.
          <span data-reveal className="text-sm font-semibold text-black">
            {platform.name}
          </span>
        )}
      </span>

      <span className="mt-4 flex items-center justify-between gap-2">
        <span data-reveal className="text-sm font-medium text-site-fg">
          {platform.name}
        </span>
        {platform.url ? (
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 shrink-0 text-site-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-site-accent"
          />
        ) : null}
      </span>
    </>
  );

  const shell =
    'group block rounded-[16px] border border-white/10 bg-site-surface p-4 transition-colors duration-300';

  if (!platform.url) {
    return <div className={shell}>{inner}</div>;
  }

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(shell, 'hover:border-site-accent/50')}
    >
      {inner}
      {/* Says out loud what the target attribute does, so nobody is surprised
          by a new tab. */}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export default PlatformGrid;
