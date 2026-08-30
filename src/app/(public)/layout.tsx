import { SiteLoader } from '@/components/site/SiteLoader';
import { appConfig } from '@/config/app.config';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BackToTop } from '@/components/site/BackToTop';
import { TextReveal } from '@/components/site/TextReveal';
import { CinematicFooter } from '@/components/ui/motion-footer';
import { getContactDetails } from '@/features/content/queries';
import { getActiveChannelNames } from '@/features/youtube/queries';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  /*
   * `getGeneralSettings()` used to be fetched here too, purely for the site
   * name. That is `appConfig.name` now — the Settings screen no longer offers a
   * Website name field — so this page does one fewer database read per request.
   */
  const [contact, channelNames] = await Promise.all([
    getContactDetails(),
    // The footer marquee names the live channels, so adding one in the admin
    // puts it on the strip without a code change.
    getActiveChannelNames(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      {/*
       * The one thing a loading screen must never do is hide the site.
       *
       * `SiteLoader` is a client component, so its "holding" state is in the
       * SERVED HTML. With JavaScript off nothing would ever clear it and the
       * whole public site would sit behind a panel that cannot be dismissed.
       * This removes it outright in that case — the alternative, rendering
       * nothing until mount, trades the risk for a visible flash of the page
       * before the loader appears.
       */}
      {/*
        `dangerouslySetInnerHTML`, not a nested `<style>` element.
        
        With JavaScript ON the browser parses `<noscript>`'s contents as TEXT,
        never as elements — so a JSX `<style>` child renders on the server and
        finds a text node on the client. That mismatch threw React error #423 in
        production, hydration bailed out, and the page ended on "Application
        error: a client-side exception has occurred". Raw HTML is the documented
        way to put markup inside `<noscript>`.
      */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: '<style>[data-site-loader]{display:none!important}</style>',
        }}
      />
      <SiteLoader />
      <SiteHeader siteName={appConfig.name} />
      <main className="flex-1">{children}</main>

      {/* Renders nothing: it fades and lifts the headings and paragraphs inside
          `main` as they scroll in. Scoped to `main`, so the header, the footer
          (which runs its own GSAP reveal) and the card titles are all out of
          reach by construction. */}
      <TextReveal />
      <CinematicFooter
        contact={contact}
        siteName={appConfig.name}
        marqueeWords={channelNames}
      />

      {/* Outside `main`: it is fixed to the viewport and belongs to the page
          chrome, not to any one page's content. */}
      <BackToTop />
    </div>
  );
}
