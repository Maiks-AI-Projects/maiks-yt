import { describe, expect, it } from "vitest";

import {
  canManageStreamSchedule,
  isValidStreamScheduleCancellationInput,
  isValidStreamScheduleInput,
  isValidStreamScheduleUpdateInput,
  normalizeStreamScheduleInput,
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

  it("allows owner wildcard and schedule-specific permissions", () => {
    expect(canManageStreamSchedule(["*"])).toBe(true);
    expect(canManageStreamSchedule(["schedule:manage"])).toBe(true);
    expect(canManageStreamSchedule(["project-admin:manage"])).toBe(false);
  });
});
