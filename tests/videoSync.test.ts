import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Section 36, Rule 7 — synchronization must never overwrite administrator
 * overrides, and must never import the same video twice.
 *
 * Prisma and the YouTube client are mocked so these run without a database or
 * an API key. What is under test is the sync logic itself.
 */

const db = {
  videos: new Map<string, Record<string, unknown>>(),
};

const prismaMock = {
  youTubeChannel: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  youTubeVideo: {
    findMany: vi.fn(async ({ where }: { where: { youtubeVideoId: { in: string[] } } }) =>
      where.youtubeVideoId.in
        .filter((id) => db.videos.has(id))
        .map((id) => ({ youtubeVideoId: id })),
    ),
    /*
     * `createMany` with `skipDuplicates`, modelled faithfully: a row whose id
     * is already present is silently skipped and NOT counted, which is what
     * the sync relies on to tell "imported" from "already had it".
     */
    createMany: vi.fn(
      async ({
        data,
        skipDuplicates,
      }: {
        data: Array<Record<string, unknown>>;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;
        for (const row of data) {
          const id = row.youtubeVideoId as string;
          if (db.videos.has(id)) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          db.videos.set(id, { ...row });
          count++;
        }
        return { count };
      },
    ),
    update: vi.fn(async ({ where, data }: { where: { youtubeVideoId: string }; data: Record<string, unknown> }) => {
      const existing = db.videos.get(where.youtubeVideoId) ?? {};
      const merged = { ...existing, ...data };
      db.videos.set(where.youtubeVideoId, merged);
      return merged;
    }),
  },
  siteSetting: {
    upsert: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  /*
   * The real client takes an array of already-created promises and runs them in
   * one transaction. The mocked `update` above is an async function, so by the
   * time this receives them they are in flight — awaiting them is an accurate
   * model, and the writes land in `db.videos` exactly as before.
   */
  $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
};

const fetchUploads = vi.fn();

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/youtube/youtubeClient', () => ({
  fetchUploads: (...args: unknown[]) => fetchUploads(...args),
  fetchVideosByIds: vi.fn(),
  YouTubeNotConfiguredError: class extends Error {},
}));

const { syncChannel } = await import('@/services/youtube/videoSyncService');

const CHANNEL = {
  id: 'chan-1',
  name: 'Rejoice Gospel Communications',
  uploadsPlaylistId: 'UU123',
  isActive: true,
  defaultVideoVisibility: 'REVIEW_FIRST' as const,
};

function upload(videoId: string, title: string) {
  return {
    videoId,
    channelId: 'UC123',
    title,
    description: 'A description',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hq.jpg`,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    durationSeconds: 240,
    // Explicit: the fixture used to omit this entirely, so nothing exercised
    // what the sync writes to `isShort` and the clobbering bug went unseen.
    isShort: false as boolean | null,
  };
}

beforeEach(() => {
  db.videos.clear();
  vi.clearAllMocks();
  prismaMock.youTubeChannel.findUnique.mockResolvedValue(CHANNEL);
  prismaMock.youTubeChannel.update.mockResolvedValue({});
});

describe('syncChannel', () => {
  it('imports new videos', async () => {
    fetchUploads.mockResolvedValue([upload('vid1', 'Worship Song'), upload('vid2', 'Gospel Release')]);

    const result = await syncChannel('chan-1');

    expect(result.ok).toBe(true);
    expect(result.imported).toBe(2);
    expect(db.videos.size).toBe(2);
  });

  it('does not import the same video twice', async () => {
    const uploads = [upload('vid1', 'Worship Song')];
    fetchUploads.mockResolvedValue(uploads);

    const first = await syncChannel('chan-1');
    const second = await syncChannel('chan-1');

    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
    expect(second.updated).toBe(1);
    expect(db.videos.size).toBe(1);
  });

  /*
   * A video absent from the detail lookup comes back with `durationSeconds` and
   * `isShort` unset — "we did not learn", not "we learned it is false". Writing
   * that through reclassified real Shorts as landscape on any sync that hit a
   * gap, and 603 of the catalogue's 1,748 videos are Shorts.
   */
  it('keeps the stored shape when a sync does not learn one', async () => {
    fetchUploads.mockResolvedValue([{ ...upload('vid1', 'A Short'), isShort: true }]);
    await syncChannel('chan-1');
    expect(db.videos.get('vid1')?.isShort).toBe(true);

    // Second pass: the detail lookup missed this video.
    fetchUploads.mockResolvedValue([
      { ...upload('vid1', 'A Short'), isShort: null, durationSeconds: null },
    ]);
    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isShort).toBe(true);
    expect(db.videos.get('vid1')?.durationSeconds).toBe(240);
  });

  it('still refreshes the shape when a sync does learn one', async () => {
    fetchUploads.mockResolvedValue([{ ...upload('vid1', 'Clip'), isShort: false }]);
    await syncChannel('chan-1');

    fetchUploads.mockResolvedValue([{ ...upload('vid1', 'Clip'), isShort: true }]);
    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isShort).toBe(true);
  });

  it('starts videos hidden when the channel default is Review First', async () => {
    fetchUploads.mockResolvedValue([upload('vid1', 'Worship Song')]);

    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isVisible).toBe(false);
  });

  it('starts videos visible when the channel default is Automatically Show', async () => {
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({
      ...CHANNEL,
      defaultVideoVisibility: 'AUTO_SHOW',
    });
    fetchUploads.mockResolvedValue([upload('vid1', 'Worship Song')]);

    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isVisible).toBe(true);
  });

  it('refreshes the YouTube title but preserves the website override (Rule 7)', async () => {
    fetchUploads.mockResolvedValue([upload('vid1', 'ORIGINAL YOUTUBE TITLE')]);
    await syncChannel('chan-1');

    // The administrator customises the record and publishes it.
    db.videos.set('vid1', {
      ...db.videos.get('vid1'),
      displayTitle: 'New Worship Release 2026',
      displayDescription: 'A hand-written description.',
      isVisible: true,
      // Set by hand on the editor, never by the sync — the API will not tell us
      // which videos YouTube labels as AI.
      isAiDisclosed: true,
    });

    // YouTube's title later changes and a sync runs again.
    fetchUploads.mockResolvedValue([upload('vid1', 'RENAMED ON YOUTUBE')]);
    await syncChannel('chan-1');

    const stored = db.videos.get('vid1')!;

    expect(stored.youtubeTitle).toBe('RENAMED ON YOUTUBE');
    expect(stored.displayTitle).toBe('New Worship Release 2026');
    expect(stored.displayDescription).toBe('A hand-written description.');
    expect(stored.isVisible).toBe(true);
    expect(stored.isAiDisclosed).toBe(true);
  });

  it('reports a failure instead of throwing, and does not stamp lastSyncedAt', async () => {
    fetchUploads.mockRejectedValue(new Error('quotaExceeded'));

    const result = await syncChannel('chan-1');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('quotaExceeded');

    const updateCall = prismaMock.youTubeChannel.update.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.lastSyncedAt).toBeUndefined();
    expect(updateCall.data.lastSyncError).toContain('quotaExceeded');
  });

  it('skips a channel that is not active', async () => {
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({ ...CHANNEL, isActive: false });

    const result = await syncChannel('chan-1');

    expect(result.skipped).toBe(1);
    expect(fetchUploads).not.toHaveBeenCalled();
  });
});
