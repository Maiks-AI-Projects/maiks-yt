import { randomUUID } from "node:crypto";

import {
  canModerateFakeLocalChat,
  validateFakeLocalModerationCommand,
  type FakeLocalModerationCommandInput,
  type NormalizedFakeLocalModerationCommand
} from "@maiks-yt/domain/community";

import type {
  FakeLocalModerationActor,
  FakeLocalModerationAuditEntry,
  FakeLocalModerationCommandResult,
  FakeLocalModerationRuntime
} from "./fake-local-moderation.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeFakeLocalModerationPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const fallbackCommand: NormalizedFakeLocalModerationCommand = {
  action: "noop",
  targetMessageId: null,
  targetAuthorName: null,
  durationSeconds: null,
  note: null
};

const createAuditEntry = ({
  actor,
  command,
  mutedUntil,
  outcome,
  reason
}: {
  actor: FakeLocalModerationActor | null;
  command: NormalizedFakeLocalModerationCommand;
  mutedUntil?: string | null;
  outcome: FakeLocalModerationAuditEntry["outcome"];
  reason: string | null;
}): FakeLocalModerationAuditEntry => ({
  id: randomUUID(),
  attemptedAt: new Date().toISOString(),
  source: "fake-local",
  actorUserId: actor?.domainUserId ?? null,
  actorDisplayName: actor?.displayName ?? null,
  action: command.action,
  outcome,
  reason,
  targetMessageId: command.targetMessageId,
  targetAuthorName: command.targetAuthorName,
  durationSeconds: command.durationSeconds,
  mutedUntil: mutedUntil ?? null,
  note: command.note,
  providerAction: false
});

export class FakeLocalModerationService {
  public constructor(
    private readonly repository: {
      resolveActor(authUserId: string): Promise<FakeLocalModerationActor | null>;
    },
    private readonly runtime: FakeLocalModerationRuntime
  ) {}

  public async executeCommand(input: {
    authUserId: string;
    command: FakeLocalModerationCommandInput;
  }): Promise<FakeLocalModerationCommandResult> {
    const validation = validateFakeLocalModerationCommand(input.command);
    const actor = await this.repository.resolveActor(input.authUserId);
    const command = validation.command;

    if (!validation.ok) {
      const auditEntry = createAuditEntry({
        actor,
        command,
        outcome: "invalid",
        reason: "fake_local_moderation_invalid_input"
      });
      this.runtime.appendAudit(auditEntry);

      return {
        ok: false,
        reason: "fake_local_moderation_invalid_input",
        issues: validation.issues,
        auditEntry,
        source: "fake-local",
        providerAction: false
      };
    }

    if (!actor) {
      const auditEntry = createAuditEntry({
        actor: null,
        command,
        outcome: "denied",
        reason: "fake_local_moderation_user_unlinked"
      });
      this.runtime.appendAudit(auditEntry);

      return {
        ok: false,
        reason: "fake_local_moderation_user_unlinked",
        auditEntry,
        source: "fake-local",
        providerAction: false
      };
    }

    if (!canModerateFakeLocalChat(normalizeFakeLocalModerationPermissions(actor.rolePermissionValues))) {
      const auditEntry = createAuditEntry({
        actor,
        command,
        outcome: "denied",
        reason: "fake_local_moderation_forbidden"
      });
      this.runtime.appendAudit(auditEntry);

      return {
        ok: false,
        reason: "fake_local_moderation_forbidden",
        auditEntry,
        source: "fake-local",
        providerAction: false
      };
    }

    if (command.action === "hide_message") {
      const affectedMessage = command.targetMessageId
        ? this.runtime.hideMessage(command.targetMessageId, new Date().toISOString())
        : null;
      const auditEntry = createAuditEntry({
        actor,
        command,
        outcome: affectedMessage ? "applied" : "not_found",
        reason: affectedMessage ? null : "fake_local_moderation_message_not_found"
      });
      this.runtime.appendAudit(auditEntry);

      return {
        ok: true,
        command,
        auditEntry,
        affectedMessage,
        source: "fake-local",
        providerAction: false
      };
    }

    if (command.action === "temporary_mute_author") {
      const mutedUntil = new Date(Date.now() + (command.durationSeconds ?? 0) * 1_000).toISOString();
      this.runtime.muteAuthor(command.targetAuthorName ?? "", mutedUntil);
      const auditEntry = createAuditEntry({
        actor,
        command,
        mutedUntil,
        outcome: "applied",
        reason: null
      });
      this.runtime.appendAudit(auditEntry);

      return {
        ok: true,
        command,
        auditEntry,
        affectedMessage: null,
        source: "fake-local",
        providerAction: false
      };
    }

    const auditEntry = createAuditEntry({
      actor,
      command,
      outcome: command.action === "noop" ? "no_op" : "applied",
      reason: command.action === "noop" ? "fake_local_moderation_explicit_noop" : null
    });
    this.runtime.appendAudit(auditEntry);

    return {
      ok: true,
      command,
      auditEntry,
      affectedMessage: null,
      source: "fake-local",
      providerAction: false
    };
  }

  public recordUnauthenticatedAttempt(command?: NormalizedFakeLocalModerationCommand): FakeLocalModerationAuditEntry {
    const auditEntry = createAuditEntry({
      actor: null,
      command: command ?? fallbackCommand,
      outcome: "denied",
      reason: "not_authenticated"
    });
    this.runtime.appendAudit(auditEntry);

    return auditEntry;
  }
}
