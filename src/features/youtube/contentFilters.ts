import type { Prisma } from '@prisma/client';

/**
 * The filter behind Admin → YouTube Content (section 20).
 *
 * Shared deliberately. The list page uses it to decide which rows to DISPLAY and
 * `bulkSetVideoVisibilityAction` uses it to decide which rows to CHANGE when the
 * administrator picks "select all matching this filter" — so the bulk action
 * never trusts a list of ids from the browser, it re-derives the set here.
 *
 * Two copies of this logic would be a correctness bug rather than duplication:
 * the moment they drifted, the bulk action would act on a different set than the
 * one on screen.
 */

export type VideoListParams = {
  q?: string;
  filter?: string;
  channel?: string;
  /** The Videos / Shorts toggle on the table. */
  type?: string;
};

export function buildVideoListWhere(params: VideoListParams): Prisma.YouTubeVideoWhereInput {
  const where: Prisma.YouTubeVideoWhereInput = {};

  if (params.q) {
    // Search covers both titles — the administrator may remember either.
    where.OR = [
      { youtubeTitle: { contains: params.q, mode: 'insensitive' } },
      { displayTitle: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  if (params.channel && params.channel !== 'all') where.channelId = params.channel;

  switch (params.filter) {
    case 'visible':
      where.isVisible = true;
      break;
    case 'hidden':
      where.isVisible = false;
      break;
    case 'recent':
      where.importedAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case 'shorts':
      where.isShort = true;
      break;
    case 'regular':
      where.isShort = false;
      break;
    case 'ai':
      where.isAiDisclosed = true;
      break;
    default:
      break;
  }

  /*
   * The toggle is applied LAST and overwrites `isShort`, so it beats the Filter
   * dropdown's own Shorts / Regular videos entries.
   *
   * Both controls can set this field, and left to fight they produce an
   * impossible query — dropdown "Shorts" with the toggle on "Videos" returns
   * zero rows for no visible reason. The toggle wins because it is the larger,
   * more obvious control sitting on the table itself. On "All" it sets nothing,
   * so the dropdown behaves exactly as it did before the toggle existed.
   */
  if (params.type === 'videos') where.isShort = false;
  else if (params.type === 'shorts') where.isShort = true;

  return where;
}
