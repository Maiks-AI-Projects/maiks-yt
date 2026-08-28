import { describe, expect, it } from "vitest";

import {
  adminDashboardUnavailableDetail,
  adminDashboardStatusRequestPaths,
  createAdminDashboardLoadingCards,
  createAdminDashboardStatusCards,
  type AdminDashboardStatusResults,
  type DashboardStatusResult
} from "./admin-dashboard.rules";

const fulfilled = (payload: unknown, status = 200): DashboardStatusResult => ({
  status: "fulfilled",
  value: {
    status,
    payload
  }
});

const rejected = (reason: unknown): DashboardStatusResult => ({
  status: "rejected",
  reason
});

const createSessionRow = (index = 1) => ({
  id: `session-${index}`,
  ipAddress: null,
  userAgent: "Test browser",
  createdAt: "2026-08-28T06:00:00.000Z",
  updatedAt: "2026-08-28T06:00:00.000Z",
  expiresAt: "2026-09-28T06:00:00.000Z",
  isCurrent: index === 1,
  isExpired: false
});

const createMoneyLine = (index = 1, transactionIndex = index) => ({
  id: `line-${index}`,
  transactionId: `transaction-${transactionIndex}`,
  lineKind: "gross_income",
  direction: "in",
  amountMinor: 500,
  currency: "EUR",
  valueSource: "eur",
  isEstimate: false,
  categoryKey: "stream-income",
  projectId: null,
  projectItemId: null,
  ruleVersionId: null,
  receiptReferenceId: null,
  receiptReference: null,
  notesPrivate: null,
  createdAt: "2026-08-28T06:00:00.000Z"
});

const createMoneyTransaction = (index = 1) => ({
  id: `transaction-${index}`,
  transactionType: "income",
  moneyMode: "real",
  sourceKind: "manual",
  sourceProvider: "manual",
  postingStatus: "posted",
  occurredAt: "2026-08-28T06:00:00.000Z",
  accountingAt: "2026-08-28T06:00:00.000Z",
  correctsTransactionId: null,
  correctionReason: null,
  notesPrivate: null,
  sourceId: null,
  sourceEventId: null,
  createdByUserId: null,
  createdAt: "2026-08-28T06:00:00.000Z",
  updatedAt: "2026-08-28T06:00:00.000Z",
  lines: [createMoneyLine(index)]
});

const createMoneyWarning = (index = 1) => ({
  id: `warning-${index}`,
  targetKind: "transaction",
  targetId: `transaction-${index}`,
  warningKind: "missing_category",
  severity: "warning",
  status: "open",
  message: "Review this transaction."
});

const createProviderIntakeEntries = () => [
  {
    provider: "twitch",
    mechanism: "twitch-eventsub",
    label: "Twitch EventSub",
    lastProviderEventName: "stream.online",
    lastReceivedAt: "2026-08-28T06:00:00.000Z",
    rowCount: 4,
    status: "healthy"
  },
  {
    provider: "twitch",
    mechanism: "twitch-irc",
    label: "Twitch Chat",
    lastProviderEventName: "PRIVMSG",
    lastReceivedAt: "2026-08-01T06:00:00.000Z",
    rowCount: 2,
    status: "stale"
  },
  {
    provider: "youtube",
    mechanism: "youtube-live-chat",
    label: "YouTube Live Chat",
    lastProviderEventName: null,
    lastReceivedAt: null,
    rowCount: 0,
    status: "missing"
  },
  {
    provider: "youtube",
    mechanism: "youtube-activity",
    label: "YouTube Activities",
    lastProviderEventName: null,
    lastReceivedAt: null,
    rowCount: 0,
    status: "missing"
  },
  {
    provider: "youtube",
    mechanism: "youtube-pubsub",
    label: "YouTube PubSub",
    lastProviderEventName: null,
    lastReceivedAt: null,
    rowCount: 0,
    status: "missing"
  },
  {
    provider: "discord",
    mechanism: "discord-gateway",
    label: "Discord Gateway",
    lastProviderEventName: null,
    lastReceivedAt: null,
    rowCount: 0,
    status: "missing"
  },
  {
    provider: "discord",
    mechanism: "discord-webhook",
    label: "Discord Webhooks",
    lastProviderEventName: null,
    lastReceivedAt: null,
    rowCount: 0,
    status: "missing"
  }
];

