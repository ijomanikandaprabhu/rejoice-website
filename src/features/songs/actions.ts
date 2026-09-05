'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
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

/** Read the repeatable platform/URL rows out of a song form. */
function linksFrom(formData: FormData) {
  const platformIds = formData.getAll('link.platformId').map(String);
  const urls = formData.getAll('link.url').map(String);

  const rows: Array<{ platformId: string; url: string }> = [];
  const errors: Record<string, string> = {};
  const seen = new Set<string>();

  for (const [index, platformId] of platformIds.entries()) {
    const url = (urls[index] ?? '').trim();

    // An untouched row. Not an error — the form always offers a spare.
    if (!platformId && !url) continue;

    if (!platformId) {
      errors[`link.${index}.platformId`] = 'Choose a platform, or clear the link.';
      continue;
    }

    const parsed = songLinkSchema.safeParse({ platformId, url });
    if (!parsed.success) {
      errors[`link.${index}.url`] = fieldErrors(parsed.error).url ?? 'Check this link.';
      continue;
    }

    // The database would reject this too, but a plain sentence beats a
    // constraint violation surfacing as "something went wrong".
    if (seen.has(platformId)) {
      errors[`link.${index}.platformId`] = 'That platform is already listed for this song.';
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
    artist: formData.get('artist'),
    description: formData.get('description'),
    releasedAt: formData.get('releasedAt'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { rows, errors: linkErrors } = linksFrom(formData);
  if (Object.keys(linkErrors).length > 0) return { ok: false, errors: linkErrors };

  const cover = imageFrom(formData, 'cover');
  const thumb = imageFrom(formData, 'thumb');
  if (!cover.file || !thumb.file) return { ok: false, errors: { cover: 'Choose a cover image.' } };

  const storedCover = await storeImage(cover.file, cover.width, cover.height);
  if (typeof storedCover === 'string') return { ok: false, errors: { cover: storedCover } };

  const storedThumb = await storeImage(thumb.file, thumb.width, thumb.height);
  if (typeof storedThumb === 'string') {
    // The large one already landed. Drop it rather than leaving an asset no
    // song points at.
    await prisma.mediaAsset.delete({ where: { id: storedCover.id } });
    return { ok: false, errors: { cover: storedThumb } };
  }

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
      thumbId: storedThumb.id,
      links: { create: rows },
    },
    select: { id: true, title: true },
  });

  log.info(`Added song ${song.title}`);
  revalidateSongs();

  return { ok: true, message: `${song.title} added.` };
}

export async function updateSongAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const existing = await prisma.song.findUnique({
    where: { id },
    select: { id: true, coverId: true, thumbId: true, slug: true },
  });
  if (!existing) return { ok: false, message: 'That song is no longer there.' };

  const parsed = songSchema.safeParse({
    title: formData.get('title'),
    artist: formData.get('artist'),
    description: formData.get('description'),
    releasedAt: formData.get('releasedAt'),
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
  const thumb = imageFrom(formData, 'thumb');
  const replacing = Boolean(cover.file?.size && thumb.file?.size);

  let coverId = existing.coverId;
  let thumbId = existing.thumbId;

  if (replacing) {
    const storedCover = await storeImage(cover.file!, cover.width, cover.height);
    if (typeof storedCover === 'string') return { ok: false, errors: { cover: storedCover } };

    const storedThumb = await storeImage(thumb.file!, thumb.width, thumb.height);
    if (typeof storedThumb === 'string') {
      await prisma.mediaAsset.delete({ where: { id: storedCover.id } });
      return { ok: false, errors: { cover: storedThumb } };
    }

    coverId = storedCover.id;
    thumbId = storedThumb.id;
  }

  const { title, artist, description, releasedAt } = parsed.data;

  await prisma.$transaction([
    // Replace the links wholesale. They are a short list edited as one thing,
    // so working out which rows changed would be effort spent on nothing.
    prisma.songLink.deleteMany({ where: { songId: id } }),
    prisma.song.update({
      where: { id },
      data: {
        title,
        artist: artist || null,
        description: description || null,
        releasedAt: releasedAt ? new Date(`${releasedAt}T00:00:00Z`) : null,
        isVisible: formData.get('isVisible') === 'on',
        coverId,
        thumbId,
        links: { create: rows },
      },
    }),
  ]);

  // Only once the song no longer points at them, or the delete would be
  // refused by the foreign key.
  if (replacing) {
    await prisma.mediaAsset.deleteMany({
      where: { id: { in: [existing.coverId, existing.thumbId] } },
    });
  }

  revalidateSongs();
  revalidatePath(`/songs/${existing.slug}`);

  return { ok: true, message: 'Song saved.' };
}

export async function deleteSongAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const song = await prisma.song.findUnique({
    where: { id },
    select: { title: true, coverId: true, thumbId: true },
  });
  if (!song) return { ok: false, message: 'That song is no longer there.' };

  // Links cascade with the song; the two images do not, so they are removed
  // here rather than left behind occupying database space forever.
  await prisma.song.delete({ where: { id } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: [song.coverId, song.thumbId] } } });

  log.info(`Deleted song ${song.title}`);
  revalidateSongs();

  return { ok: true, message: `${song.title} deleted.` };
}
