import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * The admin tests sign in as the real administrator, whose credentials live in
 * `.env` beside the database URL. Without this the suite falls back to a
 * hard-coded password and every admin test fails on "Incorrect email or
 * password". Parsed here rather than with dotenv, which this project does not
 * depend on.
 *
 * A variable already set in the environment always wins, so CI can override.
 */
function loadEnv() {
  let file: string;
  try {
    file = readFileSync('.env', 'utf8');
  } catch {
    return;
  }

  for (const line of file.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Which spec fans out across engines, and which does not.
 *
 * `rejoice.spec.ts` signs in as the administrator, submits a real enquiry and
 * imports YouTube channels — it WRITES TO THE DATABASE. Running it five more
 * times would multiply the rows it leaves behind and five-fold the slowest part
 * of the run, for no new information: those flows are server behaviour, and the
 * server does not care which engine asked.
 *
 * `crossBrowser.spec.ts` is the opposite — read-only, no login, and the whole
 * reason it exists is that engines disagree. Only it is fanned out.
 *
 * `testMatch` per project rather than a tag plus `grep`: `grep` is a single
 * global filter, so it cannot say "chromium runs everything, the rest run one
 * file" in one invocation. This expresses it once, and a bare
 * `npx playwright test` then does the right thing with no flags.
 */
const CROSS_BROWSER = /crossBrowser\.spec\.ts/;

/**
 * A renderer nothing is looking at has its `requestAnimationFrame` throttled to
 * about 1fps, and the rails move in a rAF loop (`site/RailAutoScroll.tsx`).
 *
 * This is not hypothetical: during development the rail drift was measured at
 * exactly 1fps in an automated pane that was not painting, where it looked like
 * a bug in the rail rather than in the harness. These flags are the Chromium
 * answer; Firefox and WebKit expose no equivalent, which is why the drift
 * assertion polls instead of measuring a rate.
 */
const ANTI_THROTTLE = [
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    /*
     * Pinned, not inherited from whatever the runner reports.
     *
     * `useReducedMotion()` switches the rail's drift loop off entirely, and the
     * same media query removes the `sm:` marquee, so an engine quietly
     * answering "reduce" would turn every motion assertion below into a failure
     * with no visible cause.
     *
     * Under `contextOptions` rather than beside `baseURL`: this Playwright
     * exposes `reducedMotion` as a browser-context option, not as a top-level
     * `use` key, and the flat form does not typecheck.
     */
    contextOptions: { reducedMotion: 'no-preference' },
  },
  projects: [
    /* Keeps the whole suite, exactly as before — no `testMatch`. */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ANTI_THROTTLE } },
    },
    { name: 'firefox', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Firefox'] } },
    /*
     * Gecko at phone width, by viewport rather than by device descriptor.
     *
     * Every `devices['iPhone …' | 'Pixel …']` entry carries `isMobile: true`,
     * which Playwright's Firefox refuses at context creation. Width alone is
     * enough regardless: `RailAutoScroll` branches on
     * `(max-width: 639.98px)`, which asks about width, not touch. Gecko has to
     * see that branch, because Gecko is where `scrollLeft` rounding differs and
     * that rounding is the thing `movedByVisitor()` defends against.
     */
    {
      name: 'firefox-narrow',
      testMatch: CROSS_BROWSER,
      use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } },
    },
    { name: 'webkit', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chrome',
      testMatch: CROSS_BROWSER,
      use: { ...devices['Pixel 5'], launchOptions: { args: ANTI_THROTTLE } },
    },
    { name: 'mobile-safari', testMatch: CROSS_BROWSER, use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
