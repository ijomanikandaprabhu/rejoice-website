import { expect, test, type Page } from '@playwright/test';

import {
  channelsHoverLine,
  contactForm,
  contactPage,
  homeContent,
  musicPage,
  services,
  servicesPage,
} from '../src/config/content.config';

/**
 * End-to-end coverage for the flows listed in section 38.
 *
 * These run against a real database. Before running:
 *   npx prisma migrate dev && npm run seed
 *
 * The YouTube flows (connect channel, import, sync) need a real
 * YOUTUBE_API_KEY and are skipped automatically when it is not set.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@rejoice.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'RejoiceAdmin2026';
/** The short identifier that signs in as an alternative to the email address. */
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? '1975';
const CHANNEL_URL = process.env.E2E_CHANNEL_URL ?? '';

/**
 * Sign in with either identifier — the field takes an email address or a User
 * ID, and both must keep working.
 */
async function login(page: Page, identifier: string = ADMIN_EMAIL) {
  await page.goto('/admin/login');
  /*
   * `exact` on BOTH fields, because `getByLabel` matches on a SUBSTRING.
   *
   * The password field's reveal button is named "Show password", so a loose
   * match there resolves to two elements and fails as ambiguous. The sign-in
   * field is the subtler trap: it used to be labelled "Email", and a loose
   * match for that still finds "Email or User ID" — so this helper would have
   * gone on passing while testing a label that no longer exists.
   */
  await page.getByLabel('Email or User ID', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Generous: the first sign-in of a run pays for the dev server compiling the
  // whole admin route tree, which takes well over the 5s default.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Public website', () => {
  test('every public page renders', async ({ page }) => {
    for (const [path, heading] of [
      // Music's h1 is its headline; "Listen to Rejoice" is the eyebrow.
      ['/songs', musicPage.heading],
      // Services' h1 is its headline, not the word "Services" — the word is the
      // eyebrow above it.
      ['/services', servicesPage.heading],
      // Contact's h1 is its headline too; "Contact us" is the eyebrow.
      ['/contact', contactPage.hero.heading],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }

    /*
     * Channels is checked separately because its h1 is no longer the word
     * "Channels" — it is the hover-effect line, whose letters are individually
     * wrapped and aria-hidden. Asserting the ACCESSIBLE NAME rather than the
     * text is the stronger check here: it is what a screen reader announces,
     * and it would catch the letters leaking through as one long unspaced
     * string. Read from config so the copy and the test cannot drift.
     */
    await page.goto('/creations');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      channelsHoverLine.replace(/\n/g, ' '),
    );

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('admin routes are excluded from robots.txt', async ({ request }) => {
    const res = await request.get('/robots.txt');
    const body = await res.text();

    expect(body).toContain('Disallow: /admin/');
    expect(body).toContain('Disallow: /api/');
  });

  test('the sitemap never lists admin or api routes', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();

    expect(body).not.toContain('/admin');
    expect(body).not.toContain('/api/');
    expect(body).toContain('/songs');
  });

  test('a contact enquiry reaches the admin portal', async ({ page }) => {
    const marker = `E2E enquiry ${Date.now()}`;

    await page.goto('/contact');
    await page.getByLabel('Name', { exact: true }).fill('E2E Tester');
    await page.getByLabel('Email Address').fill('e2e@example.com');
    await page.getByLabel('Tell Us About Your Project').fill(marker);
    await page.getByRole('button', { name: contactForm.submitLabel }).click();

    // Exact, not /message sent/i: the rate-limited response reads "Too many
    // messages sent...", which the loose pattern matched — so a rejected
    // submission passed here and failed further down instead.
    await expect(page.getByText('Message sent. We will reply by email.')).toBeVisible();

    await login(page);
    await page.goto('/admin/enquiries');
    await expect(page.getByText(marker)).toBeVisible();

    // Mark it read, then confirm the status filter reflects it.
    //
    // There are only two states since the Resolved status was dropped, and the
    // per-row label is abbreviated to fit the table column — "Read", not
    // "Mark as read", which is the bulk bar's wording.
    await page.getByRole('button', { name: 'Read', exact: true }).first().click();

    await page.goto('/admin/enquiries?status=READ');
    await expect(page.getByText(marker)).toBeVisible();
  });
});

test.describe('Administrator authentication', () => {
  test('admin requires a session', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('a protected page redirects back after login', async ({ page }) => {
    await page.goto('/admin/enquiries');
    await expect(page).toHaveURL(/\/admin\/login\?from=%2Fadmin%2Fenquiries/);
  });

  test('wrong credentials are rejected without saying which field was wrong', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email or User ID', { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Incorrect email, User ID or password.')).toBeVisible();
  });

  test('an unknown User ID is refused in exactly the same words', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email or User ID', { exact: true }).fill('999999');
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Identical to the wrong-password message above: whether the account
    // exists must not be readable from the response.
    await expect(page.getByText('Incorrect email, User ID or password.')).toBeVisible();
  });

  test('the User ID signs in just as the email does', async ({ page }) => {
    await login(page, ADMIN_USER_ID);
  });

  test('login then logout', async ({ page }) => {
    await login(page);

    // Logout lives behind the avatar menu in the top bar. It is a `menuitem`
    // rather than a `button`: the menu is a real dropdown, and an action inside
    // one takes that role.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('there is no registration page', async ({ page }) => {
    await page.goto('/admin/register');

    // No such route exists, and middleware sends an unauthenticated visitor to
    // the login page rather than revealing whether the route was there at all.
    // Asserting on the status code would only observe the followed redirect.
    await expect(page).toHaveURL(/\/admin\/login/);

    await expect(
      page.getByRole('button', { name: /register|sign up|create account/i }),
    ).toHaveCount(0);
  });
});

