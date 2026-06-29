import {
  fakeLocalModerationActions,
  fakeLocalModerationCapability,
  type FakeLocalModerationAction,
  type FakeLocalModerationCommandInput,
  type FakeLocalModerationValidationIssue,
  type FakeLocalModerationValidationResult,
  type NormalizedFakeLocalModerationCommand
} from "./fake-local-moderation.types.js";

const actionSet = new Set<string>(fakeLocalModerationActions);
const maxNoteLength = 280;
const minMuteDurationSeconds = 30;
const maxMuteDurationSeconds = 15 * 60;

export const canModerateFakeLocalChat = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is string =>
    capability === "*" || capability === fakeLocalModerationCapability
  );

export const isFakeLocalModerationAction = (
  value: unknown
): value is FakeLocalModerationAction =>
  typeof value === "string" && actionSet.has(value);

const normalizeText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeFakeLocalModerationCommand = (
  input: FakeLocalModerationCommandInput
): NormalizedFakeLocalModerationCommand => ({
  action: input.action,
  targetMessageId: normalizeText(input.targetMessageId),
  targetAuthorName: normalizeText(input.targetAuthorName),
  durationSeconds: input.durationSeconds ?? null,
  note: normalizeText(input.note)
});

export const validateFakeLocalModerationCommand = (
  input: FakeLocalModerationCommandInput
): FakeLocalModerationValidationResult => {
  const command = normalizeFakeLocalModerationCommand(input);
  const issues: FakeLocalModerationValidationIssue[] = [];

  if (!isFakeLocalModerationAction(command.action)) {
    issues.push("fake_local_moderation_invalid_action");
  }

  if (command.action === "hide_message" && !command.targetMessageId) {
    issues.push("fake_local_moderation_message_id_required");
  }

  if (
    (command.action === "warn_author"
      || command.action === "temporary_mute_author"
      || command.action === "note_author")
    && !command.targetAuthorName
  ) {
    issues.push("fake_local_moderation_author_required");
  }

  if (command.action === "temporary_mute_author") {
    if (command.durationSeconds === null) {
      issues.push("fake_local_moderation_duration_required");
    } else if (
      !Number.isInteger(command.durationSeconds)
      || command.durationSeconds < minMuteDurationSeconds
      || command.durationSeconds > maxMuteDurationSeconds
    ) {
      issues.push("fake_local_moderation_duration_out_of_range");
    }
  }

  if (command.note !== null && command.note.length > maxNoteLength) {
    issues.push("fake_local_moderation_note_too_long");
  }

  return issues.length === 0
    ? {
      ok: true,
      command
    }
    : {
      ok: false,
      issues,
      command
    };
};
