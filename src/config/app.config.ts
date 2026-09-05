/**
 * Central application configuration.
 *
 * Navigation lives here so the public header, footer, admin sidebar and sitemap
 * all derive from a single source (DRY, section 3.2).
 */

export const appConfig = {
  name: 'Rejoice',
  tagline: 'Gospel Music & Video Production',
  description:
    'Rejoice is a gospel music label and video production company creating worship music, live recordings and professional video production.',
  /*
   * `?.trim() ||` rather than `??`.
   *
   * `??` only falls back on undefined, so a variable that EXISTS but is empty
   * — the normal state of a hosting dashboard row someone added without a
   * value — passed an empty string straight through to `new URL(path, '')` in
   * `absoluteUrl`, which throws ERR_INVALID_URL and fails the production build
   * while collecting page data. An empty setting means "not configured", the
   * same as an absent one.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000',
} as const;

export type NavItem = { label: string; href: string };

/** Public site navigation (section 42). */
export const publicNav: readonly NavItem[] = [
  /*
   * ORDER MATTERS: the footers render this list as-is, so it is what they show.
   * It is `SiteHeader`'s LEFT_HREFS followed by its RIGHT_HREFS — the header
   * composes its own order from those two groups to sit either side of the
   * centred logo, and keeping the array in step means header and footer read
   * the same rather than quietly differing, as they did before.
   *
   * The labels are the public names; the hrefs are the routes and deliberately
   * unchanged, so nothing already linked or indexed breaks.
   */
  { label: 'Home', href: '/' },
  { label: 'Creations', href: '/creations' },
  { label: 'Songs', href: '/songs' },
  { label: 'Services', href: '/services' },
  { label: 'About Us', href: '/about-us' },
  { label: 'Contact', href: '/contact' },
] as const;

/** Admin navigation (section 41). */
export const adminNav: readonly NavItem[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'YouTube Channels', href: '/admin/youtube-channels' },
  { label: 'YouTube Content', href: '/admin/youtube-content' },
  { label: 'Songs', href: '/admin/songs' },
  { label: 'Enquiries', href: '/admin/enquiries' },
  { label: 'Settings', href: '/admin/settings' },
] as const;

/** Session lifetime for the administrator cookie, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

/** Rate limits (section 37). */
export const rateLimits = {
  login: { limit: 5, windowMs: 5 * 60_000 },
  contact: { limit: 5, windowMs: 15 * 60_000 },
  /**
   * The WebSub push endpoint. Generous, because a busy channel legitimately
   * bursts — it is a backstop against a flood, not a per-caller quota, and the
   * HMAC check is the real gate.
   */
  webhook: { limit: 60, windowMs: 60_000 },
  /**
   * Credential changes from inside an authenticated session. Both verify the
   * current password with bcrypt, so without a cap a stolen session can guess it
   * unbounded — and each attempt costs a 12-round hash on the server.
   */
  credentials: { limit: 5, windowMs: 15 * 60_000 },
} as const;

/** Page sizes. */
export const pageSizes = {
  music: 12,
  /** Dedicated channel page: three columns by ten rows. */
  channel: 30,
  adminVideos: 25,
  adminEnquiries: 25,
} as const;
