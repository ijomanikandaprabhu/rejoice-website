# Rejoice Website

Gospel music label and video production website for **Rejoice**, with an administrator
portal and automatic YouTube synchronization across five channels.

Built to the specification in
[`Rejoice Website — Next.js Architecture & Standards.md`](./Rejoice%20Website%20—%20Next.js%20Architecture%20&%20Standards.md).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma ·
Auth.js v5 · Zod · YouTube Data API v3

---

## The core idea

Rejoice uploads videos to YouTube. The website never re-uploads them. Instead:

```
YouTube  →  synchronization  →  Rejoice database  →  Rejoice website
```

The database stores the video's *information*, not the video file. Public pages read only
from the database — the YouTube API is never called on a visitor request.

Every video has two sets of values: the imported `youtube*` fields, and the
administrator's `display*` overrides. The website shows the override when one exists and
falls back to the YouTube value otherwise. **A sync refreshes the `youtube*` fields and
never touches the overrides**, so renaming a video on YouTube cannot undo the
administrator's work.

---

## Getting started

### 1. Database

Any PostgreSQL 13+ instance works — local, Neon, Supabase, or Railway. Put its connection
string in `DATABASE_URL`.

**No PostgreSQL installed?** The repo ships one. `npm run db:start` launches a real
PostgreSQL server from the `embedded-postgres` dev dependency on port 5432, matching the
`DATABASE_URL` already in `.env`. Leave it running in its own terminal; `npm run db:stop`
shuts it down. Data lives in `.pgdata/` (gitignored) — delete that folder for a clean
slate. This is for local development only; production points `DATABASE_URL` at a real
managed database.

### 2. Environment

