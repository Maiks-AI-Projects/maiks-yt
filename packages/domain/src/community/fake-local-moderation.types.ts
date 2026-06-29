export const fakeLocalModerationCapability = "fake-local-chat:moderate" as const;

export const fakeLocalModerationActions = [
  "warn_author",
  "hide_message",
  "temporary_mute_author",
  "note_author",
  "noop"
] as const;

export type FakeLocalModerationAction = typeof fakeLocalModerationActions[number];

export const fakeLocalModerationOutcomes = [
  "applied",
  "denied",
  "invalid",
  "not_found",
  "no_op"
] as const;

export type FakeLocalModerationOutcome = typeof fakeLocalModerationOutcomes[number];

export type FakeLocalModerationCommandInput = {
  action: FakeLocalModerationAction;
  targetMessageId?: string | null;
  targetAuthorName?: string | null;
  durationSeconds?: number | null;
  note?: string | null;
};

export type NormalizedFakeLocalModerationCommand = {
  action: FakeLocalModerationAction;
  targetMessageId: string | null;
  targetAuthorName: string | null;
  durationSeconds: number | null;
  note: string | null;
};

export type FakeLocalModerationValidationIssue =
  | "fake_local_moderation_invalid_action"
  | "fake_local_moderation_message_id_required"
  | "fake_local_moderation_author_required"
  | "fake_local_moderation_duration_required"
  | "fake_local_moderation_duration_out_of_range"
  | "fake_local_moderation_note_too_long";

export type FakeLocalModerationValidationResult =
  | {
    ok: true;
    command: NormalizedFakeLocalModerationCommand;
  }
  | {
    ok: false;
    issues: readonly FakeLocalModerationValidationIssue[];
    command: NormalizedFakeLocalModerationCommand;
  };
