import type {
  FakeLocalModerationAction,
  FakeLocalModerationOutcome,
  NormalizedFakeLocalModerationCommand
} from "@maiks-yt/domain/community";
import type { StreamerChatMessage } from "@maiks-yt/events";

export type FakeLocalModerationActor = {
  domainUserId: string;
  displayName: string;
  rolePermissionValues: readonly unknown[];
};

export type FakeLocalModerationAuditEntry = {
  id: string;
  attemptedAt: string;
  source: "fake-local";
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: FakeLocalModerationAction;
  outcome: FakeLocalModerationOutcome;
  reason: string | null;
  targetMessageId: string | null;
  targetAuthorName: string | null;
  durationSeconds: number | null;
  mutedUntil: string | null;
  note: string | null;
  providerAction: false;
};

export type FakeLocalModerationCommandResult =
  | {
    ok: true;
    auditEntry: FakeLocalModerationAuditEntry;
    command: NormalizedFakeLocalModerationCommand;
    affectedMessage: StreamerChatMessage | null;
    source: "fake-local";
    providerAction: false;
  }
  | {
    ok: false;
    reason:
      | "fake_local_moderation_user_unlinked"
      | "fake_local_moderation_forbidden"
      | "fake_local_moderation_invalid_input";
    auditEntry: FakeLocalModerationAuditEntry;
    issues?: readonly string[];
    source: "fake-local";
    providerAction: false;
  };

export type FakeLocalMutedAuthor = {
  authorName: string;
  mutedUntil: string;
};

export interface FakeLocalModerationRepository {
  resolveActor(authUserId: string): Promise<FakeLocalModerationActor | null>;
  appendAudit(entry: FakeLocalModerationAuditEntry): Promise<void>;
}

export interface FakeLocalModerationRuntime {
  appendAudit(entry: FakeLocalModerationAuditEntry): void;
  hideMessage(messageId: string, hiddenAt: string): StreamerChatMessage | null;
  muteAuthor(authorName: string, mutedUntil: string): FakeLocalMutedAuthor;
}
