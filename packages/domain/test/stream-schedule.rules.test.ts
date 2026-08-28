import { describe, expect, it } from "vitest";

import {
  canManageStreamSchedule,
  buildPublicStreamScheduleEntry,
  isValidStreamScheduleCancellationInput,
  isValidStreamScheduleGameLinkInputs,
  isValidStreamScheduleInput,
  isValidStreamScheduleUpdateInput,
  normalizeStreamScheduleGameLinkInputs,
  normalizeStreamScheduleInput,
  type StreamScheduleEntry,
  type StreamScheduleInput
} from "../src/schedule/index.js";

const baseInput = {
  title: "Maiks.yt build stream",
  description: "Working on the public schedule slice.",
  startsAt: "2026-06-20T18:00:00.000Z",
  endsAt: "2026-06-20T20:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  projectId: null,
  focusLabel: null,
  focusNote: null,
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null
} satisfies StreamScheduleInput;

describe("stream schedule rules", () => {
  it("accepts planned schedule entries and trims optional fields", () => {
    expect(isValidStreamScheduleInput(baseInput)).toBe(true);
    expect(normalizeStreamScheduleInput({
      ...baseInput,
      title: "  Build stream  ",
      description: "  notes  ",
      topicKey: "",
      focusLabel: "  Stream focus  ",
      focusNote: "  Build the schedule bridge  "
    })).toMatchObject({
      title: "Build stream",
      description: "notes",
      topicKey: null,
      focusLabel: "Stream focus",
      focusNote: "Build the schedule bridge"
    });
  });

  it("accepts optional manual focus fields but keeps them bounded", () => {
    expect(isValidStreamScheduleInput({
      ...baseInput,
      projectId: "00000000-0000-4000-8000-000000000020",
      focusLabel: "Stream focus",
      focusNote: "Working on the creator platform schedule flow."
    })).toBe(true);
    expect(isValidStreamScheduleInput({
      ...baseInput,
      focusLabel: "x".repeat(121)
    })).toBe(false);
    expect(isValidStreamScheduleUpdateInput({
      projectId: null,
      focusLabel: null,
      focusNote: null
    })).toBe(true);
  });

  it("rejects invalid windows and stray cancellation fields", () => {
    expect(isValidStreamScheduleInput({
      ...baseInput,
      endsAt: "2026-06-20T17:00:00.000Z"
    })).toBe(false);
    expect(isValidStreamScheduleInput({
      ...baseInput,
      cancellationReasonCode: "health",
      cancellationReason: "Need rest."
    })).toBe(false);
  });

  it("requires constrained cancellation reasons for cancelled streams", () => {
    expect(isValidStreamScheduleInput({
      ...baseInput,
      status: "cancelled",
      cancellationReasonCode: "energy",
      cancellationReason: "I need to recover and will reschedule later."
    })).toBe(true);
    expect(isValidStreamScheduleCancellationInput({
      cancellationReasonCode: "technical",
      cancellationReason: "The stream setup needs repair."
    })).toBe(true);
    expect(isValidStreamScheduleCancellationInput({
      cancellationReasonCode: "other",
      cancellationReason: ""
    })).toBe(false);
  });

  it("allows partial updates but rejects empty updates", () => {
    expect(isValidStreamScheduleUpdateInput({
      title: "Updated stream title"
    })).toBe(true);
    expect(isValidStreamScheduleUpdateInput({})).toBe(false);
  });

  it("normalizes and bounds stream game links", () => {
    expect(normalizeStreamScheduleGameLinkInputs([
      {
        gameId: " game-1 ",
        relationship: "planned",
        publicNote: "  Fresh run  "
      }
    ])).toEqual([
      {
        gameId: "game-1",
        relationship: "planned",
        publicNote: "Fresh run",
        sortOrder: 0
      }
    ]);
    expect(isValidStreamScheduleGameLinkInputs([
      {
        gameId: "game-1",
        relationship: "planned",
        publicNote: "Fresh run",
        sortOrder: 0
      }
    ])).toBe(true);
    expect(isValidStreamScheduleGameLinkInputs([
      {
        gameId: "game-1",
        relationship: "planned"
      },
      {
        gameId: "game-1",
        relationship: "current"
      }
    ])).toBe(false);
    expect(isValidStreamScheduleGameLinkInputs([
      {
        gameId: "game-1",
        relationship: "planned",
        publicNote: "x".repeat(281)
      }
    ])).toBe(false);
  });

  it("allows owner wildcard and schedule-specific permissions", () => {
    expect(canManageStreamSchedule(["*"])).toBe(true);
    expect(canManageStreamSchedule(["schedule:manage"])).toBe(true);
    expect(canManageStreamSchedule(["project-admin:manage"])).toBe(false);
  });

  it("builds the anonymous public schedule contract without raw internal identifiers", () => {
    const publicEntry = buildPublicStreamScheduleEntry({
      id: "stream-raw-id",
      title: "Maiks.yt public stream",
      description: "Public description.",
      startsAt: "2026-08-28T18:00:00.000Z",
      endsAt: null,
      channelKey: "coding",
      topicKey: "maiks-yt",
      themeKey: "internal-theme",
      projectId: "project-raw-id",
      focusLabel: "Project focus",
      focusNote: "Public focus note.",
      focusProject: {
        id: "project-raw-id",
        slug: "maiks-yt-v2",
        title: "Maiks.yt V2"
      },
      gameLinks: [
        {
          id: "game-link-raw-id",
          gameId: "game-raw-id",
          slug: "satisfactory",
          title: "Satisfactory",
          platformLabel: "PC",
          ownershipStatus: "owned",
          interestStatus: "currently-playing",
          relationship: "planned",
          publicNote: "Factory prep.",
          sortOrder: 42
        }
      ],
      visibility: "public",
      status: "planned",
      cancellationReasonCode: null,
      cancellationReason: null,
      createdAt: "2026-08-28T12:00:00.000Z",
      updatedAt: "2026-08-28T12:30:00.000Z"
    } satisfies StreamScheduleEntry);

    expect(publicEntry).toEqual({
      title: "Maiks.yt public stream",
      description: "Public description.",
      startsAt: "2026-08-28T18:00:00.000Z",
      endsAt: null,
      channelKey: "coding",
      topicKey: "maiks-yt",
      focusLabel: "Project focus",
      focusNote: "Public focus note.",
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
      cancellationReason: null
    });
    expect(JSON.stringify(publicEntry)).not.toContain("\"id\"");
    expect(JSON.stringify(publicEntry)).not.toContain("raw-id");
    expect(JSON.stringify(publicEntry)).not.toContain("projectId");
    expect(JSON.stringify(publicEntry)).not.toContain("gameId");
    expect(JSON.stringify(publicEntry)).not.toContain("themeKey");
    expect(JSON.stringify(publicEntry)).not.toContain("createdAt");
    expect(JSON.stringify(publicEntry)).not.toContain("updatedAt");
    expect(JSON.stringify(publicEntry)).not.toContain("visibility");
    expect(JSON.stringify(publicEntry)).not.toContain("sortOrder");
  });
});
