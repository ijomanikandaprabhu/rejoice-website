'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/guard';
import { absoluteUrl } from '@/lib/seo';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { slugify } from '@/lib/utils';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  fieldErrors,
  platformSchema,
  songLinkSchema,
  songSchema,
} from '@/lib/validation';

/**
 * Songs, their cover art, and the platforms they can be heard on.
 *
 * Every action calls `requireAdmin()` first. Middleware already blocks
 * unauthenticated navigation, but a server action is its own endpoint and must
 * check for itself (section 37).
 */

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

const log = createLogger('songs');

/** Both public surfaces that can show a song. */
function revalidateSongs() {
  revalidatePath('/songs', 'layout');
  revalidatePath('/admin/songs');
}

/* ------------------------------------------------------------------ images */

type StoredImage = { id: string };

/**
 * Store one uploaded image.
 *
 * The browser downscales before uploading (`src/lib/images/downscale.ts`), so
 * what arrives here is already web-sized. This checks that anyway: the resize
 * happens in a browser, and anything a browser does is a request rather than a
 * guarantee.
 *
 * `width` and `height` are sent alongside the file because reading them back
 * here would need an image library on the server — a native dependency this
 * project deliberately does not carry. They are used for layout only, never for
 * anything that would matter if they were wrong.
 */
async function storeImage(
  file: File,
  width: number,
  height: number,
): Promise<StoredImage | string> {
  if (file.size === 0) return 'Choose an image.';
  if (file.size > MAX_IMAGE_BYTES) {
    return 'That image is too large. It should have been shrunk before uploading — try again, or use a smaller file.';
  }
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a PNG, JPEG or WebP image.';
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return 'That image could not be read.';
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      width: Math.round(width),
      height: Math.round(height),
      byteSize: file.size,
    },
    select: { id: true },
  });

  return asset;
}

/**
 * A form value as the schema wants it.
 *
 * `formData.get` returns NULL for a field the form does not render, and zod's
 * `.optional()` accepts undefined but not null — so a field removed from the
 * form fails validation with a message about the field the administrator can no
 * longer see. Release date and description are exactly that case: both columns
 * still exist, neither is on the form any more.
 */
function optionalText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
}

/** Pull one `<name>` file plus its `<name>.width` / `.height` from a form. */
function imageFrom(formData: FormData, name: string) {
  const file = formData.get(name);
  return {
    file: file instanceof File ? file : null,
    width: Number(formData.get(`${name}.width`)),
    height: Number(formData.get(`${name}.height`)),
  };
}

/* --------------------------------------------------------------- platforms */

/** Register a streaming platform so songs can link to it. */
export async function addPlatformAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = platformSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { name } = parsed.data;
  const slug = slugify(name);
  if (!slug) return { ok: false, errors: { name: 'Use a name with some letters or numbers in it.' } };

  const clash = await prisma.platform.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (clash) return { ok: false, errors: { name: `${clash.name} is already in the list.` } };

  const { file, width, height } = imageFrom(formData, 'logo');
  if (!file) return { ok: false, errors: { logo: 'Choose a logo.' } };

  const stored = await storeImage(file, width, height);
  if (typeof stored === 'string') return { ok: false, errors: { logo: stored } };

  // Newest last, so the order matches the order they were added rather than
  // whatever the database returns.
  const last = await prisma.platform.findFirst({ orderBy: { sortOrder: 'desc' } });

  await prisma.platform.create({
    data: { name, slug, logoId: stored.id, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });

  log.info(`Added platform ${name}`);
  revalidateSongs();

  return { ok: true, message: `${name} added.` };
}

/**
 * Remove a platform.
 *
 * Refused while any song still links to it. The alternative — cascading — would
 * silently delete those links, and "the Spotify links vanished" is a far worse
 * surprise than being told to clear them first.
 */
export async function deletePlatformAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const platform = await prisma.platform.findUnique({
    where: { id },
    select: { name: true, logoId: true, _count: { select: { links: true } } },
  });
  if (!platform) return { ok: false, message: 'That platform is no longer there.' };

  if (platform._count.links > 0) {
    const n = platform._count.links;
    return {
      ok: false,
      message: `${platform.name} is used by ${n} song${n === 1 ? '' : 's'}. Remove those links first.`,
    };
  }

  await prisma.platform.delete({ where: { id } });
  // The logo is the platform's alone, so it goes with it rather than being left
  // behind taking up space nothing references.
  await prisma.mediaAsset.delete({ where: { id: platform.logoId } });

  log.info(`Deleted platform ${platform.name}`);
  revalidateSongs();

  return { ok: true, message: `${platform.name} removed.` };
}

