import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge, taught this project's own scales.
 *
 * Out of the box it only knows Tailwind's default tokens. `text-body` and
 * `text-label` are not t-shirt sizes, so it filed them under *text colour* and
 * deleted them whenever a `text-site-*` colour was merged in:
 *
 *   twMerge('text-body text-site-fg')  ->  'text-site-fg'
 *
 * The Contact form showed it — the plain inputs kept their 16px because their
 * class string never passed through `cn()`, while the textarea and the select
 * beside them lost it and rendered smaller. Same story for the corner scale:
 * `rounded-input` was not recognised as a radius, so it did not override
 * shadcn's built-in `rounded-md` and the select sat at 10px next to 8px inputs.
 *
 * Both lists mirror the `fontSize` and `borderRadius` keys in
 * `tailwind.config.ts` — add a token there and add it here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['label', 'body', 'h1', 'h2', 'h3'] }],
      rounded: [{ rounded: ['input', 'sm2', 'card', 'hero', 'pill', 'panel'] }],
    },
  },
});

/**
 * Join class names, resolving Tailwind conflicts.
 *
 * shadcn/ui expects `cn` to live at `@/lib/utils`, and its components rely on
 * tailwind-merge so that a passed-in `className` can override a component's
 * defaults (e.g. `px-6` beating a built-in `px-4`). A naive join would leave
 * both classes on the element and let source order decide.
 *
 * Note this file is `src/lib/utils/index.ts`. shadcn's init also wrote a
 * `src/lib/utils.ts`, which shadowed this whole directory and broke every
 * import of `formatDate`, `slugify` and `truncate`. That file was removed and
 * its `cn` merged here, so there is exactly one `@/lib/utils`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * The timezone every date on this site is rendered in.
 *
 * These formatters run in server components, so without this they used the
 * SERVER's zone — UTC on a typical host. The scheduled sync is set to 12:30 UTC
 * precisely because that is 18:00 in Chennai, so "last synced" would have
 * displayed 12:30 and looked wrong to everyone reading it. Rejoice is an Indian
 * label and its administrator is in India; one constant, one place to change it.
 */
export const SITE_TIME_ZONE = 'Asia/Kolkata';

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: SITE_TIME_ZONE,
  });
}

/** Seconds to h:mm:ss (or m:ss under an hour). Null for missing/zero durations. */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SITE_TIME_ZONE,
  });
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
