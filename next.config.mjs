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
