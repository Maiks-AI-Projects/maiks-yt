import type { DatabasePool } from "@maiks-yt/database";
import {
  actionPanelDecideCapability,
  actionPanelViewCapability,
  getActionPanelCategoryDecisionCapability
} from "@maiks-yt/domain/actions";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerActionPanelRoutes } from "../../src/actions/action-panel.route.js";
import {
  ActionPanelService,
  normalizeActionPanelPermissions
} from "../../src/actions/action-panel.service.js";
import { createActionPanelRepository } from "../../src/actions/action-panel-store.service.js";
import type {
  ActionItemHistoryEntry,
  ActionPanelActor,
  ActionPanelDecisionRecord,
  ActionPanelRepository,
  ActionPanelTransaction,
  PersistentActionItem
} from "../../src/actions/action-panel.types.js";

const createItem = (
  id: string,
  overrides: Partial<PersistentActionItem> = {}
): PersistentActionItem => ({
  id,
  title: `Action ${id}`,
  description: "Action description",
  category: "overlay",
  decisionKind: "review",
  priority: "normal",
  status: "open",
  streamRelevant: false,
  liveSafe: true,
  createdAt: "2026-06-15T08:00:00.000Z",
  updatedAt: "2026-06-15T08:00:00.000Z",
  ...overrides
});

class FakeActionPanelRepository implements ActionPanelRepository {
  public readonly actors = new Map<string, ActionPanelActor>();
  public readonly transactionActors = new Map<string, ActionPanelActor>();
  public readonly items = new Map<string, PersistentActionItem>();
  public readonly history: ActionItemHistoryEntry[] = [];
  public readonly insertedHistory: ActionPanelDecisionRecord[] = [];
  public historyLimitRequested: number | null = null;
  public failHistoryInsert = false;
  public forceConditionalUpdateConflict = false;
  public resolveActorCalls = 0;
  public transactionResolveActorCalls = 0;
  public findActionForUpdateCalls = 0;
  public readonly transactionEvents: string[] = [];

  public async resolveActor(authUserId: string): Promise<ActionPanelActor | null> {
    this.resolveActorCalls += 1;
    return this.actors.get(authUserId) ?? null;
  }

  public async listActiveItems(): Promise<PersistentActionItem[]> {
    return [...this.items.values()]
      .filter((item) => item.status === "open" || item.status === "deferred")
      .map((item) => structuredClone(item));
  }

  public async listRecentHistory(limit: number): Promise<ActionItemHistoryEntry[]> {
    this.historyLimitRequested = limit;
    return this.history.slice(0, limit).map((entry) => structuredClone(entry));
  }

  public async transaction<Result>(
    operation: (transaction: ActionPanelTransaction) => Promise<Result>
  ): Promise<Result> {
    const itemSnapshot = structuredClone([...this.items.entries()]);
    const historySnapshot = structuredClone(this.history);
    const insertedHistorySnapshot = structuredClone(this.insertedHistory);
    const transaction: ActionPanelTransaction = {
      resolveActor: async (authUserId) => {
        this.transactionResolveActorCalls += 1;
        this.transactionEvents.push("resolve-actor");
        return this.transactionActors.get(authUserId) ?? null;
      },
      findActionForUpdate: async (id) => {
        this.findActionForUpdateCalls += 1;
        this.transactionEvents.push("find-action");
        const item = this.items.get(id);
        return item ? structuredClone(item) : null;
      },
      updateActionStatus: async ({ id, expectedStatus, newStatus }) => {
        this.transactionEvents.push("update-action");
        if (this.forceConditionalUpdateConflict) {
          return false;
        }

        const item = this.items.get(id);

        if (!item || item.status !== expectedStatus) {
          return false;
        }

        this.items.set(id, {
          ...item,
          status: newStatus,
          updatedAt: "2026-06-15T10:00:00.000Z"
        });
        return true;
      },
      insertHistory: async (record) => {
        this.transactionEvents.push("insert-history");
        if (this.failHistoryInsert) {
          throw new Error("history insert failed");
        }

        this.insertedHistory.push(structuredClone(record));
      }
    };

    try {
      return await operation(transaction);
    } catch (error) {
      this.items.clear();
      for (const [id, item] of itemSnapshot) {
        this.items.set(id, item);
      }
      this.history.splice(0, this.history.length, ...historySnapshot);
      this.insertedHistory.splice(
        0,
        this.insertedHistory.length,
        ...insertedHistorySnapshot
      );
      throw error;
    }
  }
}

