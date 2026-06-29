import { describe, expect, it } from "vitest";

import {
  canModerateFakeLocalChat,
  fakeLocalModerationCapability,
  validateFakeLocalModerationCommand
} from "../src/community/index.js";

describe("fake/local moderation rules", () => {
  it("allows owner wildcard or the narrow fake/local moderation capability only", () => {
    expect(canModerateFakeLocalChat(["*"])).toBe(true);
    expect(canModerateFakeLocalChat([fakeLocalModerationCapability])).toBe(true);
    expect(canModerateFakeLocalChat(["moderators:manage"])).toBe(false);
    expect(canModerateFakeLocalChat(["money:review"])).toBe(false);
  });

  it("validates safe fake/local command requirements", () => {
    expect(validateFakeLocalModerationCommand({
      action: "hide_message",
      targetMessageId: "message-1"
    })).toMatchObject({
      ok: true,
      command: {
        action: "hide_message",
        targetMessageId: "message-1"
      }
    });

    expect(validateFakeLocalModerationCommand({
      action: "temporary_mute_author",
      targetAuthorName: "Test chatter",
      durationSeconds: 120
    })).toMatchObject({
      ok: true,
      command: {
        action: "temporary_mute_author",
        targetAuthorName: "Test chatter",
        durationSeconds: 120
      }
    });
  });

  it("rejects missing targets and unsafe duration shapes", () => {
    expect(validateFakeLocalModerationCommand({
      action: "hide_message"
    })).toMatchObject({
      ok: false,
      issues: ["fake_local_moderation_message_id_required"]
    });

    expect(validateFakeLocalModerationCommand({
      action: "temporary_mute_author",
      targetAuthorName: "Test chatter",
      durationSeconds: 3
    })).toMatchObject({
      ok: false,
      issues: ["fake_local_moderation_duration_out_of_range"]
    });
  });
});
