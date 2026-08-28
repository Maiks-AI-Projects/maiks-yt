import { describe, expect, it } from "vitest";
import {
  streamScheduleDescriptionMaxLength,
  streamScheduleGameLinkMaxCount,
  streamScheduleTitleMaxLength
} from "@maiks-yt/domain/schedule";

import { parseStreamScheduleApiResponse } from "./stream-schedule-public-parser.rules";

const createPublicStream = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: "Maiks.yt build stream",
  description: "Public schedule note.",
  startsAt: "2026-08-28T18:00:00.000Z",
  endsAt: "2026-08-28T20:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  focusLabel: "Project focus",
  focusNote: "Working on the creator platform.",
  focusProject: {
    slug: "maiks-yt-v2",
    title: "Maiks.yt V2"
  },
  gameLinks: [
    {
      slug: "satisfactory",
      title: "Satisfactory",
      platformLabel: "PC",
      relationship: "planned",
      publicNote: "Factory prep."
    }
  ],
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  ...overrides
});

describe("stream schedule public data parsing", () => {
  it("accepts the finite anonymous schedule contract without raw identifiers", () => {
    const parsed = parseStreamScheduleApiResponse({
      ok: true,
      streams: [createPublicStream()]
    });

    expect(parsed).toEqual({
      ok: true,
      streams: [createPublicStream()]
    });
    expect(JSON.stringify(parsed)).not.toContain("\"id\"");
    expect(JSON.stringify(parsed)).not.toContain("gameId");
  });

  it.each([
    ["schedule entry id", { id: "raw-schedule-id" }],
    ["project id", { projectId: "raw-project-id" }],
    ["focus project id", {
      focusProject: {
        slug: "maiks-yt-v2",
        title: "Maiks.yt V2",
        id: "raw-project-id"
      }
    }],
    ["game link id", {
      gameLinks: [
        {
          slug: "satisfactory",
          title: "Satisfactory",
          platformLabel: "PC",
          relationship: "planned",
          publicNote: "Factory prep.",
          id: "raw-link-id"
        }
      ]
    }],
    ["game id", {
      gameLinks: [
        {
          slug: "satisfactory",
          title: "Satisfactory",
          platformLabel: "PC",
          relationship: "planned",
          publicNote: "Factory prep.",
          gameId: "raw-game-id"
        }
      ]
    }],
    ["internal game metadata", {
      gameLinks: [
        {
          slug: "satisfactory",
          title: "Satisfactory",
          platformLabel: "PC",
          relationship: "planned",
          publicNote: "Factory prep.",
          ownershipStatus: "owned"
        }
      ]
    }],
    ["internal ordering", {
      gameLinks: [
        {
          slug: "satisfactory",
          title: "Satisfactory",
          platformLabel: "PC",
          relationship: "planned",
          publicNote: "Factory prep.",
          sortOrder: 0
        }
      ]
    }],
    ["theme key", { themeKey: "internal-theme" }],
    ["visibility", { visibility: "public" }],
    ["created timestamp", { createdAt: "2026-08-28T12:00:00.000Z" }],
    ["updated timestamp", { updatedAt: "2026-08-28T12:00:00.000Z" }]
  ])("rejects extra/internal fields in the public schedule contract: %s", (_label, overrides) => {
    expect(parseStreamScheduleApiResponse({
      ok: true,
      streams: [createPublicStream(overrides)]
    })).toBeNull();
  });

  it("rejects extra fields on the response envelope", () => {
    expect(parseStreamScheduleApiResponse({
      ok: true,
      streams: [createPublicStream()],
      debug: "internal"
    })).toBeNull();
  });

  it("accepts the finite public schedule failure reason", () => {
    expect(parseStreamScheduleApiResponse({
      ok: false,
      reason: "stream_schedule_unavailable"
    })).toEqual({
      ok: false,
      reason: "stream_schedule_unavailable"
    });
  });

  it.each([
    "database_error",
    "not_authenticated",
    "stream_schedule_not_found"
  ])("rejects non-public schedule failure reasons: %s", (reason) => {
    expect(parseStreamScheduleApiResponse({
      ok: false,
      reason
    })).toBeNull();
  });

  it("rejects impossible public cancellation state", () => {
    expect(parseStreamScheduleApiResponse({
      ok: true,
      streams: [
        createPublicStream({
          status: "planned",
          cancellationReasonCode: "energy",
          cancellationReason: "Rest."
        })
      ]
    })).toBeNull();
    expect(parseStreamScheduleApiResponse({
      ok: true,
      streams: [
        createPublicStream({
          status: "cancelled",
          cancellationReasonCode: "energy",
          cancellationReason: "Rest."
        })
      ]
    })).toMatchObject({
      ok: true
    });
  });

  it.each([
    ["overlong title", { title: "x".repeat(streamScheduleTitleMaxLength + 1) }],
    ["overlong description", { description: "x".repeat(streamScheduleDescriptionMaxLength + 1) }],
    ["non-canonical start timestamp", { startsAt: "2026-08-28T18:00:00Z" }],
    ["invalid start timestamp", { startsAt: "not-a-date" }],
    ["end before start", { endsAt: "2026-08-28T17:59:59.999Z" }],
    ["end equal to start", { endsAt: "2026-08-28T18:00:00.000Z" }],
    ["focus text without a public project", {
      focusProject: null,
      focusLabel: "Private project focus",
      focusNote: "This must stay private."
    }],
    ["too many game links", {
      gameLinks: Array.from({ length: streamScheduleGameLinkMaxCount + 1 }, (_, index) => ({
        slug: `game-${index}`,
        title: `Game ${index}`,
        platformLabel: null,
        relationship: "planned",
        publicNote: null
      }))
    }]
  ])("rejects malformed bounded public schedule data: %s", (_label, overrides) => {
    expect(parseStreamScheduleApiResponse({
      ok: true,
      streams: [createPublicStream(overrides)]
    })).toBeNull();
  });
});