const addActor = (
  repository: FakeActionPanelRepository,
  permissions: unknown[],
  authUserId = "auth-user",
  domainUserId = "domain-user"
): void => {
  repository.actors.set(authUserId, {
    domainUserId,
    rolePermissionValues: [permissions]
  });
  repository.transactionActors.set(authUserId, {
    domainUserId,
    rolePermissionValues: [permissions]
  });
};

const createHistoryEntry = (index: number): ActionItemHistoryEntry => ({
  id: `history-${index}`,
  actionId: "action",
  actionTitle: "Action",
  decision: "approve",
  previousStatus: "open",
  newStatus: "approved",
  actor: {
    id: "domain-user",
    displayName: "Maiks"
  },
  createdAt: `2026-06-15T09:${String(index).padStart(2, "0")}:00.000Z`
});

describe("ActionPanelService permissions and listing", () => {
  it("robustly parses and deduplicates role permission arrays", () => {
    expect(normalizeActionPanelPermissions([
      JSON.stringify(["*", actionPanelViewCapability, actionPanelViewCapability, 1]),
      [actionPanelDecideCapability, null],
      "{bad json",
      null
    ])).toEqual(["*", actionPanelViewCapability, actionPanelDecideCapability]);
  });

  it("allows the owner wildcard to view and decide every category", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.items.set("overlay", createItem("overlay"));
    repository.items.set("schedule", createItem("schedule", { category: "schedule" }));

    const result = await new ActionPanelService(repository).listActions({
      authUserId: "auth-user",
      live: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.active.every((item) => item.canDecide)).toBe(true);
    }
  });

  it("supports broad and category-scoped decision permissions", async () => {
    const repository = new FakeActionPanelRepository();
    repository.items.set("overlay", createItem("overlay"));
    repository.items.set("schedule", createItem("schedule", { category: "schedule" }));
    addActor(repository, [
      actionPanelViewCapability,
      getActionPanelCategoryDecisionCapability("overlay")
    ]);

    const scopedResult = await new ActionPanelService(repository).listActions({
      authUserId: "auth-user",
      live: false
    });

    expect(scopedResult.ok).toBe(true);
    if (scopedResult.ok) {
      expect(scopedResult.active.find((item) => item.id === "overlay")?.canDecide).toBe(true);
      expect(scopedResult.active.find((item) => item.id === "schedule")?.canDecide).toBe(false);
    }

    addActor(repository, [actionPanelViewCapability, actionPanelDecideCapability]);
    const broadResult = await new ActionPanelService(repository).listActions({
      authUserId: "auth-user",
      live: false
    });

    expect(broadResult.ok).toBe(true);
    if (broadResult.ok) {
      expect(broadResult.active.every((item) => item.canDecide)).toBe(true);
    }
  });

  it("denies viewing and decisions without their required permissions", async () => {
    const repository = new FakeActionPanelRepository();
    repository.items.set("action", createItem("action"));
    addActor(repository, [actionPanelDecideCapability]);

    await expect(new ActionPanelService(repository).listActions({
      authUserId: "auth-user",
      live: false
    })).resolves.toEqual({
      ok: false,
      reason: "action_panel_view_forbidden"
    });

    await expect(new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_decision_forbidden"
    });
    expect(repository.transactionEvents).toEqual(["resolve-actor"]);
    expect(repository.findActionForUpdateCalls).toBe(0);

    repository.transactionEvents.splice(0);
    addActor(repository, [actionPanelViewCapability]);
    await expect(new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_decision_forbidden"
    });
  });

  it("filters and sorts active items, bounds history, and derives allowed decisions", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.items.set("normal", createItem("normal"));
    repository.items.set("urgent", createItem("urgent", {
      priority: "urgent",
      streamRelevant: true
    }));
    repository.items.set("deferred", createItem("deferred", {
      status: "deferred",
      streamRelevant: true
    }));
    repository.items.set("acknowledge", createItem("acknowledge", {
      decisionKind: "acknowledge",
      streamRelevant: true
    }));
    repository.items.set("unsafe", createItem("unsafe", {
      liveSafe: false,
      priority: "urgent",
      streamRelevant: true
    }));
    repository.items.set("approved", createItem("approved", {
      status: "approved"
    }));
    repository.history.push(...Array.from({ length: 30 }, (_, index) => createHistoryEntry(index)));

    const service = new ActionPanelService(
      repository,
      () => new Date("2026-06-15T12:00:00.000Z")
    );
    const result = await service.listActions({
      authUserId: "auth-user",
      live: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.active.map((item) => item.id)).not.toContain("approved");
      expect(result.active[0]?.id).toBe("urgent");
      expect(result.history).toHaveLength(25);
      expect(result.historyLimit).toBe(25);
      expect(result.active.find((item) => item.id === "normal")?.allowedDecisions)
        .toEqual(["approve", "reject", "defer"]);
      expect(result.active.find((item) => item.id === "deferred")?.allowedDecisions)
        .toEqual(["approve", "reject"]);
      expect(result.active.find((item) => item.id === "acknowledge")).toMatchObject({
        canDecide: false,
        allowedDecisions: []
      });
    }
    expect(repository.historyLimitRequested).toBe(25);

    const liveResult = await service.listActions({
      authUserId: "auth-user",
      live: true
    });

    expect(liveResult.ok).toBe(true);
    if (liveResult.ok) {
      expect(liveResult.active.map((item) => item.id)).not.toContain("normal");
      expect(liveResult.active.map((item) => item.id)).not.toContain("unsafe");
    }
  });
});

