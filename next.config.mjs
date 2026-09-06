/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /*
     * Vercel's image optimizer is not used at all.
     *
     * It is metered — roughly 1,000 source images a month on this plan — and
     * the catalogue is about 1,750 videos, so it ran out: every newly imported
     * video and channel logo came back "402 Payment required" and rendered as
     * a broken image, while images processed earlier carried on serving from
     * cache. It would have run out again every month, and sooner each time.
     *
     * `youtubeLoader` instead asks YouTube for a size close to the one being
     * rendered and routes it through `/api/image` on this domain. Nothing in
     * that path is metered, and the Privacy Policy's claim that thumbnails do
     * not reach YouTube stays true.
     *
     * `remotePatterns` is gone with the optimizer: a custom loader does not
     * consult it. The allowlist that matters now lives in the route.
     */
    loader: 'custom',
    loaderFile: './src/lib/images/youtubeLoader.ts',

    /*
     * Trimmed from Next's defaults, which offer eight device widths up to
     * 3840 and eight more small ones.
     *
     * Those widths were sized for an optimizer that would produce a file at
     * any of them. Ours cannot: `youtubeLoader` maps every width onto one of
     * five thumbnail variants YouTube actually publishes, so most of the
     * default entries were several srcset lines pointing at the same image.
     * Worse, the largest of them landed on `maxresdefault` — 135KB — for
     * cards that need `hqdefault` at 17KB.
     *
     * These are the widths that map onto distinct variants and avatar sizes.
     * Fewer entries means fewer cache keys, fewer first-time fetches and much
     * less bandwidth, which is metered separately from the function time.
     */
    deviceSizes: [640, 828, 1280, 1920],
    imageSizes: [48, 96, 176, 240, 384],
  },

  /*
   * The public sections were renamed — Channels became Creations, Music became
   * Songs, About became About Us — and the routes were moved to match, so the
   * address bar says the same word the navigation does.
   *
   * These redirects exist even though the site has never been deployed, so no
   * link to the old paths can exist yet. They are here because a path is a
   * promise: anything written down during development — a bookmark, a note, a
   * link in a message — keeps working, and if the routes are ever renamed again
   * this is where that is handled rather than being rediscovered.
   *
   * `permanent: true` is a 308, which preserves the method and, unlike the bare
   * `permanentRedirect` this codebase hit before, Next carries the query string
   * across automatically. The `:path*` forms cover the nested routes:
   * /channels/{handle}?page=3 lands on /creations/{handle}?page=3.
   */
  /*
   * Response headers, in two groups.
   *
   * ## Security, on everything
   *
   * The site was serving only HSTS, which Vercel adds. These three are the
   * ones with no configuration cost and no way to break a working page:
   *
   *   - `X-Frame-Options: SAMEORIGIN` stops another site putting Rejoice in an
   *     iframe and dressing it up as their own — or overlaying it to harvest
   *     clicks. Nothing here needs to be framed by anyone else. It does NOT
   *     affect this site framing YouTube, which is the other direction.
   *   - `X-Content-Type-Options: nosniff` stops a browser second-guessing a
   *     declared content type. `/api/image` already sets it; this extends the
   *     same rule to everything, including the bytes served from the database
   *     by `/api/media`.
   *   - `Referrer-Policy` sends the full address within this site and only the
   *     bare origin when leaving it, so a YouTube or Spotify link does not
   *     carry the exact page someone came from.
   *
   * DELIBERATELY NOT ADDED: a Content-Security-Policy, and a Permissions-Policy.
   * A CSP has to enumerate everything the page loads — the YouTube player,
   * MapLibre's worker, Vercel's own scripts, inline styles — and one missing
   * entry silently breaks a feature with no error anyone would notice. It is
   * worth doing, with the time to test each page, rather than added blind.
   * Permissions-Policy carries the same risk for the video player, which needs
   * autoplay, fullscreen and encrypted-media.
   *
   * ## Caching, for `public/`
   *
   * These files were served `max-age=0, must-revalidate`. That is not as bad as
   * it looks — they carry an ETag, so a repeat visit gets a 304 and downloads
   * nothing — but it still costs a network ROUND TRIP per file per page load,
   * on every page, to be told nothing changed.
   *
   * One hour of freshness plus a day of `stale-while-revalidate`: within the
   * hour a repeat visit makes no request at all, and for a day after that the
   * cached copy is shown immediately while a fresh one is fetched in the
   * background.
   *
   * NOT a year, and not `immutable`, which is what `/_next/static` gets. Those
   * filenames contain a content hash, so a changed file is a changed name.
   * These do not: replace `logo-wordmark-light.png` and the address is the
   * same, so a year-long cache would show the old logo for a year. An hour is
   * the trade — the round trips go, and a new logo still reaches everyone the
   * same morning.
   */
  async headers() {
    const security = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];

    return [
      { source: '/:path*', headers: security },
      {
        /*
         * The static files in `public/`, by extension. Matching on extension
         * rather than on a folder because they live in several — `/brand`,
         * `/about`, `/media` — and a new folder should not have to be added
         * here to be cached.
         */
        source: '/:path*.(png|jpg|jpeg|webp|avif|svg|ico|mp3|mp4|woff|woff2)',
        headers: [
          ...security,
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/channels', destination: '/creations', permanent: true },
      { source: '/channels/:path*', destination: '/creations/:path*', permanent: true },
      { source: '/music', destination: '/songs', permanent: true },
      { source: '/music/:path*', destination: '/songs/:path*', permanent: true },
      { source: '/about', destination: '/about-us', permanent: true },
    ];
  },
};

export default nextConfig;