/* ------------------------------------------------------------------- songs */

/**
 * Read the platform/URL pairs out of a song form.
 *
 * The form renders one row per REGISTERED PLATFORM, each carrying its id in a
 * hidden field beside its URL box, so these two lists line up by position. A
 * row with an empty URL means "not on this platform" and is simply dropped —
 * that is what lets the form offer twelve platforms for a song that uses two.
 *
 * Errors are keyed by platform id rather than by row number. The rows are
 * generated from the registry, so a platform removed in another tab would shift
 * every position after it and pin the message to the wrong line.
 */
function linksFrom(formData: FormData) {
  const platformIds = formData.getAll('link.platformId').map(String);
  const urls = formData.getAll('link.url').map(String);

  const rows: Array<{ platformId: string; url: string }> = [];
  const errors: Record<string, string> = {};
  const seen = new Set<string>();

  for (const [index, platformId] of platformIds.entries()) {
    const url = (urls[index] ?? '').trim();

    if (!url || !platformId) continue;

    const parsed = songLinkSchema.safeParse({ platformId, url });
    if (!parsed.success) {
      errors[`link.${platformId}.url`] = fieldErrors(parsed.error).url ?? 'Check this link.';
      continue;
    }

    // The database would reject this too, but a plain sentence beats a
    // constraint violation surfacing as "something went wrong".
    if (seen.has(platformId)) {
      errors[`link.${platformId}.url`] = 'This platform is listed twice.';
      continue;
    }

    seen.add(platformId);
    rows.push(parsed.data);
  }

  return { rows, errors };
}

/** A slug that is not already taken, without silently overwriting a song. */
async function uniqueSlug(title: string, exceptId?: string): Promise<string> {
  const base = slugify(title) || 'song';

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.song.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (!taken) return slug;
  }

  // Two songs of the same name is ordinary; fifty is not, and a timestamp is a
  // better answer than a loop that never ends.
  return `${base}-${Date.now()}`;
}