describe("ActionPanelService decisions", () => {
  it("revalidates revoked permissions inside the decision transaction", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.transactionActors.set("auth-user", {
      domainUserId: "domain-user",
      rolePermissionValues: [[actionPanelViewCapability]]
    });
    repository.items.set("action", createItem("action"));

    await expect(new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_decision_forbidden"
    });

    expect(repository.resolveActorCalls).toBe(0);
    expect(repository.transactionResolveActorCalls).toBe(1);
    expect(repository.transactionEvents).toEqual([
      "resolve-actor",
      "find-action"
    ]);
    expect(repository.items.get("action")?.status).toBe("open");
    expect(repository.insertedHistory).toEqual([]);
  });

  it("returns not found, stale-status, and invalid-transition conflicts", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.items.set("deferred", createItem("deferred", { status: "deferred" }));
    repository.items.set("terminal", createItem("terminal", { status: "approved" }));
    repository.items.set("approve-only", createItem("approve-only", { decisionKind: "approve" }));
    const service = new ActionPanelService(repository);

    await expect(service.decideAction({
      authUserId: "auth-user",
      actionId: "missing",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_not_found"
    });

    await expect(service.decideAction({
      authUserId: "auth-user",
      actionId: "deferred",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_status_conflict"
    });

    await expect(service.decideAction({
      authUserId: "auth-user",
      actionId: "terminal",
      request: {
        decision: "approve",
        expectedStatus: "approved"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_transition_conflict"
    });

    await expect(service.decideAction({
      authUserId: "auth-user",
      actionId: "approve-only",
      request: {
        decision: "reject",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_transition_conflict"
    });
  });

  it("treats a failed conditional update as a stale decision", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.items.set("action", createItem("action"));
    repository.forceConditionalUpdateConflict = true;

    await expect(new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "approve",
        expectedStatus: "open"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "action_item_status_conflict"
    });
  });

  it("writes the linked domain-user ID to history", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"], "auth-user", "actor-domain-user");
    repository.items.set("action", createItem("action"));

    const result = await new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "approve",
        expectedStatus: "open",
        note: "Reviewed"
      }
    });

    expect(result.ok).toBe(true);
    expect(repository.insertedHistory).toEqual([{
      actionId: "action",
      actorUserId: "actor-domain-user",
      decision: "approve",
      previousStatus: "open",
      newStatus: "approved",
      note: "Reviewed"
    }]);
    expect(repository.items.get("action")?.status).toBe("approved");
  });

  it("rolls back the item update when history insertion fails", async () => {
    const repository = new FakeActionPanelRepository();
    addActor(repository, ["*"]);
    repository.items.set("action", createItem("action"));
    repository.failHistoryInsert = true;

    await expect(new ActionPanelService(repository).decideAction({
      authUserId: "auth-user",
      actionId: "action",
      request: {
        decision: "reject",
        expectedStatus: "open"
      }
    })).rejects.toThrow("history insert failed");

    expect(repository.items.get("action")?.status).toBe("open");
    expect(repository.insertedHistory).toEqual([]);
  });
});

