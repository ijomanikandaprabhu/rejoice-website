import { ChannelAvatarLink } from '@/components/admin/ChannelAvatarLink';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Pick a channel by its logo, beside the type tabs on the content table.
 *
 * These write the SAME `channel` query param the filter dropdown uses, so the two
 * are views of one value and cannot disagree — choose a logo and the dropdown
 * updates to match. That is why no precedence rule is needed here, unlike the
 * Videos/Shorts toggle.
 *
 * The circles are borrowed from the public ChannelSpotlight; the palette is not.
 * Active state uses the admin's lime `panel-accent`, not the site's ember glow.
 *
 * There is deliberately no "All channels" entry here: clicking the ACTIVE logo
 * clears the filter instead, which is why its href points at the unfiltered URL.
 * That is the only way back to all channels from this row, so do not "fix" the
 * active link to be inert — doing so strands the operator on one channel.
 *
 * This stays a SERVER component: the page hands it `buildHref`, and a function
 * cannot cross into a Client Component. Each avatar's tooltip therefore lives in
 * `ChannelAvatarLink`, which receives only the resolved href and strings.
 */

export type AvatarChannel = { id: string; name: string; thumbnail: string | null };

export function ChannelAvatars({
  channels,
  current,
  buildHref,
}: {
  channels: AvatarChannel[];
  /** The selected channel id, or undefined for all. */
  current: string | undefined;
  buildHref: (channelId: string | undefined) => string;
}) {
  if (channels.length === 0) return null;

  return (
    /*
     * One provider for the row, so the tooltips share their open/close timing
     * and moving between avatars does not re-pay the opening delay.
     *
     * The old `title={channel.name}` is gone: leaving it would fire the native
     * OS tooltip a second after the styled one, stacked on top of it.
     */
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by channel">
        {channels.map((channel) => {
          const active = channel.id === current;

          return (
            <ChannelAvatarLink
              key={channel.id}
              href={buildHref(active ? undefined : channel.id)}
              name={channel.name}
              thumbnail={channel.thumbnail}
              active={active}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}
