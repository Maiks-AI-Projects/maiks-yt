import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerFakeLocalModerationRoutes } from "../../src/fake-local-moderation/fake-local-moderation.route.js";
import { FakeLocalModerationService } from "../../src/fake-local-moderation/fake-local-moderation.service.js";
import type {
  FakeLocalModerationActor,
  FakeLocalModerationAuditEntry,
  FakeLocalModerationRepository,
  FakeLocalModerationRuntime,
  FakeLocalMutedAuthor
} from "../../src/fake-local-moderation/fake-local-moderation.types.js";
import type { StreamerChatMessage } from "@maiks-yt/events";

const now = "2026-06-28T10:00:00.000Z";

class FakeModerationRepository implements FakeLocalModerationRepository {
  public actor: FakeLocalModerationActor | null = {
    domainUserId: "owner-user",
    displayName: "Owner",
    rolePermissionValues: [["*"]]
  };
  public readonly auditEntries: FakeLocalModerationAuditEntry[] = [];

  public async resolveActor(): Promise<FakeLocalModerationActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async appendAudit(entry: FakeLocalModerationAuditEntry): Promise<void> {
    this.auditEntries.unshift(structuredClone(entry));
  }
}

class FakeModerationRuntime implements FakeLocalModerationRuntime {
  public readonly auditEntries: FakeLocalModerationAuditEntry[] = [];
  public readonly messages = new Map<string, StreamerChatMessage>([
    ["message-1", {
      id: "message-1",
      authorName: "Test chatter",
      authorKind: "human",
      message: "Hello from local test chat.",
      source: "fake-local",
      createdAt: now,
      visibleOnOverlayByDefault: true
    }]
  ]);
  public readonly mutedAuthors = new Map<string, FakeLocalMutedAuthor>();

  public appendAudit(entry: FakeLocalModerationAuditEntry): void {
    this.auditEntries.unshift(structuredClone(entry));
  }

  public hideMessage(messageId: string): StreamerChatMessage | null {
    const message = this.messages.get(messageId);

    if (!message) {
      return null;
    }

    this.messages.delete(messageId);
    return structuredClone(message);
  }

  public listAudit(limit: number): readonly FakeLocalModerationAuditEntry[] {
    return this.auditEntries.slice(0, limit).map((entry) => structuredClone(entry));
  }

  public muteAuthor(authorName: string, mutedUntil: string): FakeLocalMutedAuthor {
    const mutedAuthor = {
      authorName,
      mutedUntil
    };
    this.mutedAuthors.set(authorName.toLowerCase(), mutedAuthor);
    return mutedAuthor;
  }
}

const createServer = ({
  getAuthSession,
  repository,
  runtime
}: {
  getAuthSession: () => Promise<{ user: { id: string } } | null>;
  repository: FakeModerationRepository;
  runtime: FakeModerationRuntime;
}) => {
  const server = Fastify();
  const service = new FakeLocalModerationService(repository, runtime);

  registerFakeLocalModerationRoutes(server, {
    getAuthSession,
    getDatabasePool: () => {
      throw new Error("database should not be used");
    },
    runtime,
    createService: () => service
  });

  return server;
};

