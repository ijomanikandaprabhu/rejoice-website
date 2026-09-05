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

const fetchUploadsPage = vi.fn();

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/youtube/youtubeClient', () => ({
  fetchUploadsPage: (...args: unknown[]) => fetchUploadsPage(...args),
  fetchVideosByIds: vi.fn(),
  YouTubeNotConfiguredError: class extends Error {},
}));

/**
 * A single, final page — the shape almost every test below wants. Omitting
 * `nextPageToken` is what tells the sync the catalogue is complete.
 */
function onePage(videos: unknown[]) {
  return { videos, nextPageToken: undefined };
}

const { syncChannel } = await import('@/services/youtube/videoSyncService');

const CHANNEL = {
  id: 'chan-1',
  name: 'Rejoice Gospel Communications',
  uploadsPlaylistId: 'UU123',
  isActive: true,
  defaultVideoVisibility: 'REVIEW_FIRST' as const,
  /** Null = no import in progress, the state of a fully imported channel. */
  importCursor: null as string | null,
};

/** The `data` of the last `youTubeChannel.update` the sync issued. */
function lastChannelUpdate() {
  return (
    prismaMock.youTubeChannel.update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> }
  ).data;
}

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
    fetchUploadsPage.mockResolvedValue(onePage([upload('vid1', 'Worship Song'), upload('vid2', 'Gospel Release')]));

    const result = await syncChannel('chan-1');

    expect(result.ok).toBe(true);
    expect(result.imported).toBe(2);
    expect(db.videos.size).toBe(2);
  });

  it('does not import the same video twice', async () => {
    const uploads = [upload('vid1', 'Worship Song')];
    fetchUploadsPage.mockResolvedValue(onePage(uploads));

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
    fetchUploadsPage.mockResolvedValue(onePage([{ ...upload('vid1', 'A Short'), isShort: true }]));
    await syncChannel('chan-1');
    expect(db.videos.get('vid1')?.isShort).toBe(true);

    // Second pass: the detail lookup missed this video.
    fetchUploadsPage.mockResolvedValue(onePage([
      { ...upload('vid1', 'A Short'), isShort: null, durationSeconds: null },
    ]));
    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isShort).toBe(true);
    expect(db.videos.get('vid1')?.durationSeconds).toBe(240);
  });

  it('still refreshes the shape when a sync does learn one', async () => {
    fetchUploadsPage.mockResolvedValue(onePage([{ ...upload('vid1', 'Clip'), isShort: false }]));
    await syncChannel('chan-1');

    fetchUploadsPage.mockResolvedValue(onePage([{ ...upload('vid1', 'Clip'), isShort: true }]));
    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isShort).toBe(true);
  });

  it('starts videos hidden when the channel default is Review First', async () => {
    fetchUploadsPage.mockResolvedValue(onePage([upload('vid1', 'Worship Song')]));

    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isVisible).toBe(false);
  });

  it('starts videos visible when the channel default is Automatically Show', async () => {
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({
      ...CHANNEL,
      defaultVideoVisibility: 'AUTO_SHOW',
    });
    fetchUploadsPage.mockResolvedValue(onePage([upload('vid1', 'Worship Song')]));

    await syncChannel('chan-1');

    expect(db.videos.get('vid1')?.isVisible).toBe(true);
  });

  it('refreshes the YouTube title but preserves the website override (Rule 7)', async () => {
    fetchUploadsPage.mockResolvedValue(onePage([upload('vid1', 'ORIGINAL YOUTUBE TITLE')]));
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
    fetchUploadsPage.mockResolvedValue(onePage([upload('vid1', 'RENAMED ON YOUTUBE')]));
    await syncChannel('chan-1');

    const stored = db.videos.get('vid1')!;

    expect(stored.youtubeTitle).toBe('RENAMED ON YOUTUBE');
    expect(stored.displayTitle).toBe('New Worship Release 2026');
    expect(stored.displayDescription).toBe('A hand-written description.');
    expect(stored.isVisible).toBe(true);
    expect(stored.isAiDisclosed).toBe(true);
  });

  it('reports a failure instead of throwing, and does not stamp lastSyncedAt', async () => {
    fetchUploadsPage.mockRejectedValue(new Error('quotaExceeded'));

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
    expect(fetchUploadsPage).not.toHaveBeenCalled();
  });
});

