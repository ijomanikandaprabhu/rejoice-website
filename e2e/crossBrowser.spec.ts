import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The public site, in every engine.
 *
 * ## Why this exists separately from `rejoice.spec.ts`
 *
 * That suite signs in, submits an enquiry and imports channels — it writes to
 * the database, so it stays on chromium (see `playwright.config.ts`). This one
 * is READ-ONLY by construction: navigations, reads of computed style and
 * geometry, and synthetic scrolling on a rail. Nothing here needs a seeded
 * admin, a YouTube key, or a particular amount of content, which is what lets
 * it run six times over without leaving a trace.
 *
 * ## What it is actually watching for
 *
 * The rails were rebuilt so that below 640px they are real scroll containers
 * driven by a `requestAnimationFrame` loop (`site/RailAutoScroll.tsx`), while
 * `sm:` and up keeps a CSS transform marquee. That change rests on the handful
 * of behaviours engines genuinely disagree about — `scrollLeft` pixel snapping,
 * scrollbar hiding, `overscroll-behavior`, what counts as an animation — and it
 * was verified in exactly one of them. This is the check that was missing.
 */

/**
 * Console noise this project has already decided to live with.
 *
 * The image loader is custom (`next.config.mjs`), and Next warns once per image
 * that it does not implement `width`. An unfiltered console assertion would fail
 * on every page over it, and a check that always fails gets deleted within a
 * day — so it is named here rather than quietly weakening the assertion.
 */
const IGNORED_CONSOLE = [/has a "loader" property that does not implement width/];

/** Aborted requests are ordinary navigation debris, not failures. */
const ABORTED = /ABORTED/i;

/**
 * Collects anything the page complains about, for assertion at the end.
 *
 * Attached before the first navigation, because an error thrown during hydration
 * is exactly the kind this is here to catch and it fires early.
 */
function watchForProblems(page: Page) {
  const problems: string[] = [];

  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    problems.push(`console.error: ${text}`);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (ABORTED.test(failure)) return;
    if (!['image', 'font', 'stylesheet', 'script'].includes(request.resourceType())) return;
    problems.push(`requestfailed ${request.resourceType()}: ${request.url()} — ${failure}`);
  });

  return problems;
}

/**
 * Wait for the loading screen to let go before measuring anything.
 *
 * `SiteLoader` puts `data-loading` on the document and holds it for `HOLD_MS`
 * (1s), ceiling `MAX_MS` (4s), plus a 420ms fade. The rail's drift loop
 * early-returns for that entire time, deliberately — so measuring before it
 * clears reports "the rail never moved" about code that is working perfectly.
 * This is the single most likely way for this file to lie.
 *
 * `TextReveal.tsx` waits on the same attribute for the same reason.
 */
async function settled(page: Page) {
  await page
    .locator('html')
    .waitFor({ state: 'attached' })
    .catch(() => {});
  await expect(page.locator('html')).not.toHaveAttribute('data-loading', /.*/, {
    timeout: 15_000,
  });
}

/**
 * Is this project running below the rails' breakpoint?
 *
 * Asked of the page with the component's own media query rather than inferred
 * from the project name, so the two can never drift apart.
 */
function isNarrow(page: Page) {
  return page.evaluate(() => window.matchMedia('(max-width: 639.98px)').matches);
}

/**
 * One representative of each dynamic family, and every static page.
 *
 * `/videos/<id>` alone can be several hundred rows; visiting all of them in six
 * engines is a load run, not a test. `all` is excluded from the collapse because
 * `/songs/all` and `/shorts/all` are listing pages in their own right, not items.
 */
function dynamicFamily(path: string): string | null {
  const match = /^\/(videos|songs|creations)\/([^/]+)$/.exec(path);
  if (!match || match[2] === 'all') return null;
  return match[1];
}