describe("fake/local moderation commands", () => {
  it("denies unauthenticated command attempts and records a local audit row", async () => {
    const repository = new FakeModerationRepository();
    const runtime = new FakeModerationRuntime();
    const server = createServer({
      getAuthSession: async () => null,
      repository,
      runtime
    });

    const response = await server.inject({
      method: "POST",
      url: "/fake-local-chat/moderation/commands",
      payload: {
        action: "hide_message",
        targetMessageId: "message-1"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      reason: "not_authenticated",
      source: "fake-local",
      providerAction: false,
      auditEntry: {
        outcome: "denied",
        reason: "not_authenticated",
        providerAction: false
      }
    });
    expect(runtime.auditEntries).toHaveLength(1);
    expect(repository.auditEntries).toHaveLength(1);
    expect(repository.auditEntries[0]).toMatchObject({
      source: "fake-local",
      outcome: "denied",
      providerAction: false
    });
    expect(runtime.messages.has("message-1")).toBe(true);
  });

  it("denies authenticated users without the narrow fake/local moderation capability and audits the attempt", async () => {
    const repository = new FakeModerationRepository();
    repository.actor = {
      domainUserId: "viewer-user",
      displayName: "Viewer",
      rolePermissionValues: [["moderators:manage"]]
    };
    const runtime = new FakeModerationRuntime();
    const server = createServer({
      getAuthSession: async () => ({ user: { id: "auth-viewer" } }),
      repository,
      runtime
    });

    const response = await server.inject({
      method: "POST",
      url: "/fake-local-chat/moderation/commands",
      payload: {
        action: "hide_message",
        targetMessageId: "message-1"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      ok: false,
      reason: "fake_local_moderation_forbidden",
      auditEntry: {
        actorDisplayName: "Viewer",
        outcome: "denied",
        targetMessageId: "message-1",
        providerAction: false
      }
    });
    expect(runtime.messages.has("message-1")).toBe(true);
    expect(runtime.auditEntries).toHaveLength(1);
    expect(repository.auditEntries).toHaveLength(1);
  });

  it("applies an authorized fake/local hide command without provider behavior", async () => {
    const repository = new FakeModerationRepository();
    repository.actor = {
      domainUserId: "helper-user",
      displayName: "Live Helper",
      rolePermissionValues: [JSON.stringify(["fake-local-chat:moderate"])]
    };
    const runtime = new FakeModerationRuntime();
    const server = createServer({
      getAuthSession: async () => ({ user: { id: "auth-helper" } }),
      repository,
      runtime
    });

    const response = await server.inject({
      method: "POST",
      url: "/fake-local-chat/moderation/commands",
      payload: {
        action: "hide_message",
        targetMessageId: "message-1",
        note: "Local practice hide"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      source: "fake-local",
      providerAction: false,
      affectedMessage: {
        id: "message-1",
        source: "fake-local"
      },
      auditEntry: {
        actorDisplayName: "Live Helper",
        action: "hide_message",
        outcome: "applied",
        note: "Local practice hide",
        providerAction: false
      }
    });
    expect(runtime.messages.has("message-1")).toBe(false);
    expect(runtime.auditEntries).toHaveLength(1);
    expect(repository.auditEntries).toHaveLength(1);
    expect(repository.auditEntries[0]).toMatchObject({
      action: "hide_message",
      outcome: "applied",
      source: "fake-local",
      providerAction: false
    });
  });

  it("records temporary mute commands as fake/local-only audit entries", async () => {
    const repository = new FakeModerationRepository();
    const runtime = new FakeModerationRuntime();
    const server = createServer({
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      repository,
      runtime
    });

    const response = await server.inject({
      method: "POST",
      url: "/fake-local-chat/moderation/commands",
      payload: {
        action: "temporary_mute_author",
        targetAuthorName: "Test chatter",
        durationSeconds: 60,
        note: "Local mute drill"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      source: "fake-local",
      providerAction: false,
      auditEntry: {
        action: "temporary_mute_author",
        outcome: "applied",
        targetAuthorName: "Test chatter",
        durationSeconds: 60,
        note: "Local mute drill",
        providerAction: false
      }
    });
    expect(runtime.mutedAuthors.get("test chatter")).toMatchObject({
      authorName: "Test chatter"
    });
    expect(runtime.auditEntries[0]?.mutedUntil).toEqual(expect.any(String));
    expect(repository.auditEntries[0]).toMatchObject({
      action: "temporary_mute_author",
      outcome: "applied",
      source: "fake-local",
      providerAction: false,
      durationSeconds: 60
    });
    expect(repository.auditEntries[0]?.mutedUntil).toEqual(expect.any(String));
  });
});
