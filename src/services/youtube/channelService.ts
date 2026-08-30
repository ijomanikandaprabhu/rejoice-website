import 'server-only';

import type { VideoVisibilityDefault } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { fetchChannelById, resolveChannel } from './youtubeClient';
import { syncChannel } from './videoSyncService';

/** Connecting and maintaining the Rejoice YouTube channels (sections 9, 10, 21). */

const log = createLogger('channelService');

/**
 * Connect a channel from a pasted URL.
 *
 * Resolves the permanent channel ID first so that a channel is only ever stored
 * once, even if the administrator pastes a handle URL one time and a /channel/
 * URL the next.
 */
export async function connectChannel(
  url: string,
  defaultVideoVisibility: VideoVisibilityDefault,
): Promise<{ id: string; name: string }> {
  const info = await resolveChannel(url);

  const existing = await prisma.youTubeChannel.findUnique({
    where: { youtubeChannelId: info.channelId },
  });
  if (existing) {
    throw new Error(`${info.title} is already connected.`);
  }

  const channel = await prisma.youTubeChannel.create({
    data: {
      youtubeChannelId: info.channelId,
      name: info.title,
      handle: info.handle,
      url: info.url,
      description: info.description,
      thumbnail: info.thumbnail,
      uploadsPlaylistId: info.uploadsPlaylistId,
      subscriberCount: info.subscriberCount,
      channelViewCount: info.viewCount === null ? null : BigInt(info.viewCount),
      videoCount: info.videoCount,
      defaultVideoVisibility,
    },
  });

  log.info(`Connected channel ${channel.name} (${channel.youtubeChannelId})`);

  // First import runs deep so the admin immediately has the back catalogue to
  // work with. Nothing becomes public unless the default says so.
  await syncChannel(channel.id, true);

  return { id: channel.id, name: channel.name };
}

/** Refresh stored name/logo/uploads playlist from YouTube. */
export async function refreshChannelMetadata(channelDbId: string): Promise<void> {
  const channel = await prisma.youTubeChannel.findUnique({ where: { id: channelDbId } });
  if (!channel) throw new Error('Channel not found');

  const info = await fetchChannelById(channel.youtubeChannelId);

  await prisma.youTubeChannel.update({
    where: { id: channel.id },
    data: {
      name: info.title,
      handle: info.handle,
      url: info.url,
      description: info.description,
      thumbnail: info.thumbnail,
      uploadsPlaylistId: info.uploadsPlaylistId,
      // Mirrors, written only when learned — a hidden subscriber count comes
      // back absent, and 0 would be a claim rather than a reading.
      ...(info.subscriberCount !== null ? { subscriberCount: info.subscriberCount } : {}),
      ...(info.viewCount !== null ? { channelViewCount: BigInt(info.viewCount) } : {}),
      ...(info.videoCount !== null ? { videoCount: info.videoCount } : {}),
    },
  });
}

/**
 * Disconnect a channel.
 *
 * This removes the channel and its imported records from the Rejoice database.
 * It does not touch YouTube in any way (Rule 5).
 */
export async function disconnectChannel(channelDbId: string): Promise<void> {
  await prisma.youTubeChannel.delete({ where: { id: channelDbId } });
  log.info(`Disconnected channel ${channelDbId}`);
}

/** Channel rows for the admin screen, with their imported video counts (section 21). */
export async function listChannelsForAdmin() {
  return prisma.youTubeChannel.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { videos: true } },
    },
  });
}
