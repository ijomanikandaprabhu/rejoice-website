/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
    ],
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
