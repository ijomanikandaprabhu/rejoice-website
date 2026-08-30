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
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
