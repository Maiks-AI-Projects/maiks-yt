import { describe, expect, it } from "vitest";

import {
  backupHealthRequiredTables,
  backupHealthUnavailableMessage,
  getBackupHealthExceptionFailure,
  parseBackupHealthResponse
} from "./backup-health-admin.rules";

const createTables = (present: boolean): Array<{ name: string; present: boolean }> =>
  backupHealthRequiredTables.map((name) => ({ name, present }));

const createPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ok: true,
  readOnly: true,
  healthOk: true,
  checkedAt: "2026-08-28T12:00:00.000Z",
  skipped: false,
  warnings: [],
  databaseReachable: true,
  databaseFailureCategory: null,
  requiredTables: createTables(true),
  backupTool: {
    available: true,
    command: "mariadb-dump",
    version: "mariadb-dump 11.4.2 for debian-linux-gnu"
  },
  ...overrides
});

const expectUnavailable = (result: ReturnType<typeof parseBackupHealthResponse>): void => {
  expect(result).toEqual({
    kind: "failed",
    state: "failed",
    message: backupHealthUnavailableMessage
  });
};

describe("Backup Health admin browser contract", () => {
  it("projects a valid reachable check and bounds dump-tool version copy", () => {
    const result = parseBackupHealthResponse(200, createPayload());

    expect(result).toEqual({
      kind: "ready",
      health: {
        checkedAt: "2026-08-28T12:00:00.000Z",
        healthOk: true,
        skipped: false,
        databaseReachable: true,
        databaseFailureCategory: null,
        requiredTables: createTables(true),
        backupTool: {
          available: true,
          command: "mariadb-dump",
          version: "11.4.2"
        },
        warnings: []
      }
    });
  });

  it("accepts a valid unreachable check without treating it as a malformed response", () => {
    const result = parseBackupHealthResponse(200, createPayload({
      healthOk: false,
      databaseReachable: false,
      databaseFailureCategory: "network",
      requiredTables: createTables(false),
      backupTool: {
        available: true,
        command: "mysqldump",
        version: "mysqldump 8.0.36"
      }
    }));

    expect(result).toMatchObject({
      kind: "ready",
      health: {
        healthOk: false,
        databaseReachable: false,
        databaseFailureCategory: "network",
        requiredTables: createTables(false),
        backupTool: { command: "mysqldump", version: "8.0.36" }
      }
    });
  });

  it("accepts a valid skipped check as not configured", () => {
    const result = parseBackupHealthResponse(200, createPayload({
      healthOk: true,
      skipped: true,
      reason: "DATABASE_URL is not configured.",
      databaseReachable: false,
      databaseFailureCategory: null,
      requiredTables: createTables(false),
      backupTool: {
        available: false,
        command: null,
        version: null
      },
      warnings: ["No mysqldump or mariadb-dump command was found."]
    }));

    expect(result).toMatchObject({
      kind: "ready",
      health: {
        skipped: true,
        databaseReachable: false,
        databaseFailureCategory: null,
        warnings: ["No mysqldump or mariadb-dump command was found."]
      }
    });
    expect(JSON.stringify(result)).not.toContain("DATABASE_URL");
  });

  it("requires the complete unique known table inventory", () => {
    const cases = [
      createTables(true).slice(1),
      [...createTables(true), { name: "unexpected_table", present: true }],
      createTables(true).map((table, index) => index === 1 ? { ...table, name: "users" } : table),
      createTables(true).map((table, index) => index === 1 ? { ...table, name: "unknown" } : table),
      createTables(true).map((table, index) => index === 1 ? { ...table, present: "yes" } : table),
      createTables(true).map((table, index) => index === 1 ? { ...table, extra: true } : table)
    ];

    for (const requiredTables of cases) {
      expectUnavailable(parseBackupHealthResponse(200, createPayload({ requiredTables })));
    }
  });

  it("rejects contradictory skipped, reachable, and unreachable producer states", () => {
    const cases = [
      createPayload({ healthOk: false }),
      createPayload({ databaseFailureCategory: "network" }),
      createPayload({ databaseReachable: false, databaseFailureCategory: "network", requiredTables: createTables(false) }),
      createPayload({ databaseReachable: false, databaseFailureCategory: "network", healthOk: true, requiredTables: createTables(false) }),
      createPayload({ skipped: true, reason: "wrong", databaseReachable: false, databaseFailureCategory: null, requiredTables: createTables(false) }),
      createPayload({ skipped: true, reason: "DATABASE_URL is not configured.", databaseReachable: false, databaseFailureCategory: "network", requiredTables: createTables(false) }),
      createPayload({ reason: "DATABASE_URL is not configured." }),
      createPayload({ databaseReachable: true, databaseFailureCategory: null, requiredTables: createTables(false), healthOk: true }),
      createPayload({ databaseReachable: true, databaseFailureCategory: "unknown" })
    ];

    for (const payload of cases) {
      expectUnavailable(parseBackupHealthResponse(200, payload));
    }
  });

  it("accepts only the existing warning allowlist and producer warning invariant", () => {
    const unavailableTool = {
      available: false,
      command: null,
      version: null
    };
    const valid = createPayload({
      backupTool: unavailableTool,
      warnings: ["No mysqldump or mariadb-dump command was found."]
    });
    expect(parseBackupHealthResponse(200, valid).kind).toBe("ready");

    for (const warnings of [[], ["raw warning"], ["No mysqldump or mariadb-dump command was found.", "raw warning"]]) {
      expectUnavailable(parseBackupHealthResponse(200, { ...valid, warnings }));
    }

    expectUnavailable(parseBackupHealthResponse(200, createPayload({
      warnings: ["No mysqldump or mariadb-dump command was found."]
    })));
  });

  it("rejects malformed dump-tool fields and never projects raw output or paths", () => {
    const projected = parseBackupHealthResponse(200, createPayload({
      backupTool: {
        available: true,
        command: "mariadb-dump",
        version: "mariadb-dump 11.4.2 for debian-linux-gnu"
      }
    }));
    expect(JSON.stringify(projected)).not.toContain("/srv");
    expect(JSON.stringify(projected)).not.toContain("raw-output");
    expect(projected).toMatchObject({ health: { backupTool: { version: "11.4.2" } } });

    for (const backupTool of [
      { available: true, command: "unknown", version: "unknown 1" },
      { available: true, command: "mariadb-dump", version: "/usr/bin/mariadb-dump 11.4.2" },
      { available: true, command: "mariadb-dump", version: "mariadb-dump" },
      { available: false, command: "mariadb-dump", version: null },
      { available: false, command: null, version: "mariadb-dump 11.4.2" },
      { available: true, command: "mariadb-dump", version: `mariadb-dump ${"1".repeat(40)}` },
      { available: true, command: "mariadb-dump", version: "mariadb-dump 11.4.2", extra: true }
    ]) {
      expectUnavailable(parseBackupHealthResponse(200, createPayload({ backupTool })));
    }
  });

  it("fails closed for non-2xx ok payloads and unknown failure reasons", () => {
    expectUnavailable(parseBackupHealthResponse(503, createPayload()));
    expect(parseBackupHealthResponse(401, { ok: false, reason: "not_authenticated" })).toMatchObject({
      kind: "failed",
      state: "signed-out"
    });
    expect(parseBackupHealthResponse(403, { ok: false, reason: "backup_health_forbidden" })).toMatchObject({
      kind: "failed",
      state: "forbidden"
    });
    expectUnavailable(parseBackupHealthResponse(500, { ok: false, reason: "driver password at /srv/private" }));
    expectUnavailable(parseBackupHealthResponse(200, {
      ok: false,
      reason: "unknown raw failure",
      status: 500
    }));
  });

  it("maps caught exceptions to finite copy without leaking their details", () => {
    const result = getBackupHealthExceptionFailure(new Error("ECONNRESET /srv/private password=secret"));

    expect(result).toEqual({
      kind: "failed",
      state: "failed",
      message: backupHealthUnavailableMessage
    });
    expect(JSON.stringify(result)).not.toContain("ECONNRESET");
    expect(JSON.stringify(result)).not.toContain("/srv/private");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