/**
 * The routes to check are discovered, never listed.
 *
 * The local database holds two channels and one song; the live one holds
 * hundreds of videos. A hard-coded list would either fail here or stop covering
 * there. The sitemap is already this project's answer to "what is public", so it
 * is reused — but only for its PATHS: its `<loc>` values are built by
 * `absoluteUrl()` from the configured public origin, which is not the address
 * under test. Channel pages are not in the sitemap at all and come from links.
 */
async function publicPaths(page: Page): Promise<string[]> {
  const response = await page.request.get('/sitemap.xml');
  expect(response.ok(), 'sitemap.xml should be served').toBeTruthy();

  const xml = await response.text();
  const fromSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname,
  );

  await page.goto('/creations');
  const channelLinks = await page
    .locator('a[href^="/creations/"]')
    .evaluateAll((links) =>
      Array.from(new Set(links.map((link) => link.getAttribute('href') ?? ''))),
    );

  const seenFamilies = new Set<string>();
  return [...new Set([...fromSitemap, ...channelLinks])].filter((path) => {
    if (!path.startsWith('/')) return false;
    const family = dynamicFamily(path);
    if (!family) return true;
    if (seenFamilies.has(family)) return false;
    seenFamilies.add(family);
    return true;
  });
}

/** The first rail with enough track to loop through. */
async function driftableRail(page: Page): Promise<Locator | null> {
  const rails = page.locator('.rail-viewport');
  const count = await rails.count();

  for (let index = 0; index < count; index++) {
    const rail = rails.nth(index);
    /* The component's own headroom guard (`half < clientWidth + 24`): a rail
       shorter than this correctly never drifts, so asserting that it does would
       be testing the wrong thing. */
    const hasHeadroom = await rail.evaluate((el) => el.scrollWidth / 2 >= el.clientWidth + 24);
    if (hasHeadroom) return rail;
  }

  return null;
}

test.describe('Every public page', () => {
  test('renders, logs nothing, and never overflows sideways', async ({ page }) => {
    const problems = watchForProblems(page);
    const paths = await publicPaths(page);
    expect(paths.length, 'discovered public routes').toBeGreaterThan(5);

    for (const path of paths) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: 'load' });
        await settled(page);

        await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

        /*
         * The classic cross-engine break, and the main reason this file exists.
         *
         * Compared against `clientWidth`, NOT `innerWidth`: desktop Firefox
         * draws a classic scrollbar, which makes `innerWidth` the larger of the
         * two and would let a real 15px overflow pass unnoticed. One pixel of
         * slack for sub-pixel layout rounding.
         */
        const width = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(width.scroll, `${path} overflows horizontally`).toBeLessThanOrEqual(
          width.client + 1,
        );

        /*
         * A 200 that is not a decodable image still leaves a hole in the page,
         * so this asks the browser whether it actually got a picture rather
         * than whether the request succeeded.
         *
         * ONLY RENDERED IMAGES COUNT. A browser does not decode an image inside
         * a `display: none` subtree, and an undecoded one reports exactly what a
         * broken one does: `complete` true, `naturalWidth` 0. The music hero is
         * hidden at phone width and was flagged on all three narrow projects
         * while loading perfectly — `getClientRects()` is empty for anything
         * with no layout box, which is the difference between "hidden" and
         * "broken". `currentSrc` then confirms the element actually committed to
         * a URL rather than never having been given one.
         */
        const broken = await page.evaluate(() =>
          [...document.images]
            .filter((image) => image.getClientRects().length > 0)
            .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
            .map((image) => image.currentSrc),
        );
        expect(broken, `${path} has broken images`).toEqual([]);
      });
    }

    expect(problems, 'pages logged errors').toEqual([]);
  });
});

