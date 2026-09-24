import { revalidatePath } from 'next/cache';

/**
 * Rebuild the public pages that draw video data.
 *
 * ## Why this is its own file
 *
 * It is called from two places that cannot import each other: the admin's
 * server actions (`features/youtube/actions.ts`, a `'use server'` module, whose
 * every export must be an async server action) and the nightly cron route
 * (`app/api/youtube/sync/route.ts`). One copy each would be two lists of pages
 * to keep in step, and the one that drifted would be the one nobody watched —
 * the cron.
 *
 * ## Why it matters more than it used to
 *
 * Until now the cron did NOT refresh anything, and it did not need to: every
 * public page rebuilt itself on a five-minute timer, so a video imported at
 * 12:30 appeared by 12:35 whether or not anyone said so.
 *
 * That timer is what exhausted the database's monthly allowance — 288 rebuilds
 * a day, per page, each one waking Postgres and reading rows that had not
 * changed. The pages are now cached for hours, which is only safe because
 * whatever changes the content says so here: the admin already did, and the
 * cron now does too.
 */
export function revalidatePublicVideoPages(): void {
  // The homepage rails.
  revalidatePath('/', 'page');
  // 'layout', not the bare path: the channel's name and card text is drawn on
  // the detail pages under it as well.
  revalidatePath('/creations', 'layout');
  revalidatePath('/videos', 'layout');
  // The feed and its paged listing, which the homepage and Creations do not cover.
  revalidatePath('/shorts');
  revalidatePath('/shorts/all');
  // Lists every video, so an import changes it.
  revalidatePath('/sitemap.xml');
}