export async function addSongAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = songSchema.safeParse({
    title: formData.get('title'),
    artist: optionalText(formData, 'artist'),
    description: optionalText(formData, 'description'),
    releasedAt: optionalText(formData, 'releasedAt'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { rows, errors: linkErrors } = linksFrom(formData);
  if (Object.keys(linkErrors).length > 0) return { ok: false, errors: linkErrors };

  const cover = imageFrom(formData, 'cover');
  if (!cover.file) return { ok: false, errors: { cover: 'Choose a cover image.' } };

  const storedCover = await storeImage(cover.file, cover.width, cover.height);
  if (typeof storedCover === 'string') return { ok: false, errors: { cover: storedCover } };

  const { title, artist, description, releasedAt } = parsed.data;

  const song = await prisma.song.create({
    data: {
      slug: await uniqueSlug(title),
      title,
      artist: artist || null,
      description: description || null,
      // Parsed as UTC midnight: a release date is a calendar day, and letting
      // the server's timezone shift it would show the day before in India.
      releasedAt: releasedAt ? new Date(`${releasedAt}T00:00:00Z`) : null,
      coverId: storedCover.id,
      links: { create: rows },
    },
    select: { id: true, title: true },
  });

  log.info(`Added song ${song.title}`);
  revalidateSongs();

  /*
   * Back to the table, where the new row is at the top. `redirect` works by
   * THROWING, so it must be the last thing here and must never sit inside a
   * try/catch — caught, it silently does nothing and the form appears to hang.
   *
   * The success toast is lost to the navigation. The row being there is the
   * confirmation.
   */
  redirect('/admin/songs');
}

export async function updateSongAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const existing = await prisma.song.findUnique({
    where: { id },
    select: { id: true, coverId: true, slug: true },
  });
  if (!existing) return { ok: false, message: 'That song is no longer there.' };

  const parsed = songSchema.safeParse({
    title: formData.get('title'),
    artist: optionalText(formData, 'artist'),
    description: optionalText(formData, 'description'),
    releasedAt: optionalText(formData, 'releasedAt'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { rows, errors: linkErrors } = linksFrom(formData);
  if (Object.keys(linkErrors).length > 0) return { ok: false, errors: linkErrors };

  /*
   * A new cover is optional on edit. Both sizes must arrive together or not at
   * all — replacing one and keeping the other would leave the grid and the song
   * page showing different pictures.
   */
  const cover = imageFrom(formData, 'cover');
  const replacing = Boolean(cover.file?.size);

  let coverId = existing.coverId;

  if (replacing) {
    const storedCover = await storeImage(cover.file!, cover.width, cover.height);
    if (typeof storedCover === 'string') return { ok: false, errors: { cover: storedCover } };
    coverId = storedCover.id;
  }

  const { title, artist, description, releasedAt } = parsed.data;

  /*
   * Absent, not empty. Release date and description are no longer on the form,
   * so they arrive as undefined — and a song that has one must keep it rather
   * than being quietly cleared by a screen that cannot show it.
   */
  const keepDescription = description === undefined ? {} : { description: description || null };
  const keepReleasedAt =
    releasedAt === undefined
      ? {}
      : { releasedAt: releasedAt ? new Date(`${releasedAt}T00:00:00Z`) : null };

  await prisma.$transaction([
    // Replace the links wholesale. They are a short list edited as one thing,
    // so working out which rows changed would be effort spent on nothing.
    prisma.songLink.deleteMany({ where: { songId: id } }),
    prisma.song.update({
      where: { id },
      data: {
        title,
        artist: artist || null,
        ...keepDescription,
        ...keepReleasedAt,
        isVisible: formData.get('isVisible') === 'on',
        coverId,
        links: { create: rows },
      },
    }),
  ]);

  // Only once the song no longer points at it, or the delete would be refused
  // by the foreign key.
  if (replacing) {
    await prisma.mediaAsset.delete({ where: { id: existing.coverId } });
  }

  revalidateSongs();
  revalidatePath(`/songs/${existing.slug}`);

  redirect('/admin/songs');
}

export async function deleteSongAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const song = await prisma.song.findUnique({
    where: { id },
    select: { title: true, coverId: true },
  });
  if (!song) return { ok: false, message: 'That song is no longer there.' };

  // Links cascade with the song; the cover does not, so it is removed here
  // rather than left behind occupying database space forever.
  await prisma.song.delete({ where: { id } });
  await prisma.mediaAsset.delete({ where: { id: song.coverId } });

  log.info(`Deleted song ${song.title}`);
  revalidateSongs();

  return { ok: true, message: `${song.title} deleted.` };
}

/* ------------------------------------------------- the ten already shipped */

/**
 * The platform logos that ship with this site, and the names they go by.
 *
 * These files predate the registry — `/songs` used to be a static grid of them
 * — so an empty registry can be filled without hunting down ten logo files.
 */
const BUILT_IN = [
  ['Spotify', 'spotify.png'],
  ['Apple Music', 'apple-music.png'],
  ['iTunes', 'itunes.png'],
  ['Amazon Music', 'amazon-music.png'],
  ['JioSaavn', 'jiosaavn.png'],
  ['Gaana', 'gaana.png'],
  ['Raaga', 'raaga.png'],
  ['Resso', 'resso.png'],
  ['Wynk', 'wynk.png'],
  ['YouTube Music', 'youtube-music.png'],
] as const;

/** Width and height live at fixed offsets in a PNG's IHDR chunk. */
function pngSize(bytes: Buffer) {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Register the ten platforms whose logos are already part of this site.
 *
 * Exists as a button rather than a script because the production database is
 * not reachable from a developer's machine — it is only reachable from the
 * deployed site — and asking a non-technical owner to run a terminal command
 * against a live database is the wrong shape of answer.
 *
 * The logos are fetched over HTTP from this site's own `/brand/platforms/`
 * rather than read off disk: `public/` is served statically and reading it back
 * through the filesystem is not dependable inside a serverless function.
 *
 * Idempotent, keyed on name. Pressing it twice adds nothing.
 */
export async function seedBuiltInPlatformsAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let added = 0;
  const failed: string[] = [];

  for (const [index, [name, file]] of BUILT_IN.entries()) {
    if (await prisma.platform.findFirst({ where: { name }, select: { id: true } })) continue;

    const response = await fetch(absoluteUrl(`/brand/platforms/${file}`)).catch(() => null);
    if (!response?.ok) {
      failed.push(name);
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const { width, height } = pngSize(bytes);

    const asset = await prisma.mediaAsset.create({
      data: { mimeType: 'image/png', bytes, width, height, byteSize: bytes.length },
      select: { id: true },
    });

    await prisma.platform.create({
      data: { name, slug: slugify(name), logoId: asset.id, sortOrder: index },
    });

    added++;
  }

  log.info(`Seeded ${added} built-in platforms`);
  revalidateSongs();

  if (added === 0 && failed.length === 0) {
    return { ok: true, message: 'They are all registered already — nothing to add.' };
  }

  if (failed.length > 0) {
    return {
      ok: false,
      message: `Added ${added}. These could not be read: ${failed.join(', ')}.`,
    };
  }

  return { ok: true, message: `Added ${added} platforms.` };
}