const createProviderIntakePayload = (entries: readonly unknown[] = createProviderIntakeEntries()) => ({
  ok: true,
  readOnly: true,
  generatedAt: "2026-08-28T06:00:00.000Z",
  staleAfterMinutes: 10_080,
  entries
});

const createRequiredBackupTables = (present = true) => [
  { name: "users", present },
  { name: "auth_users", present },
  { name: "projects", present },
  { name: "content_pages", present },
  { name: "stream_schedule_entries", present },
  { name: "system_notifications", present },
  { name: "provider_event_intake_logs", present },
  { name: "money_ledger_transactions", present }
];

const backupToolUnavailableWarning = "No mysqldump or mariadb-dump command was found.";

const createBackupHealthPayload = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  healthOk: true,
  databaseReachable: true,
  skipped: false,
  requiredTables: createRequiredBackupTables(),
  warnings: [],
  backupTool: {
    available: true,
    command: "mariadb-dump",
    version: "mariadb-dump 11"
  },
  ...overrides
});

const createSuccessfulResults = (): AdminDashboardStatusResults => ({
  api: fulfilled({ ok: true, surface: "api", debugRoute: "/internal/health?debug=true" }),
  database: fulfilled({ ok: true, surface: "api", database: "mariadb-driver-production" }),
  notifications: fulfilled({ ok: true, unreadCount: 4, criticalUnreadCount: 1 }),
  intakeHealth: fulfilled(createProviderIntakePayload()),
  sessions: fulfilled({
    ok: true,
    sessions: [createSessionRow(1), createSessionRow(2)],
    shownCount: 2,
    hasMore: false
  }),
  backupHealth: fulfilled(createBackupHealthPayload({
    warnings: [backupToolUnavailableWarning],
    backupTool: {
      available: false,
      command: null,
      version: null
    }
  })),
  localAgent: fulfilled({
    ok: true,
    connection: {
      state: "degraded",
      serviceVersion: "local-agent/9.8.7"
    },
    modules: [{ availability: "available" }, { availability: "degraded" }]
  }),
  activity: fulfilled({
    ok: true,
    notifications: {
      openWarningCount: 2,
      openCriticalCount: 1
    },
    activeHelperGrants: {
      count: 3
    }
  }),
  moneyLedger: fulfilled({
    ok: true,
    transactions: [createMoneyTransaction()],
    warnings: [createMoneyWarning()]
  })
});

const getRenderedCardCopy = (results: AdminDashboardStatusResults): string =>
  createAdminDashboardStatusCards(results)
    .map((card) => `${card.value} ${card.detail}`)
    .join(" | ");

