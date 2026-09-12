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
    /*
     * Present, not clicked. Clicking opens wa.me, and a suite that depends on a
     * third-party site being up and keeping its markup is a suite that goes red
     * for reasons that have nothing to do with this project. What the button
     * builds is covered in `tests/whatsapp.test.ts`.
     */
    await expect(page.getByRole('button', { name: contactForm.whatsappLabel })).toBeVisible();

    await page.getByRole('button', { name: contactForm.submitLabel }).click();

    /*
     * Exact, not /message sent/i: the rate-limited response reads "Too many
     * messages sent...", which the loose pattern matched — so a rejected
     * submission passed here and failed further down instead.
     *
     * The generous timeout is NOT papering over a slow site, and it is worth
     * saying why, because Playwright's 5s default sat right on the line and this
     * test failed intermittently for days while being blamed on cold compiles
     * and rate limits in turn. Measured locally: 3.7s, 4.5s, 4.9s.
     *
     * The cause is structural. In production the route answers before the email
     * is sent — 0.2s measured live — because the platform keeps the function
     * alive to finish the send afterwards. No local server offers that, so
     * `runAfterResponse` deliberately falls back to awaiting Gmail, and the
     * local response carries the full SMTP round trip that a real visitor never
     * waits for. The 5s default was therefore timing a code path that does not
     * exist on the live site.
     *
     * This assertion is about the visitor being told their message went through.
     * The speed of it is measured against the live site, not here.
     */
    await expect(page.getByText('Message sent. We will reply by email.')).toBeVisible({
      timeout: 20_000,
    });

    await login(page);
    await page.goto('/admin/enquiries');
    await expect(page.getByText(marker)).toBeVisible();

    /*
     * Mark it read, then confirm the status filter reflects it.
     *
     * There are only two states since the Resolved status was dropped, and the
     * per-row label is abbreviated to fit the table column — "Read", not
     * "Mark as read", which is the bulk bar's wording.
     *
     * Scoped to THIS enquiry's row, not `.first()`. `.first()` is whichever row
     * the table happens to put at the top, which is only the new one while the
     * table holds nothing else. It marked a different enquiry read as soon as
     * anything else was present — including this test's own leavings from an
     * earlier run — and then failed below looking for a marker it had never
     * touched. That is the intermittent failure here, and it is not timing.
     */
    const enquiryRow = page.getByRole('row').filter({ hasText: marker });
    await enquiryRow.getByRole('button', { name: 'Read', exact: true }).click();

    /*
     * Wait for the row to actually change before navigating.
     *
     * Clicking posts a server action; going straight to the filtered URL raced
     * it and arrived before the write had landed, so the enquiry was still NEW
     * and the assertion below failed on a marker that was about to be correct.
     * The button flipping to "Unread" is the row confirming the new state, and
     * it is the state the next line depends on.
     */
    await expect(enquiryRow.getByRole('button', { name: 'Unread', exact: true })).toBeVisible();

    await page.goto('/admin/enquiries?status=READ');
    await expect(page.getByText(marker)).toBeVisible();

    /*
     * Delete it again, and this is not tidiness.
     *
     * This test posts a REAL enquiry through the real route every time it runs:
     * a row in the database and an email to the owner's actual inbox. Without
     * this it left both behind on every pass, forever — 41 rows had built up
     * before anyone counted, from four days of runs.
     *
     * The email cannot be recalled, so the row is the part that can be cleaned
     * up, and deleting through the UI rather than the database means the suite
     * keeps needing nothing but a browser — and exercises the delete button on
     * the way past, which nothing else covered.
     */
    const row = page.getByRole('row').filter({ hasText: marker });
    await row.getByRole('button', { name: 'Delete enquiry' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(marker)).toHaveCount(0);

    /*
     * The delete must SAY so. Every other admin action toasts; delete is the
     * one that cannot be undone, and it was the one saying nothing — the toast
     * was fired from an effect inside the row being removed, so the component
     * carrying it unmounted before the effect could run.
     */
    await expect(page.getByText('Enquiry deleted.')).toBeVisible();
  });
});

