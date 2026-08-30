'use client';

import { ShareButton } from '@/components/site/ShareButton';
import { ShinyButton, type ShinyButtonVariant } from '@/components/ui/shiny-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { svgToDataUri } from '@/lib/utils/svg';

/**
 * The social row: one button per account, plus share.
 *
 * Accounts and icons come from Admin → Settings, so adding a platform is an
 * upload rather than a code change.
 */

export type SocialButtonLink = { id: string; label: string; url: string; svg: string };

/**
 * Brand colours for the accounts Rejoice has today, keyed by the setting's id.
 *
 * Only a tint on the button's glass and glow — the icon itself is whatever was
 * uploaded. Anything not listed gets the neutral treatment, so a new platform
 * looks deliberate rather than broken.
 */
const VARIANTS: Record<string, ShinyButtonVariant> = {
  youtube: 'red',
  facebook: 'blue',
  instagram: 'pink',
  twitter: 'indigo',
  x: 'indigo',
  spotify: 'green',
};

function SocialIcon({ link }: { link: SocialButtonLink }) {
  if (!link.svg) {
    // No icon uploaded yet: the first letters keep the button usable instead of
    // rendering an empty circle.
    return (
      <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
        {link.label.slice(0, 2)}
      </span>
    );
  }

  /*
   * An `<img>`, deliberately — NOT the SVG inlined into the page.
   *
   * Uploaded SVGs are sanitised on the way in, but an `<img>` is the guarantee
   * rather than the hope: a browser never executes script inside one, so even a
   * construct the sanitiser missed is inert here. See src/lib/utils/svg.ts.
   *
   * next/image is not used because the source is a data URI, which it cannot
   * optimise, and the file is already only a few KB.
   */
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={svgToDataUri(link.svg)} alt="" aria-hidden="true" className="size-5" />;
}

export function SocialButtons({
  links,
  shareTitle,
}: {
  links: SocialButtonLink[];
  /**
   * Supplying this adds a share button after the accounts. Omitted on the
   * contact page: there is nothing to share from a details tile.
   */
  shareTitle?: string;
}) {
  // A link with no URL would be a button that goes nowhere — the same rule the
  // footer already applies.
  const usable = links.filter((link) => link.url.length > 0);

  return (
    /*
     * One provider for the whole row rather than one per button — Radix needs a
     * provider ancestor, and sharing it also shares the open/close timing, so
     * moving along the row does not re-trigger the opening delay each time.
     */
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-3">
        {usable.map((link) => (
          <Tooltip key={link.id}>
            <TooltipTrigger asChild>
              <ShinyButton
                as="a"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                variant={VARIANTS[link.id] ?? 'default'}
                icon={<SocialIcon link={link} />}
                // The tooltip is a convenience; this is the accessible name, so
                // a screen reader never depends on a hover-only affordance.
                ariaLabel={`Rejoice on ${link.label} (opens in a new tab)`}
              />
            </TooltipTrigger>
            {/* Site palette restated: shadcn's defaults resolve against the
                admin theme, which is scoped to `.admin-theme`. */}
            <TooltipContent className="border border-white/10 bg-site-surface text-site-fg">
              {link.label}
            </TooltipContent>
          </Tooltip>
        ))}

        {shareTitle ? <ShareButton title={shareTitle} /> : null}
      </div>
    </TooltipProvider>
  );
}