test.describe('The channel rails', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await settled(page);
  });

  test('are scrollable on a phone and clipped on a desktop', async ({ page }) => {
    const rail = page.locator('.rail-viewport').first();
    test.skip((await rail.count()) === 0, 'No rails rendered — no visible videos.');

    const narrow = await isNarrow(page);

    const style = await rail.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        overflow: computed.overflow,
        overflowX: computed.overflowX,
        mask: computed.maskImage,
        webkitMask: (computed as CSSStyleDeclaration & { webkitMaskImage?: string })
          .webkitMaskImage,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    if (narrow) {
      expect(style.overflowX, 'phone rails must be real scrollers').toBe('auto');
      /* The fade is `sm:`-only now. At 375px it ate most of the first and last
         card, and with the row scrollable there is nothing left to imply. */
      expect(style.mask ?? 'none').toBe('none');
      expect(style.webkitMask ?? 'none').toBe('none');
      /* If this fails the row cannot be pushed and every card past the second is
         unreachable — precisely the bug the mobile branch was written to fix. */
      expect(style.scrollWidth, 'there must be something to scroll to').toBeGreaterThan(
        style.clientWidth,
      );
      return;
    }

    expect(style.overflow, 'desktop rails stay clipped for the marquee').toBe('hidden');
    expect(style.mask, 'desktop keeps the edge fade').toContain('gradient');

    const track = page.locator('[data-rail-track]').first();
    const marquee = await track.evaluate((el) => ({
      animations: el.getAnimations().length,
      name: getComputedStyle(el).animationName,
    }));
    /*
     * `>= 1` and a name check, not `=== 1`.
     *
     * What an engine counts as an animation has varied — whether a transition on
     * a descendant appears, whether a hover-paused animation persists — and
     * `RailArrows` only needs one to exist before it falls back to `scrollBy`.
     * The name is the part actually worth asserting.
     */
    expect(marquee.animations).toBeGreaterThanOrEqual(1);
    expect(marquee.name).toContain('marquee');
  });

  test('put the channel logo above the row on a phone', async ({ page }) => {
    test.skip(!(await isNarrow(page)), 'Desktop keeps the logo as a side column.');

    const rail = page.locator('.rail-viewport').first();
    test.skip((await rail.count()) === 0, 'No rails rendered — no visible videos.');

    const row = rail.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    expect(await row.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('column');

    const avatar = row.locator('a[href^="/creations/"]').first();
    const placement = await avatar.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { marginBottom: computed.marginBottom, zIndex: computed.zIndex };
    });

    /* The dip into the first card's corner. `toBeCloseTo` because WebKit reports
       sub-pixel values for a margin the others give as a round number. */
    expect(parseFloat(placement.marginBottom)).toBeCloseTo(-24, 0);
    /* Over the cards, which carry no z-index of their own. */
    expect(placement.zIndex).toBe('10');
  });

  test('drift on their own, and keep the visitor position after a swipe', async ({ page }) => {
    test.skip(!(await isNarrow(page)), 'The drift loop is a phone-width branch.');

    const rail = await driftableRail(page);
    test.skip(rail === null, 'No rail long enough to loop — the headroom guard applies.');
    const viewport = rail as Locator;

    /* `useInView({ margin: '200px 0px' })` means a rail below the fold is
       deliberately not animating. */
    await viewport.scrollIntoViewIfNeeded();

    /*
     * A diagnostic, not an assertion.
     *
     * If rAF is throttled the drift below is slow for reasons that have nothing
     * to do with the rail, and without this line the next person reads a 20s
     * poll as a rail bug. Chromium takes launch flags for this; Firefox and
     * WebKit offer no equivalent, so the number is recorded instead.
     */
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const started = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - started < 1000) requestAnimationFrame(tick);
            else resolve(frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    test.info().annotations.push({ type: 'rAF fps', description: String(fps) });

    const start = await viewport.evaluate((el) => el.scrollLeft);

    /*
     * "It moved", never "it moved at 30px/s".
     *
     * A rate assertion measures the harness. rAF drops to about 1fps in a
     * renderer the system thinks nobody is watching, and the loop's own 0.05s
     * delta clamp then caps how far one frame can travel — so identical correct
     * code drifts at 30px/s on a phone and 1.5px/s on a test runner. The only
     * property that survives both is that the number goes up, which is also the
     * only property whose absence is a bug.
     *
     * `+ 2` clears `movedByVisitor()`'s own tolerance, so a single pixel-grid
     * snap cannot pass this.
     */
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollLeft), {
        timeout: 20_000,
        intervals: [250, 250, 500, 1000],
        message: 'The rail never advanced — the rAF loop is not running.',
      })
      .toBeGreaterThan(start + 2);

    /*
     * Now the regression test for the pause-latch bug.
     *
     * `ChannelSpotlight` once paused on `pointerdown` and never resumed, which
     * killed it on nearly every mobile visit because a scroll touch fires
     * pointerdown. The rail's pause is a deadline instead, and these three
     * assertions are what "deadline, not latch" actually means.
     *
     * Driven with `scrollBy` rather than `mouse.wheel`: horizontal wheel deltas
     * are not portable to WebKit and `firefox-narrow` has no touch, while
     * `scrollBy` fires the same `scroll` event that `movedByVisitor()` listens
     * for in every engine.
     */
    /* Read BEFORE the push, not in the same call as it — `scrollBy` applies
       synchronously, so returning `scrollLeft` from inside that evaluate reads
       the position it had already moved to and compares it against itself. */
    const before = await viewport.evaluate((el) => el.scrollLeft);
    await viewport.evaluate((el) => el.scrollBy({ left: 200 }));
    await page.waitForTimeout(150);

    const afterSwipe = await viewport.evaluate((el) => el.scrollLeft);
    expect(afterSwipe, 'the swipe must move the row').toBeGreaterThan(before);

    /* Held, not yanked back, while the visitor is presumed to still be looking. */
    await page.waitForTimeout(400);
    const held = await viewport.evaluate((el) => el.scrollLeft);
    expect(Math.abs(held - afterSwipe), 'the row must not snap back').toBeLessThan(12);

    /* And it comes back on its own — the whole point of a deadline. */
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollLeft), {
        timeout: 20_000,
        intervals: [250, 250, 500, 1000],
        message: 'The rail never resumed after the swipe — the pause has latched.',
      })
      .toBeGreaterThan(held + 2);
  });
});