test.describe('Website content', () => {
  /*
   * Page copy lives in src/config/content.config.ts, so there is no admin screen
   * to drive. What is still worth asserting is that the config actually reaches
   * the page — that is the wiring which could silently break.
   */
  test('the homepage renders the heading from the config file', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(homeContent.heroHeading);
  });

  test('the services page lists every service in the config', async ({ page }) => {
    await page.goto('/services');
    for (const service of services) {
      // `exact` matters: "Audio Production" is a substring of "AI Audio
      // Production", so a loose match resolves to two headings and fails.
      await expect(page.getByRole('heading', { name: service.title, exact: true })).toBeVisible();
    }
  });

  test('the removed Website Content screen is gone', async ({ page }) => {
    await login(page);
    await page.goto('/admin/website-content');
    await expect(page.getByText(/This page does not exist|404/i).first()).toBeVisible();
  });
});

test.describe('YouTube', () => {
  test.skip(!CHANNEL_URL, 'Set E2E_CHANNEL_URL and YOUTUBE_API_KEY to run the YouTube flows.');

  test('connect a channel, import videos, then show, edit and reset one', async ({ page }) => {
    test.setTimeout(120_000);

    await login(page);
    await page.goto('/admin/youtube-channels');

    await page.getByLabel('Channel URL').fill(CHANNEL_URL);
    await page.getByRole('button', { name: 'Add channel' }).click();
    await expect(page.getByText(/Connected .* and imported its videos/)).toBeVisible({
      timeout: 60_000,
    });

    // Review First is the default, so nothing should be public yet.
    await page.goto('/admin/youtube-content?filter=hidden');
    const firstVideo = page.getByRole('link', { name: 'Edit' }).first();
    await expect(firstVideo).toBeVisible();
    await firstVideo.click();

    // Show it and give it a website title.
    const websiteTitle = `Website title ${Date.now()}`;
    await page.getByLabel('Show on website').check();
    await page.getByLabel('Website title').fill(websiteTitle);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Website display details saved.')).toBeVisible();

    // It is now public under the website title, not the YouTube one. Checked
    // on the channels page: /songs is the platform directory now and lists no
    // videos at all.
    await page.goto('/creations');
    await expect(page.getByText(websiteTitle)).toBeVisible();

    // Reset to YouTube details drops the override.
    await page.goBack();
    await page.getByRole('button', { name: 'Reset to YouTube details' }).click();
    await expect(page.getByText(/Website overrides removed/)).toBeVisible();
    await expect(page.getByLabel('Website title')).toHaveValue('');

    // Hiding it again removes it from the public site.
    await page.getByLabel('Show on website').uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.goto('/creations');
    await expect(page.getByText(websiteTitle)).toHaveCount(0);
  });
});

/**
 * Kept outside the YouTube block on purpose: this needs no API key and no
 * channel, and it guards an endpoint that would otherwise let anyone who found
 * the URL burn the daily YouTube quota. It should run on every pass.
 */
test('the scheduled sync endpoint refuses an unauthenticated request', async ({ request }) => {
  const res = await request.get('/api/youtube/sync');
  expect(res.status()).toBe(401);
});