describe("Action Panel mysql transaction boundary", () => {
  it("rolls back and releases the connection when history insertion fails", async () => {
    const events: string[] = [];
    const connection = {
      beginTransaction: async () => {
        events.push("begin");
      },
      commit: async () => {
        events.push("commit");
      },
      rollback: async () => {
        events.push("rollback");
      },
      release: () => {
        events.push("release");
      },
      execute: async (sql: string) => {
        if (sql.includes("FROM auth_user_links")) {
          events.push("resolve-actor");
          return [[{
            domainUserId: "actor-domain-user",
            rolePermissions: [actionPanelViewCapability, actionPanelDecideCapability]
          }]];
        }

        if (sql.startsWith("UPDATE action_items")) {
          events.push("update");
          return [{ affectedRows: 1 }];
        }

        if (sql.startsWith("INSERT INTO action_item_history")) {
          events.push("history");
          throw new Error("history insert failed");
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      }
    };
    const repository = createActionPanelRepository({
      getConnection: async () => connection
    } as unknown as DatabasePool);

    await expect(repository.transaction(async (transaction) => {
      const actor = await transaction.resolveActor("auth-user");
      expect(actor?.domainUserId).toBe("actor-domain-user");
      await transaction.updateActionStatus({
        id: "action",
        expectedStatus: "open",
        newStatus: "approved"
      });
      await transaction.insertHistory({
        actionId: "action",
        actorUserId: "actor-domain-user",
        decision: "approve",
        previousStatus: "open",
        newStatus: "approved"
      });
    })).rejects.toThrow("history insert failed");

    expect(events).toEqual([
      "begin",
      "resolve-actor",
      "update",
      "history",
      "rollback",
      "release"
    ]);
  });
});

describe("Action Panel route boundary", () => {
  const createPool = (
    execute: DatabasePool["execute"]
  ): DatabasePool => ({
    execute
  } as DatabasePool);

  it("returns 401 without a session and 403 for an unlinked auth user", async () => {
    const unauthenticatedServer = Fastify();
    registerActionPanelRoutes(unauthenticatedServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const unauthenticatedResponse = await unauthenticatedServer.inject({
      method: "GET",
      url: "/actions"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticatedResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    await unauthenticatedServer.close();

    const unlinkedServer = Fastify();
    registerActionPanelRoutes(unlinkedServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => createPool(async () => [[]] as never)
    });

    const unlinkedResponse = await unlinkedServer.inject({
      method: "GET",
      url: "/actions"
    });
    expect(unlinkedResponse.statusCode).toBe(403);
    expect(unlinkedResponse.json()).toEqual({
      ok: false,
      reason: "action_panel_user_unlinked"
    });
    await unlinkedServer.close();
  });

  it("rejects malformed decision bodies and notes longer than 1,000 characters", async () => {
    const server = Fastify();
    registerActionPanelRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    for (const payload of [
      {
        decision: "approve"
      },
      {
        decision: "invalid",
        expectedStatus: "open"
      },
      {
        decision: "approve",
        expectedStatus: "open",
        note: "a".repeat(1_001)
      }
    ]) {
      const response = await server.inject({
        method: "POST",
        url: "/actions/action/decision",
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        ok: false,
        reason: "invalid_action_decision_request"
      });
    }

    await server.close();
  });

  it("maps permission, missing-item, and conflict reasons to stable HTTP statuses", async () => {
    const cases = [
      {
        result: {
          ok: false,
          reason: "action_item_decision_forbidden"
        } as const,
        statusCode: 403
      },
      {
        result: {
          ok: false,
          reason: "action_item_not_found"
        } as const,
        statusCode: 404
      },
      {
        result: {
          ok: false,
          reason: "action_item_status_conflict"
        } as const,
        statusCode: 409
      },
      {
        result: {
          ok: false,
          reason: "action_item_transition_conflict"
        } as const,
        statusCode: 409
      }
    ];

    for (const testCase of cases) {
      const server = Fastify();
      registerActionPanelRoutes(server, {
        getAuthSession: async () => ({ user: { id: "auth-user" } }),
        getDatabasePool: () => {
          throw new Error("pool should not be used");
        },
        createService: () => ({
          listActions: async () => {
            throw new Error("list should not be called");
          },
          decideAction: async () => testCase.result
        })
      });

      const response = await server.inject({
        method: "POST",
        url: "/actions/action/decision",
        payload: {
          decision: "approve",
          expectedStatus: "open"
        }
      });

      expect(response.statusCode).toBe(testCase.statusCode);
      expect(response.json()).toEqual(testCase.result);
      await server.close();
    }
  });
});