/*
 * Resumable deep import.
 *
 * A fixed 40-page cap used to bound this, silently truncating any channel past
 * 2,000 videos while still reporting success. It now walks until YouTube stops
 * offering a page — and because that can outlast a serverless invocation, a run
 * that hits its time budget stores where it got to and the next one continues.
 */
describe('syncChannel deep import', () => {
  /** Pages served in order, each advancing the clock by `msPerPage`. */
  function servePages(pages: Array<{ videos: unknown[]; nextPageToken?: string }>, msPerPage = 0) {
    let call = 0;
    fetchUploadsPage.mockImplementation(async () => {
      const page = pages[Math.min(call, pages.length - 1)];
      call++;
      if (msPerPage) vi.advanceTimersByTime(msPerPage);
      return page;
    });
  }

  it('keeps paging until YouTube stops offering one, past the old 2,000 limit', async () => {
    // 45 pages of 50 = 2,250 videos: more than the removed cap allowed.
    const pages = Array.from({ length: 45 }, (_, p) => ({
      videos: Array.from({ length: 50 }, (_, i) => upload(`p${p}v${i}`, 'Song')),
      nextPageToken: p === 44 ? undefined : `tok${p + 1}`,
    }));
    servePages(pages);

    const result = await syncChannel('chan-1', true);

    expect(result.imported).toBe(2250);
    expect(db.videos.size).toBe(2250);
    expect(result.importing).toBe(false);
    expect(lastChannelUpdate().importCursor).toBeNull();
  });

  it('stores its place when the time budget runs out, and reports it as unfinished', async () => {
    vi.useFakeTimers();
    try {
      // 30 seconds a page against a 40-second budget: stops after page two.
      servePages(
        [
          { videos: [upload('vid1', 'One')], nextPageToken: 'tok1' },
          { videos: [upload('vid2', 'Two')], nextPageToken: 'tok2' },
          { videos: [upload('vid3', 'Three')], nextPageToken: 'tok3' },
        ],
        30_000,
      );

      const result = await syncChannel('chan-1', true);

      expect(result.ok).toBe(true);
      expect(result.importing).toBe(true);
      // Both fetched pages were saved — an interrupted run keeps its work.
      expect(db.videos.size).toBe(2);
      expect(lastChannelUpdate().importCursor).toBe('tok2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes from the stored cursor rather than starting again at the newest', async () => {
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({ ...CHANNEL, importCursor: 'tok2' });
    servePages([{ videos: [upload('vid9', 'Old')], nextPageToken: undefined }]);

    await syncChannel('chan-1');

    const tokens = fetchUploadsPage.mock.calls.map((c) => c[1]);
    // The newest page first so fresh uploads are not held up behind the
    // backlog, then the backfill continues from where it stopped.
    expect(tokens).toEqual([undefined, 'tok2']);
    expect(lastChannelUpdate().importCursor).toBeNull();
  });

  it('leaves the cursor alone when a run fails, so the catalogue is not restarted', async () => {
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({ ...CHANNEL, importCursor: 'tok2' });
    fetchUploadsPage.mockRejectedValue(new Error('quotaExceeded'));

    const result = await syncChannel('chan-1');

    expect(result.ok).toBe(false);
    expect(lastChannelUpdate()).not.toHaveProperty('importCursor');
  });

  it('stops instead of looping when YouTube hands back the same page token', async () => {
    fetchUploadsPage.mockResolvedValue({
      videos: [upload('vid1', 'Song')],
      nextPageToken: 'stuck',
    });
    prismaMock.youTubeChannel.findUnique.mockResolvedValue({ ...CHANNEL, importCursor: 'stuck' });

    const result = await syncChannel('chan-1');

    expect(result.ok).toBe(true);
    // Not declared complete: there may genuinely be more behind that token.
    expect(lastChannelUpdate().importCursor).toBe('stuck');
  });
});