describe("admin dashboard status inventory", () => {
  it("does not depend on the development smoke-state surface", () => {
    const requestPaths = Object.values(adminDashboardStatusRequestPaths);
    const loadingCards = createAdminDashboardLoadingCards();
    const serializedCards = JSON.stringify(loadingCards);

    expect(requestPaths).not.toContain("/admin/testing/smoke-state");
    expect(loadingCards.map((card) => card.key)).not.toContain("smoke");
    expect(serializedCards).not.toContain("Automated Checks");
    expect(serializedCards).not.toContain("automated check");
  });

  it("retains the production overview health inputs", () => {
    expect(Object.values(adminDashboardStatusRequestPaths)).toEqual([
      "/health",
      "/health/database",
      "/admin/notifications?limit=5",
      "/admin/connections/intake/health",
      "/admin/sessions",
      "/admin/backup/health",
      "/admin/local-agent/status",
      "/admin/overview/activity",
      "/admin/money/ledger"
    ]);
    expect(createAdminDashboardLoadingCards().map((card) => card.key)).toEqual([
      "api",
      "database",
      "notifications",
      "provider-intake",
      "sessions",
      "backup",
      "local-agent",
      "live-alerts",
      "helpers",
      "money"
    ]);
  });

  it("keeps successful and degraded operator states without exposing implementation labels", () => {
    const cards = createAdminDashboardStatusCards(createSuccessfulResults());

    expect(cards.map(({ key, value, detail, tone }) => ({ key, value, detail, tone }))).toEqual([
      { key: "api", value: "Online", detail: "Service is responding.", tone: "ok" },
      { key: "database", value: "Connected", detail: "Data store is responding.", tone: "ok" },
      { key: "notifications", value: "4 unread", detail: "1 critical", tone: "bad" },
      { key: "provider-intake", value: "1 of 7 healthy", detail: "6 stale/missing", tone: "warn" },
      { key: "sessions", value: "2 active", detail: "Session list is available.", tone: "ok" },
      { key: "backup", value: "8 of 8 tables", detail: "1 warning", tone: "warn" },
      { key: "local-agent", value: "Degraded", detail: "1 of 2 modules available", tone: "warn" },
      { key: "live-alerts", value: "3 open", detail: "2 warning · 1 critical", tone: "bad" },
      {
        key: "helpers",
        value: "3 active",
        detail: "Non-owner helper/moderator grants currently active.",
        tone: "ok"
      },
      {
        key: "money",
        value: "1 warning",
        detail: "Money ledger warning state requires review",
        tone: "warn"
      }
    ]);

    const renderedCopy = getRenderedCardCopy(createSuccessfulResults());
    expect(renderedCopy).not.toContain("/internal/health");
    expect(renderedCopy).not.toContain("mariadb-driver-production");
    expect(renderedCopy).not.toContain("local-agent/9.8.7");
    expect(renderedCopy).not.toContain("mysqldump");
    expect(renderedCopy).not.toContain("mariadb-dump");
  });

  it("maps unavailable responses to one finite operator instruction", () => {
    const unavailable = {
      api: fulfilled({ ok: false, reason: "raw api failure" }, 503),
      database: fulfilled({ ok: false, reason: "raw database failure" }, 599),
      notifications: fulfilled({ ok: false, reason: "raw notification failure" }, 401),
      intakeHealth: fulfilled({ ok: false, reason: "/admin/connections/intake/health" }, 500),
      sessions: fulfilled({ ok: false, reason: "raw session failure" }, 403),
      backupHealth: fulfilled({ ok: false, reason: "raw backup failure" }, 503),
      localAgent: fulfilled({ ok: false, reason: "raw local-agent failure" }, 503),
      activity: fulfilled({ ok: false, reason: "raw activity failure" }, 500),
      moneyLedger: fulfilled({ ok: false, reason: "raw money failure" }, 500)
    } satisfies AdminDashboardStatusResults;

    const cards = createAdminDashboardStatusCards(unavailable);
    expect(cards.map((card) => card.value)).toEqual([
      "Offline",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "Unavailable"
    ]);
    expect(new Set(cards.map((card) => card.detail))).toEqual(new Set([adminDashboardUnavailableDetail]));

    const renderedCopy = getRenderedCardCopy(unavailable);
    for (const rawText of ["503", "599", "401", "403", "/admin/", "raw ", "local-agent"]) {
      expect(renderedCopy).not.toContain(rawText);
    }
  });

  it("rejects successful payloads delivered with non-success transport status", () => {
    const contradictory = createSuccessfulResults();
    contradictory.api = fulfilled({ ok: true, surface: "api" }, 503);
    contradictory.database = fulfilled({ ok: true, surface: "api", database: "mariadb" }, 401);
    contradictory.sessions = fulfilled({
      ok: true,
      sessions: [createSessionRow()],
      shownCount: 1,
      hasMore: false
    }, 503);

    const cards = createAdminDashboardStatusCards(contradictory);
    expect(cards.find((card) => card.key === "api")).toMatchObject({
      value: "Offline",
      detail: adminDashboardUnavailableDetail,
      tone: "bad"
    });
    expect(cards.find((card) => card.key === "database")).toMatchObject({
      value: "Unavailable",
      detail: adminDashboardUnavailableDetail,
      tone: "bad"
    });
    expect(cards.find((card) => card.key === "sessions")).toMatchObject({
      value: "Unavailable",
      detail: adminDashboardUnavailableDetail,
      tone: "bad"
    });

    for (const status of [Number.NaN, Number.POSITIVE_INFINITY, 200.5, 199, 300]) {
      const invalidTransport = createSuccessfulResults();
      invalidTransport.api = fulfilled({ ok: true, surface: "api" }, status);
      expect(createAdminDashboardStatusCards(invalidTransport).find((card) => card.key === "api")).toMatchObject({
        value: "Offline",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("requires the exact API surface for both health cards", () => {
    for (const surface of ["", "web", "API", "/health"]) {
      const apiResults = createSuccessfulResults();
      apiResults.api = fulfilled({ ok: true, surface });
      expect(createAdminDashboardStatusCards(apiResults).find((card) => card.key === "api")).toMatchObject({
        value: "Offline",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });

      const databaseResults = createSuccessfulResults();
      databaseResults.database = fulfilled({ ok: true, surface, database: "maiks_yt" });
      expect(createAdminDashboardStatusCards(databaseResults).find((card) => card.key === "database")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("requires the complete unique Provider Intake inventory", () => {
    const entries = createProviderIntakeEntries();
    const malformedInventories = [
      [],
      entries.slice(0, -1),
      [...entries.slice(0, -1), entries[0]],
      entries.map((entry, index) => index === 0 ? { ...entry, mechanism: "unknown-mechanism" } : entry),
      entries.map((entry, index) => index === 0 ? {} : entry)
    ];

    for (const inventory of malformedInventories) {
      const results = createSuccessfulResults();
      results.intakeHealth = fulfilled(createProviderIntakePayload(inventory));
      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "provider-intake")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("fails closed on malformed successful payloads without throwing", () => {
    const malformed = {
      api: fulfilled({ ok: true, surface: 7 }),
      database: fulfilled({ ok: true, surface: "api", database: { driver: "mysql" } }),
      notifications: fulfilled({ ok: true, unreadCount: "4", criticalUnreadCount: 9 }),
      intakeHealth: fulfilled({ ok: true, entries: [{ status: "healthy" }, { status: "unknown raw state" }] }),
      sessions: fulfilled({ ok: true, sessions: "raw sessions", shownCount: 0, hasMore: false }),
      backupHealth: fulfilled({
        ok: true,
        healthOk: true,
        databaseReachable: true,
        requiredTables: [{ present: "yes" }],
        warnings: []
      }),
      localAgent: fulfilled({
        ok: true,
        connection: { state: "connected", serviceVersion: { raw: true } },
        modules: [{ availability: "available" }]
      }),
      activity: fulfilled({
        ok: true,
        notifications: { openWarningCount: -1, openCriticalCount: 0 },
        activeHelperGrants: { count: 0 }
      }),
      moneyLedger: fulfilled({ ok: true, transactions: [], warnings: "raw warnings" })
    } satisfies AdminDashboardStatusResults;

    const cards = createAdminDashboardStatusCards(malformed);
    expect(cards.every((card) => card.tone === "bad")).toBe(true);
    expect(new Set(cards.map((card) => card.detail))).toEqual(new Set([adminDashboardUnavailableDetail]));
    expect(getRenderedCardCopy(malformed)).not.toContain("unknown raw state");
  });

  it("rejects malformed Session and Money collections", () => {
    const malformedSessionPayloads = [
      { ok: true, sessions: [null], shownCount: 1, hasMore: false },
      { ok: true, sessions: ["raw session"], shownCount: 1, hasMore: false },
      { ok: true, sessions: [{}], shownCount: 1, hasMore: false },
      { ok: true, sessions: [createSessionRow()], shownCount: 2, hasMore: false },
      { ok: true, sessions: [createSessionRow()], shownCount: 1, hasMore: "no" }
    ];

    for (const payload of malformedSessionPayloads) {
      const results = createSuccessfulResults();
      results.sessions = fulfilled(payload);
      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "sessions")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }

    const malformedMoneyPayloads = [
      { ok: true, transactions: [null], warnings: [createMoneyWarning()] },
      { ok: true, transactions: ["raw transaction"], warnings: [createMoneyWarning()] },
      { ok: true, transactions: [{}], warnings: [createMoneyWarning()] },
      {
        ok: true,
        transactions: [{ ...createMoneyTransaction(), sourceKind: 7 }],
        warnings: [createMoneyWarning()]
      },
      {
        ok: true,
        transactions: [{ ...createMoneyTransaction(), lines: ["raw line"] }],
        warnings: [createMoneyWarning()]
      },
      {
        ok: true,
        transactions: [{ ...createMoneyTransaction(), lines: [] }],
        warnings: [createMoneyWarning()]
      },
      {
        ok: true,
        transactions: [{ ...createMoneyTransaction(), lines: [{}] }],
        warnings: [createMoneyWarning()]
      },
      {
        ok: true,
        transactions: [{
          ...createMoneyTransaction(),
          lines: [{ ...createMoneyLine(), amountMinor: "500" }]
        }],
        warnings: [createMoneyWarning()]
      },
      { ok: true, transactions: [createMoneyTransaction()], warnings: [null] },
      { ok: true, transactions: [createMoneyTransaction()], warnings: ["raw warning"] },
      { ok: true, transactions: [createMoneyTransaction()], warnings: [{}] }
    ];

    for (const payload of malformedMoneyPayloads) {
      const results = createSuccessfulResults();
      results.moneyLedger = fulfilled(payload);
      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "money")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("reuses the domain transaction rules at the Money response boundary", () => {
    const domainInvalidTransactions = [
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), amountMinor: -1 }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), amountMinor: 1.5 }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), currency: null }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), currency: "eur" }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), isEstimate: true }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), categoryKey: "x".repeat(81) }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), projectId: "x".repeat(192) }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), notesPrivate: "x".repeat(2_001) }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{
          ...createMoneyLine(),
          receiptReferenceId: "receipt-1",
          receiptReference: {
            id: "receipt-1",
            referenceType: "receipt",
            storageKind: "local_reference",
            label: "x".repeat(192),
            privateReference: "receipt-private-reference",
            createdByUserId: null,
            createdAt: "2026-08-28T06:00:00.000Z"
          }
        }]
      },
      { ...createMoneyTransaction(), occurredAt: "not-a-date" },
      { ...createMoneyTransaction(), accountingAt: "not-a-date" },
      { ...createMoneyTransaction(), lines: [] },
      {
        ...createMoneyTransaction(),
        lines: Array.from({ length: 21 }, (_, index) => createMoneyLine(index + 1, 1))
      }
    ];

    for (const transaction of domainInvalidTransactions) {
      const results = createSuccessfulResults();
      results.moneyLedger = fulfilled({
        ok: true,
        transactions: [transaction],
        warnings: [createMoneyWarning()]
      });

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "money")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("rejects unbounded Money response identifiers and invalid response dates", () => {
    const structurallyInvalidTransactions = [
      { ...createMoneyTransaction(), id: "x".repeat(37) },
      { ...createMoneyTransaction(), sourceId: "x".repeat(192) },
      { ...createMoneyTransaction(), createdAt: "not-a-date" },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), id: "x".repeat(37) }]
      },
      {
        ...createMoneyTransaction(),
        lines: [{ ...createMoneyLine(), createdAt: "not-a-date" }]
      }
    ];

    for (const transaction of structurallyInvalidTransactions) {
      const results = createSuccessfulResults();
      results.moneyLedger = fulfilled({
        ok: true,
        transactions: [transaction],
        warnings: [createMoneyWarning()]
      });

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "money")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("rejects non-string backup warning rows", () => {
    for (const warning of [null, 7, {}]) {
      const results = createSuccessfulResults();
      results.backupHealth = fulfilled(createBackupHealthPayload({
        warnings: [backupToolUnavailableWarning, warning],
        backupTool: {
          available: false,
          command: null,
          version: null
        }
      }));

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "backup")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("requires the complete unique backup table inventory", () => {
    const tables = createRequiredBackupTables();
    const malformedInventories = [
      [],
      tables.slice(0, -1),
      [...tables.slice(0, -1), tables[0]],
      tables.map((table, index) => index === 0 ? { name: "unknown_table", present: true } : table),
      tables.map((table, index) => index === 0 ? {} : table)
    ];

    for (const requiredTables of malformedInventories) {
      const results = createSuccessfulResults();
      results.backupHealth = fulfilled(createBackupHealthPayload({ requiredTables }));

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "backup")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("rejects backup health that contradicts required-table presence", () => {
    const contradictoryPayloads = [
      createBackupHealthPayload({
        healthOk: true,
        databaseReachable: true,
        requiredTables: createRequiredBackupTables().map((table, index) =>
          index === 0 ? { ...table, present: false } : table
        )
      }),
      createBackupHealthPayload({
        healthOk: false,
        databaseReachable: true,
        requiredTables: createRequiredBackupTables()
      })
    ];

    for (const payload of contradictoryPayloads) {
      const results = createSuccessfulResults();
      results.backupHealth = fulfilled(payload);

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "backup")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("rejects impossible unreachable and skipped backup combinations", () => {
    const contradictoryPayloads = [
      createBackupHealthPayload({ databaseReachable: false }),
      createBackupHealthPayload({ skipped: true }),
      createBackupHealthPayload({
        healthOk: false,
        databaseReachable: false,
        skipped: true,
        requiredTables: createRequiredBackupTables(false)
      }),
      createBackupHealthPayload({
        healthOk: false,
        databaseReachable: false,
        requiredTables: createRequiredBackupTables().map((table, index) =>
          index === 0 ? table : { ...table, present: false }
        )
      }),
      createBackupHealthPayload({ warnings: [backupToolUnavailableWarning] }),
      createBackupHealthPayload({
        warnings: [],
        backupTool: {
          available: false,
          command: null,
          version: null
        }
      })
    ];

    for (const payload of contradictoryPayloads) {
      const results = createSuccessfulResults();
      results.backupHealth = fulfilled(payload);

      expect(createAdminDashboardStatusCards(results).find((card) => card.key === "backup")).toMatchObject({
        value: "Unavailable",
        detail: adminDashboardUnavailableDetail,
        tone: "bad"
      });
    }
  });

  it("preserves valid unreachable and skipped backup states", () => {
    const unreachable = createSuccessfulResults();
    unreachable.backupHealth = fulfilled(createBackupHealthPayload({
      healthOk: false,
      databaseReachable: false,
      requiredTables: createRequiredBackupTables(false)
    }));
    expect(createAdminDashboardStatusCards(unreachable).find((card) => card.key === "backup")).toMatchObject({
      value: "Unavailable",
      detail: "Data is unavailable. Review backup readiness.",
      tone: "bad"
    });

    const skipped = createSuccessfulResults();
    skipped.backupHealth = fulfilled(createBackupHealthPayload({
      healthOk: true,
      databaseReachable: false,
      skipped: true,
      requiredTables: createRequiredBackupTables(false)
    }));
    expect(createAdminDashboardStatusCards(skipped).find((card) => card.key === "backup")).toMatchObject({
      value: "Not configured",
      detail: "Backup readiness is not configured.",
      tone: "warn"
    });
  });

  it("shows a lower-bound Session count when more rows exist", () => {
    const results = createSuccessfulResults();
    results.sessions = fulfilled({
      ok: true,
      sessions: Array.from({ length: 100 }, (_, index) => createSessionRow(index + 1)),
      shownCount: 100,
      hasMore: true
    });

    expect(createAdminDashboardStatusCards(results).find((card) => card.key === "sessions")).toMatchObject({
      value: "100+ active",
      detail: "Session list is available.",
      tone: "ok"
    });
  });

  it("bounds every dashboard count while keeping ordinary counts exact", () => {
    const large = createSuccessfulResults();
    large.notifications = fulfilled({ ok: true, unreadCount: 1_000, criticalUnreadCount: 999 });
    large.sessions = fulfilled({
      ok: true,
      sessions: Array.from({ length: 1_000 }, (_, index) => createSessionRow(index + 1)),
      shownCount: 1_000,
      hasMore: true
    });
    large.backupHealth = fulfilled(createBackupHealthPayload({
      warnings: [backupToolUnavailableWarning],
      backupTool: {
        available: false,
        command: null,
        version: null
      }
    }));
    large.localAgent = fulfilled({
      ok: true,
      connection: { state: "connected", serviceVersion: "raw version" },
      modules: Array.from({ length: 1_000 }, () => ({ availability: "available" }))
    });
    large.activity = fulfilled({
      ok: true,
      notifications: { openWarningCount: 700, openCriticalCount: 400 },
      activeHelperGrants: { count: 1_000 }
    });
    large.moneyLedger = fulfilled({
      ok: true,
      transactions: [createMoneyTransaction()],
      warnings: Array.from({ length: 1_000 }, (_, index) => createMoneyWarning(index + 1))
    });

    const cards = createAdminDashboardStatusCards(large);
    expect(cards.map(({ key, value, detail }) => ({ key, value, detail }))).toEqual([
      { key: "api", value: "Online", detail: "Service is responding." },
      { key: "database", value: "Connected", detail: "Data store is responding." },
      { key: "notifications", value: "999+ unread", detail: "999 critical" },
      { key: "provider-intake", value: "1 of 7 healthy", detail: "6 stale/missing" },
      { key: "sessions", value: "999+ active", detail: "Session list is available." },
      { key: "backup", value: "8 of 8 tables", detail: "1 warning" },
      { key: "local-agent", value: "Connected", detail: "999+ of 999+ modules available" },
      { key: "live-alerts", value: "999+ open", detail: "700 warning · 400 critical" },
      {
        key: "helpers",
        value: "999+ active",
        detail: "Non-owner helper/moderator grants currently active."
      },
      { key: "money", value: "999+ warnings", detail: "Money ledger warning state requires review" }
    ]);
    expect(getRenderedCardCopy(large)).not.toContain("1000");
  });

  it("contains thrown and network failures without exposing exception or stack text", () => {
    const failure = rejected(new Error("ECONNRESET /health secret-client-message\nstack trace"));
    const networkFailures = {
      api: failure,
      database: failure,
      notifications: failure,
      intakeHealth: failure,
      sessions: failure,
      backupHealth: failure,
      localAgent: failure,
      activity: failure,
      moneyLedger: failure
    } satisfies AdminDashboardStatusResults;

    const cards = createAdminDashboardStatusCards(networkFailures);
    expect(cards.every((card) => card.tone === "bad")).toBe(true);
    expect(new Set(cards.map((card) => card.detail))).toEqual(new Set([adminDashboardUnavailableDetail]));

    const renderedCopy = getRenderedCardCopy(networkFailures);
    for (const rawText of ["ECONNRESET", "/health", "secret-client-message", "stack trace"]) {
      expect(renderedCopy).not.toContain(rawText);
    }
  });
});
