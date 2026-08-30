'use client';

import { Check, ExternalLink, Link2, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Share this page.
 *
 * Two behaviours, chosen at click time:
 *
 *   - On a touch device the operating system's own share sheet opens, which
 *     reaches every app the person actually has installed.
 *   - Everywhere else a small popup offers copy-the-link plus the three
 *     platforms that publish a web share endpoint.
 *
 * Instagram is deliberately absent: it has no public share URL, so no website
 * can offer it.
 */

type ShareTarget = { label: string; href: (url: string, title: string) => string };

const TARGETS: ShareTarget[] = [
  {
    label: 'WhatsApp',
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    label: 'Facebook',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: 'X',
    href: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
];

/**
 * Should this click open the operating system's share sheet?
 *
 * Both halves matter. `navigator.share` alone is not enough — desktop Safari and
 * some Chrome builds expose it, and firing an OS sheet on a laptop is not what
 * was asked for. `pointer: coarse` is what actually says "this is a touch
 * device". Feature and input detection, never user-agent sniffing.
 */
function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function ShareButton({
  title,
  url: urlProp,
  className,
}: {
  title: string;
  /** Overrides the page's own URL — for a component sharing something other than itself, e.g. the active item in a feed. */
  url?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState('');

  // Read on mount, not during render: `window` does not exist on the server, and
  // this keeps the markup identical on both sides.
  useEffect(() => setPageUrl(window.location.href), []);

  const url = urlProp ?? pageUrl;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused on an insecure origin or by permissions.
      // An error toast for a share button would be noise.
    }
  }

  /*
   * The popover is controlled so the native path can suppress it. Radix would
   * otherwise open the popup on the same click that opens the OS sheet, leaving
   * a menu behind the sheet on a phone.
   */
  function onOpenChange(next: boolean) {
    if (next && prefersNativeShare()) {
      navigator.share({ title, url }).catch(() => {
        // Dismissing the sheet rejects. That is a choice, not a failure — and it
        // must not fall through to opening the popup.
      });
      return;
    }
    setOpen(next);
  }

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm text-site-fg transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <ShinyButton
              icon={<Share2 aria-hidden="true" className="size-5 text-white/80" />}
              ariaLabel="Share this video"
              className={className}
            />
          </PopoverTrigger>
        </TooltipTrigger>
        {/* Site palette restated: the shadcn defaults resolve against the admin
            theme, which is scoped to `.admin-theme` and wrong out here. */}
        <TooltipContent className="border border-white/10 bg-site-surface text-site-fg">
          Share
        </TooltipContent>
      </Tooltip>

      {/*
       * `align="end"` keeps the popup on screen. The button sits at the right
       * edge of the container, so a centred or start-aligned popup would hang
       * off the side — most visibly on a phone.
       */}
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-56 rounded-[16px] border-white/10 bg-site-surface p-1.5 text-site-fg shadow-2xl"
      >
        <button type="button" onClick={copy} className={itemClass}>
          {copied ? (
            <Check aria-hidden="true" className="size-4 text-site-accent" />
          ) : (
            <Link2 aria-hidden="true" className="size-4 text-site-muted" />
          )}
          {copied ? 'Link copied' : 'Copy link'}
        </button>

        {TARGETS.map((target) => (
          <a
            key={target.label}
            href={url ? target.href(url, title) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {/* A neutral mark, not the label's first letter — that read as
                "W WhatsApp". These all open a third-party site in a new tab,
                which is what the icon says. */}
            <ExternalLink aria-hidden="true" className="size-4 text-site-muted" />
            {target.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