`.env` is already created with generated secrets. Open it and set `DATABASE_URL` to your
database. `.env.example` documents every variable.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Signs the session cookie (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | yes | Site origin, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for canonical URLs and the sitemap |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed only | Creates the one administrator account |
| `YOUTUBE_API_KEY` | for sync | YouTube Data API v3 key, server-side only |
| `YOUTUBE_WEBHOOK_SECRET` | required for push | Verifies WebSub push notifications. Without it the webhook rejects everything |
| `CRON_SECRET` | yes | Protects `/api/youtube/sync` |

### 3. Install, migrate, seed, run

```bash
npm install && npx prisma migrate dev --name init && npm run seed && npm run dev
```

Then open <http://localhost:3000> and sign in at <http://localhost:3000/admin> with the
`ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. **Change that password immediately** under
Admin → Settings → Administrator.

---

## Getting a YouTube API key

The site runs fine without one — you simply cannot connect channels or import videos until
it is set.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project
   (for example, "Rejoice Website").
2. **APIs & Services → Library →** search for **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Click **Edit API key** and under **API restrictions** choose **Restrict key**, then
   select only *YouTube Data API v3*. Leave *Application restrictions* set to **None** —
   the key is used from the server, not a browser, so an HTTP-referrer restriction would
   break it.
5. Copy the key into `YOUTUBE_API_KEY` in `.env` and restart the dev server.

The key is read only on the server and is never sent to the browser. Rejoice never needs
the YouTube account password — only this key.

### Connecting the five channels

Admin → YouTube Channels → paste each channel URL, e.g.
`https://www.youtube.com/@RejoiceGospelCommunications`. The backend resolves it to the
permanent channel ID and imports the back catalogue immediately.

Leave **New videos** on **Review first** (the recommended default): videos are imported but
stay hidden until you click Show.

---

## How synchronization works

Two mechanisms, both ending in the same `syncChannel` code path:

**Primary — push.** YouTube WebSub notifies `/api/youtube/webhook` the moment a channel
publishes. Requires a public HTTPS URL, so it only works after deploy. To subscribe, POST
to `https://pubsubhubbub.appspot.com/subscribe` with
`hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=<CHANNEL_ID>`,
`hub.callback=https://your-domain/api/youtube/webhook`, `hub.mode=subscribe` and your
`YOUTUBE_WEBHOOK_SECRET`. Subscriptions expire after ~5 days and must be renewed.

The endpoint is **closed by default**: with no `YOUTUBE_WEBHOOK_SECRET` set it answers `401` to
every request, and it only accepts `sha1` signatures. That is deliberate — each accepted
notification triggers live YouTube API calls, so an open endpoint would let anyone exhaust the
daily quota and stop synchronization.

**Backup — schedule.** `vercel.json` runs `/api/youtube/sync` **once a day at 6:00 pm IST**.

Cron runs in UTC, and IST is UTC+5:30, so the expression is `30 12 * * *` — 12:30 UTC.
India does not observe daylight saving, so this stays correct all year. To move the
schedule, change it in **both** `vercel.json` and `scheduleCron` in
`src/config/youtube.config.ts`, and update `scheduleLabel` beside it so the admin portal
keeps telling the truth.

The run compares YouTube video IDs and imports only what is missing. Anything it misses
can be pulled in immediately with **Sync now** on any channel, which does a deeper sweep
(2,000 videos) than the scheduled run (300).

On other hosts, point any scheduler at the same URL:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/youtube/sync
```

The endpoint returns 401 without that header, and refuses to run at all if `CRON_SECRET`
is unset.

If one channel fails, the others still sync. Failures are recorded per channel and shown on
the dashboard; `lastSyncedAt` is only stamped on success.

---

## Project structure

```
src/
  app/(public)/       Public pages — Server Components, database only
  app/admin/          Admin portal, guarded by middleware.ts
  app/api/            contact · youtube/sync · youtube/webhook · auth
  features/           Server actions and queries, grouped by feature
  services/youtube/   youtubeClient · channelService · videoSyncService
  components/         ui · layout · youtube · admin · common
  lib/                db · auth · validation · utils · logger · seo
  config/             app · youtube · seo · content
prisma/               schema.prisma · seed.ts
tests/                Vitest unit tests
e2e/                  Playwright end-to-end tests
```

Two rules keep this maintainable:

- `app/` holds routing and page composition. Logic lives in `features/`, `services/`, `lib/`.
- **No React component calls the YouTube API.** The flow is always
  `UI → server action / route handler → feature service → youtubeClient → YouTube`.

Anything shared has exactly one home: the display fallback in
`lib/utils/videoDisplay.ts`, metadata in `lib/seo.ts`, rate limiting in
`lib/utils/rateLimit.ts`, navigation in `config/app.config.ts`.

---

## Editing page copy

The text on the public pages — the homepage, About, the Contact intro, the services list
and the social links — lives in **`src/config/content.config.ts`**, not in the database.
Change it there and redeploy.

There is deliberately no Website Content admin screen. The copy changes rarely and is
edited by whoever is already working on the code, so a CMS for it would have cost a table,
a set of server actions and a database round-trip on every page load for no real benefit.

What *is* still editable at runtime, because it changes without a developer:

| In the admin | Where |
| --- | --- |
| Contact email, phone, address | Settings → General |
| Default SEO title / description / share image | Settings → SEO |
| Which videos are public, and their display details | YouTube Content |
| Video categories (the Music page filters) | YouTube Content |
| Channels and sync | YouTube Channels |
| Enquiries | Enquiries |

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run db:start` | Start the bundled local PostgreSQL (dev only) |
| `npm run db:stop` | Stop it |
| `npm run build` | `prisma generate` then a production build |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:studio` | Browse the database |
| `npm run seed` | Create the administrator, categories and starter services |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |

| `npm run lint` | ESLint |
| `npm run format` | Prettier |

`npm run build` needs `DATABASE_URL` to be reachable — the public pages are pre-rendered
from the database at build time.

### End-to-end tests

```bash
npx playwright install chromium && npm run test:e2e
```

They need the database running (`npm run db:start`) and a seeded admin. Playwright starts
its own dev server, or reuses one already on port 3000.

The tests write to the database — an enquiry, and the homepage hero heading. Run them
against a development database, never production.

The YouTube flow (connect a channel, import, show, edit, reset) is skipped unless you
provide real credentials:

```bash
YOUTUBE_API_KEY=... E2E_CHANNEL_URL=https://www.youtube.com/@YourChannel npm run test:e2e
```

---

## Security

- All `/admin/*` routes are blocked by `middleware.ts`; every server action independently
  calls `requireAdmin()`.
- Passwords are bcrypt-hashed (cost 12) and never stored or logged in plain text.
- Sessions are HTTP-only JWT cookies with an 8-hour expiry.
- Login and the contact form are rate-limited per IP; the contact form also has a honeypot.
- Every form and API payload is validated with Zod on the server.
- The YouTube API key stays server-side. There is no registration page and only one account.
- `/admin` and `/api` are excluded from `robots.txt` and the sitemap, and admin pages send
  `noindex`.

---

## Deploying

1. Provision PostgreSQL and set every variable from `.env.example` in the host's
   environment. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the real domain.
2. Deploy. `npm run build` runs `prisma generate` automatically.
3. Run `npx prisma migrate deploy` against production, then `npm run seed` once.
4. Sign in and change the administrator password.
5. Confirm the cron is running (Vercel picks up `vercel.json` automatically), then
   subscribe each channel to WebSub for instant detection.
