import { describe, expect, it, vi } from "vitest";

import { createEventRoutingDispatchRepository } from "../../src/event-routing/event-routing-dispatch-store.service.js";
import type {
  EventRoutingHistoryInsert,
  EventRoutingProductionDecisionCommitInput
} from "../../src/event-routing/event-routing-dispatch.types.js";

const history = (): EventRoutingHistoryInsert => ({
  sourcePlatform: "website",
  eventKind: "website.schedule-changed",
  sourceEventId: "schedule:event-1",
  routingRuleId: "rule-1",
  routingOutcome: "routed",
  destination: "top_notification",
  actorUserId: null,
  actorExternalId: "maiks-yt:schedule",
  actorDisplayName: "Maiks.yt Schedule",
  userId: null,
  streamSessionId: null,
  streamScheduleEntryId: "stream-1",
  sessionId: null,
  isTest: false,
  isSimulated: false,
  isRealMoney: false,
  testResettable: false,
  redactedPayload: { displayText: "Schedule updated" },
  occurredAt: new Date("2026-08-27T18:00:00.000Z")
});

const commitInput = (): EventRoutingProductionDecisionCommitInput => ({
  history: history(),
  cooldowns: [
    {
      routingRuleId: "rule-1",
      eventKind: "website.schedule-changed",
      sourcePlatform: "website",
      scope: "global",
      cooldownKey: "global",
      actorUserId: null,
      actorExternalId: null,
      streamSessionId: null,
      streamScheduleEntryId: null,
      windowStartedAt: new Date("2026-08-27T18:00:00.000Z"),
      windowEndsAt: new Date("2026-08-27T18:01:00.000Z")
    }
  ],
  approval: {
    routingRuleId: "rule-1",
    destination: "top_notification"
  },
  now: new Date("2026-08-27T18:00:00.000Z")
});

describe("event routing production decision store", () => {
  it("locks cooldown state and commits history, approval, and cooldown atomically", async () => {
    const execute = vi.fn(async (sql: string) =>
      sql.includes("SELECT window_ends_at") ? [[], []] : [{}, []]
    );
    const connection = {
      execute,
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn()
    };
    const repository = createEventRoutingDispatchRepository({
      getConnection: vi.fn(async () => connection)
    } as never);

    await expect(repository.commitProductionDecision(commitInput())).resolves.toMatchObject({
      status: "committed",
      approvalQueue: {
        destination: "top_notification",
        status: "pending"
      },
      cooldownsRecorded: 1
    });

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(String(execute.mock.calls[0]?.[0])).toContain("FOR UPDATE");
    expect(String(execute.mock.calls[1]?.[0])).toContain("INSERT INTO event_history");
    expect(String(execute.mock.calls[2]?.[0])).toContain("INSERT INTO event_approval_queue");
    expect(String(execute.mock.calls[3]?.[0])).toContain("INSERT INTO event_cooldown_state");
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("records a blocked outcome inside the same transaction when a cooldown is active", async () => {
    const execute = vi.fn(async (sql: string) =>
      sql.includes("SELECT window_ends_at")
        ? [[{ windowEndsAt: new Date("2026-08-27T18:00:30.000Z") }], []]
        : [{}, []]
    );
    const connection = {
      execute,
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn()
    };
    const repository = createEventRoutingDispatchRepository({
      getConnection: vi.fn(async () => connection)
    } as never);

    await expect(repository.commitProductionDecision(commitInput())).resolves.toMatchObject({
      status: "blocked_cooldown",
      history: {
        destination: null,
        routingOutcome: "blocked_cooldown"
      },
      approvalQueue: null,
      cooldownsRecorded: 0
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(String(execute.mock.calls[1]?.[0])).toContain("INSERT INTO event_history");
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back the entire production decision when a dependent write fails", async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT window_ends_at")) {
        return [[], []];
      }
      if (sql.includes("INSERT INTO event_approval_queue")) {
        throw new Error("approval write failed");
      }
      return [{}, []];
    });
    const connection = {
      execute,
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn()
    };
    const repository = createEventRoutingDispatchRepository({
      getConnection: vi.fn(async () => connection)
    } as never);

    await expect(repository.commitProductionDecision(commitInput())).rejects.toThrow(
      "approval write failed"
    );
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
