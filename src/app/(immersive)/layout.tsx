import { appConfig } from '@/config/app.config';
import { SiteHeader } from '@/components/layout/SiteHeader';

/**
 * Full-height pages that end at the fold: header, content, and no footer.
 *
 * A route group, so the URL is unaffected — `/shorts` is still `/shorts`. The
 * parentheses exist purely to give these pages a layout of their own.
 *
 * Split from `(public)` rather than hiding the footer from inside the page.
 * Whether a page has a footer is a layout decision, and keeping it one means
 * the footer and everything it fetches are never rendered here at all — which
 * a client-side `usePathname` check inside a shared layout could not achieve.
 */
export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/*
       * Warm the connections the Shorts players need. Measured: the page
       * carried NO resource hints, so every player that mounted paid a fresh
       * DNS lookup and TLS handshake before a frame of video could arrive — a
       * cost repeated on every scroll, not once per visit.
       *
       * The media itself comes from `rr*.googlevideo.com`, a wildcard host that
       * cannot be preconnected, so it gets DNS resolution only.
       *
       * Here rather than in the root layout: these hints are worth their cost
       * only on the page that embeds players.
       */}
      <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="dns-prefetch" href="https://googlevideo.com" />

      <SiteHeader siteName={appConfig.name} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
