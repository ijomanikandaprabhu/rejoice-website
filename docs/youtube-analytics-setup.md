# YouTube analytics — finishing the connection after deployment

Revenue, watch time, traffic sources and subscriber movement are **built and
tested but not connected**. They need an OAuth connection to the Google account
that owns the channels, and that connection **cannot be made from localhost**.

This is a checklist for the day the site goes live. It also records two dead
ends, so nobody spends another hour rediscovering them.

Everything else on the dashboard — views, subscribers, Most watched, Channels,
Needs attention, Catalogue by year — runs on the API key and is unaffected by
any of this.

---

## Why it could not be done on localhost

**1. Brand accounts cannot be added as test users.**

The Rejoice channels are YouTube *brand accounts*. A brand account has no email
address of its own, so there is no way to put it on the OAuth test-user list.
While the app's publishing status is **Testing**, choosing the brand account at
the Google sign-in screen returns:

```
Error 403: access_denied
… can only be accessed by developer-approved testers
```

Adding `rejoicegospelcommunications@gmail.com` as a test user does work — but
it authorises the *Gmail identity*, not the brand channel, so it does not help.

**2. Publishing the app requires a public domain.**

Publishing an *External* app needs an Application home page, a privacy policy
link and a terms of service link, all on a verified domain. Google does not
accept `localhost`. Until those are filled the **Publish app** button on the
Audience page stays greyed out, with the banner *"Your app's OAuth
configuration is incomplete."*

Removing the app logo was tried — the logo does force verification, but
removing it did **not** unblock the button. The three URL fields are the real
requirement.

---

## Deployment-day checklist

Everything below is in [Google Auth Platform](https://console.cloud.google.com/auth/overview),
signed in as the account that owns the Google Cloud project.

### 1. Confirm the OAuth client still exists

Go to **Clients**. During setup the client was deleted at one point and the
list read *"No OAuth clients to display"*.

- If a client is listed, note its Client ID.
- If the list is empty, click **Restore deleted OAuth clients**, or create a new
  one (type **Web application**).

If a new client is created, its ID and secret must replace the values in `.env`.

### 2. Add the live redirect URI

On the client, under **Authorised redirect URIs**, add:

```
https://<your-domain>/api/youtube/oauth/callback
```

The path comes from `oauth.callbackPath` in `src/config/youtube.config.ts` —
check there rather than trusting this line, in case it has moved. It must match
character for character: no trailing slash, `https` for the live site.

Keep the `http://localhost:3000/...` entry as well if local testing is still
wanted.

### 3. Fill in Branding

**Branding** page — these are what unblock publishing:

| Field | Value |
|---|---|
| Application home page | `https://<your-domain>` |
| Application privacy policy link | `https://<your-domain>/privacy` |
| Application terms of service link | `https://<your-domain>/terms` |
| Authorized domains | `<your-domain>` |

The privacy and terms pages **must actually exist and be publicly reachable**.
The site does not currently have them; they will need writing.

### 4. Publish

**Audience** page → **Publish app** → **Confirm**. Publishing status should read
**In production**.

### 5. Connect

Admin → Settings → **YouTube analytics** → **Connect Google account**.

- Choose the **Rejoice Gospel Communications** brand account — *not* the plain
  `rejoicegospelcommunications@gmail.com` entry above it.
- On "Google hasn't verified this app": **Advanced → Go to Rejoice Admin
  (unsafe)**. Expected — the app is unlisted, not unsafe.
- **Tick every permission**, including the monetary/earnings one. Declining it
  leaves everything else working and revenue permanently empty; the Settings
  card will show *Revenue access: Not granted*.

### 6. Rotate the client secret

The secret created during setup was pasted into a chat transcript as a
screenshot. On the client, click **+ ADD SECRET**, put the new value in `.env`,
and delete the old one.

---

## Known limitation: one channel per connection

`analyticsService.ts` queries `ids=channel==MINE`, which resolves to whichever
channel the token was issued for. **One connection therefore covers one
channel.**

| Channel | Videos | Views | Covered by one connection? |
|---|---|---|---|
| Rejoice Gospel Communications | 1,656 | 74.8M | Yes — connect as this one |
| Rejoice Gospel Music | 93 | 2.1M | No |

So revenue and watch time will describe ~97% of views but not all of them. The
public-statistics panels (views, subscribers, Most watched, Channels) already
cover **both** channels and are unaffected.

Covering both would mean storing one token per channel rather than a single
`YouTubeOAuthToken` row, and fanning out the report calls. That is a real
change and has not been made.

---

## What is already in place

| Piece | Where |
|---|---|
| Analytics API client, token refresh, report caching | `src/services/youtube/analyticsService.ts` |
| Consent redirect (CSRF state, `access_type=offline`) | `src/app/api/youtube/oauth/route.ts` |
| Token exchange and encrypted storage | `src/app/api/youtube/oauth/callback/route.ts` |
| AES-256-GCM encryption for the refresh token | `src/lib/utils/secretBox.ts` (+ `tests/secretBox.test.ts`) |
| Scopes, callback path, cache TTL | `src/config/youtube.config.ts` |
| Connect / disconnect UI | `src/app/admin/settings/page.tsx` |
| Revenue and traffic panels | `src/components/admin/RevenueChart.tsx`, `TrafficSources.tsx` |

Failure states are deliberate, not bugs: not configured, not connected, not
monetised (403 on the revenue report), and stale-cache-after-a-failed-refresh
each render their own message. Revenue legitimately returns nothing if the
channels are not in the YouTube Partner Programme.
