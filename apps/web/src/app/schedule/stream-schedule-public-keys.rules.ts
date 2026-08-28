import type { PublicStreamScheduleEntry, PublicStreamScheduleGameLink } from "@maiks-yt/domain/schedule";

export const getPublicScheduleEntryKey = (
  stream: Pick<PublicStreamScheduleEntry, "channelKey" | "startsAt" | "status" | "title" | "topicKey">,
  index: number
): string => [index, stream.status, stream.startsAt, stream.channelKey, stream.topicKey ?? "general", stream.title].join(":");

export const getPublicScheduleGameLinkKey = (
  gameLink: Pick<PublicStreamScheduleGameLink, "relationship" | "slug" | "title">,
  index: number
): string => [index, gameLink.slug, gameLink.relationship, gameLink.title].join(":");