/**
 * The things a person spotted, that nothing was watching.
 *
 * Every layout fault found in this project recently was found by looking: the
 * hero image floating in mid-air on a phone, a slab of dead space beside it,
 * 699 kB of logos drawn at 66 pixels. The suite happily passed through all of
 * them, because it only asked whether pages overflow and whether images decode.
 *
 * These are narrow on purpose. A screenshot comparison would catch more and
 * would also fail on every deliberate change, which is how a visual suite ends
 * up disabled. Each of these instead pins one property that was actually wrong
 * once, and that has an obvious right answer.
 */
test.describe('Regressions found by eye', () => {
  test('the songs hero reaches the corner on a phone, and stays off the heading', async ({
    page,
  }) => {
    await page.goto('/songs', { waitUntil: 'load' });
    await settled(page);

    test.skip(!(await isNarrow(page)), 'The stacked hero image only exists below lg.');

    /*
     * The VISIBLE one. Both copies are in the markup — the absolutely
     * positioned desktop image is `hidden lg:block`, and it comes first — so
     * `.first()` picks the one with no layout box at this width.
     */
    const image = page.locator('section img:visible').first();
    test.skip((await image.count()) === 0, 'No hero image configured.');
    await expect(image).toBeVisible();

    const box = await image.evaluate((el) => {
      const wrap = el.parentElement as HTMLElement;
      const section = wrap.closest('section') as HTMLElement;
      const r = wrap.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      const heading = (section.querySelector('h1') as HTMLElement).getBoundingClientRect();
      return {
        toRight: Math.round(s.right - r.right),
        toBottom: Math.round(s.bottom - r.bottom),
        clearsHeading: r.top >= heading.bottom,
      };
    });

    /*
     * It bleeds to the bottom-right corner. Sat in the flow with the container's
     * padding beneath it, the arm — which the source file already crops — ended
     * in mid-air and read as a cut-out pasted onto the page.
     *
     * A few pixels of slack: engines round a percentage-based offset differently,
     * and this is asserting "against the corner", not an exact number.
     */
    expect(box.toRight, 'hero image should meet the right edge').toBeLessThanOrEqual(12);
    expect(box.toBottom, 'hero image should meet the section bottom').toBeLessThanOrEqual(12);

    /*
     * And it sits BELOW the copy. It used to be a background behind the words,
     * where "Your Favourite Platform." ran across the lit face of the phone —
     * measured then at 300px of overlap on a 640px screen.
     */
    expect(box.clearsHeading, 'hero image should not overlap the heading').toBe(true);
  });

  test('the contact form offers WhatsApp, and builds a real link', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'load' });
    await settled(page);

    const send = page.getByRole('button', { name: 'Send Enquiry' });
    const whatsapp = page.getByRole('button', { name: 'Send on WhatsApp' });

    await expect(send).toBeVisible();
    await expect(whatsapp).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill('Cross Browser Check');
    await page.getByLabel('Email Address').fill('cross@example.com');
    await page.getByLabel('Tell Us About Your Project').fill('Checking the WhatsApp link.');

    /*
     * BLOCKED BEFORE THE CLICK, and this is not belt-and-braces — the first
     * version of this test stored eight real enquiries and sent eight real
     * emails before anyone noticed.
     *
     * The WhatsApp button deliberately submits the form as well as opening the
     * link: WhatsApp is an additional route to the label, not a replacement for
     * the enquiry being recorded. Correct behaviour, and fatal here — this file
     * says at the top that it is read-only by construction and can run six times
     * over without leaving a trace, and that has to stay true or the claim is
     * worse than no claim.
     */
    await page.route('**/api/contact', (route) => route.abort());

    /*
     * The link is read rather than followed. Clicking through would make the
     * suite depend on wa.me being up and on WhatsApp's markup, so `window.open`
     * is replaced and the URL it was given is inspected instead.
     */
    await page.evaluate(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = (url?: string | URL) => {
        (window as unknown as { __opened: string[] }).__opened.push(String(url));
        return null;
      };
    });

    await whatsapp.click();

    const opened = await page.evaluate(
      () => (window as unknown as { __opened: string[] }).__opened,
    );

    expect(opened, 'the WhatsApp button should open one link').toHaveLength(1);
    expect(opened[0], 'addressed to a wa.me number').toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);

    const message = decodeURIComponent(opened[0].split('?text=')[1]);
    // Written as the visitor, which is the whole reason it is a separate builder.
    expect(message).toContain('Cross Browser Check');
    expect(message).toContain('Checking the WhatsApp link.');
  });

  test('no page ships an unreasonable weight of images', async ({ page }) => {
    /*
     * The check that would have caught 699 kB of streaming-platform logos being
     * downloaded to every phone for marks drawn at 66 pixels. Nothing was
     * broken, nothing overflowed, no error was logged — it was simply enormous,
     * and no assertion in this file had an opinion about size.
     *
     * The budget is deliberately generous. It is a tripwire for something having
     * gone badly wrong, not a performance target: the homepage legitimately
     * carries a background video and a wall of thumbnails, and a budget that
     * argues with ordinary content gets raised until it means nothing.
     */
    const BUDGET_KB = 400;

    let bytes = 0;
    const onResponse = (response: import('@playwright/test').Response) => {
      const type = response.headers()['content-type'] ?? '';
      if (!type.startsWith('image/')) return;
      bytes += Number(response.headers()['content-length'] ?? 0);
    };

    page.on('response', onResponse);
    await page.goto('/', { waitUntil: 'load' });
    await settled(page);
    page.off('response', onResponse);

    expect(
      Math.round(bytes / 1024),
      'the homepage is downloading far more image data than it should',
    ).toBeLessThan(BUDGET_KB);
  });
});