test.describe('Cover art', () => {
  /*
   * Dropping a file on the cover square, which did nothing until it was asked
   * for — the frame was click-only, and every other image box on the web takes
   * a drag.
   *
   * Driven through a real `DataTransfer` because the two things most likely to
   * break here cannot be reached any other way: `dragover` must be cancelled or
   * the drop never fires at all, and a dropped file bypasses the input's
   * `accept`, so the type check has to be its own code rather than an
   * attribute.
   */
  const dropOnCover = async (page: Page, name: string, type: string, bytes: string) => {
    await page.evaluate(
      async ({ name, type, bytes }) => {
        const frame = [...document.querySelectorAll('button')].find((b) =>
          /cover art/i.test(b.getAttribute('aria-label') ?? ''),
        );
        if (!frame) throw new Error('cover frame not found');

        let file: File;
        if (type.startsWith('image/')) {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 400;
          canvas.getContext('2d')!.fillRect(0, 0, 400, 400);
          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type));
          file = new File([blob!], name, { type });
        } else {
          file = new File([new Blob([bytes], { type })], name, { type });
        }

        const data = new DataTransfer();
        data.items.add(file);
        frame.dispatchEvent(
          new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
        );
        frame.dispatchEvent(
          new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      },
      { name, type, bytes },
    );
  };

  /*
   * Dispatched until it lands, rather than once.
   *
   * A synthetic drop is delivered to the DOM node whether or not React has
   * attached its handlers yet, so on a cold dev compile the event is simply
   * swallowed and the test fails against working code. Waiting on a timer would
   * be guessing; retrying until the preview appears is asking the app.
   */
  const dropUntilItLands = async (page: Page, name: string, type: string) => {
    const preview = page.getByRole('button', { name: /cover art/i }).locator('img');
    await expect(async () => {
      await dropOnCover(page, name, type, '');
      await expect(preview).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    return preview;
  };

  test('a dropped image becomes the cover', async ({ page }) => {
    await login(page);
    await page.goto('/admin/songs/new');

    // The downscale runs in the browser, so the proof is the preview and the
    // size it reports — not merely that a handler fired.
    await dropUntilItLands(page, 'cover.png', 'image/png');
    await expect(page.getByText(/Ready to upload/)).toBeVisible();
  });

  test('a dropped file that is not an image is refused, and the cover is left alone', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/admin/songs/new');

    const preview = await dropUntilItLands(page, 'cover.png', 'image/png');

    await dropOnCover(page, 'invoice.pdf', 'application/pdf', '%PDF-1.4');

    await expect(page.getByText('That is not a PNG, JPEG or WebP image.')).toBeVisible();
    /*
     * The half of this that actually shipped broken: the refusal cleared the
     * PREVIEW while leaving the file inputs loaded, so the screen said "no
     * cover" over a form that would still have submitted one.
     */
    await expect(preview).toBeVisible();
  });
});

test.describe('Notifications', () => {
  /*
   * The bin at the end of a notification row shipped with no confirmation, on
   * the argument that a notification is only a note. That reasoning covers the
   * consequence and not the control: it is an icon repeated down a list people
   * scroll and click through, with no undo, while the bulk bar beside it asked
   * before removing a selection. One click quietly did what four could not.
   *
   * Tested through the DIALOG rather than the row count, because the row count
   * alone cannot tell "the confirmation worked" from "the click missed".
   */
  test('deleting one notification asks first', async ({ page }) => {
    await login(page);
    await page.goto('/admin/notifications');

    const bin = page.getByRole('button', { name: 'Delete notification' }).first();
    // An environment with no notifications has nothing to guard; the suite's
    // enquiry test creates one, but it does not run in every project.
    test.skip((await bin.count()) === 0, 'no notifications to delete');

    const rowsBefore = await page.getByRole('button', { name: 'Delete notification' }).count();

    await bin.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This removes the notification permanently.');

    // Cancel must leave the list exactly as it was.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Delete notification' })).toHaveCount(rowsBefore);

    // Confirming removes one, and only one.
    await page.getByRole('button', { name: 'Delete notification' }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('button', { name: 'Delete notification' })).toHaveCount(
      rowsBefore - 1,
    );
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

/**
 * Social links: the icon upload.
 *
 * Both halves of a reported fault. An icon was chosen for a row whose Name was
 * left empty; the row was dropped without a word and the form still said
 * "Social links saved.", so the upload looked like it had worked and the icon
 * never reached the site.
 */
test.describe('Social links', () => {
  /* Deliberately minimal, and a real SVG: it has to survive `sanitizeSvg`. */
  const ICON = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
  );

  test('an icon chosen for a nameless row is refused, not silently dropped', async ({ page }) => {
    await login(page);
    await page.goto('/admin/settings');

    // The spare row at the bottom is the one for adding a link. Its file input
    // is the last of them.
    const iconInputs = page.locator('input[type="file"][name$=".icon"]');
    await iconInputs.last().setInputFiles({
      name: 'test-icon.svg',
      mimeType: 'image/svg+xml',
      buffer: ICON,
    });

    // The preview must show the chosen file BEFORE saving — this is what was
    // missing, and why a wrong or ignored file could not be spotted.
    const preview = page.locator('img[src^="data:image/svg+xml"]').last();
    await expect(preview).toBeVisible();

    // Name left empty on purpose. This must not report success.
    await page.getByRole('button', { name: 'Save social links' }).click();

    await expect(page.getByText('Give this link a name, such as WhatsApp.')).toBeVisible();
    await expect(page.getByText('Social links saved.')).toHaveCount(0);
  });

  test('a completely empty row is still dropped without complaint', async ({ page }) => {
    await login(page);
    await page.goto('/admin/settings');

    // Touch nothing: the spare row is empty, and saving must simply succeed.
    await page.getByRole('button', { name: 'Save social links' }).click();

    await expect(page.getByText('Social links saved.')).toBeVisible();
    await expect(page.getByText('Give this link a name, such as WhatsApp.')).toHaveCount(0);
  });
});
