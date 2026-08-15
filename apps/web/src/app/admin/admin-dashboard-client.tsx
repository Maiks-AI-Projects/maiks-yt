"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders, getDevAuthToken, withDevAuthToken } from "../dev-auth-token";
import { createControlUrl, overlayBaseUrl } from "../tool-surface-urls.service";
import styles from "./admin-dashboard.module.css";

type AdminDashboardItem = {
  href: string;
  label: string;
  description: string;
  preserveDevAuth?: boolean;
};

type AdminDashboardGroup = {
  title: string;
  items: readonly AdminDashboardItem[];
};

type DashboardStatusTone = "loading" | "ok" | "warn" | "bad";

type DashboardStatusCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardStatusTone;
};

type AdminDashboardLinkBadge = {
  label: string;
  tone: Exclude<DashboardStatusTone, "loading">;
};

type NotificationListResponse =
  | {
      ok: true;
      unreadCount: number;
      criticalUnreadCount: number;
    }
  | {
      ok: false;
      reason: string;
    };

type ProviderIntakeHealthResponse =
  | {
      ok: true;
      entries: Array<{
        status: "healthy" | "stale" | "missing";
      }>;
    }
  | {
      ok: false;
      reason: string;
    };

type SessionListResponse =
  | {
      ok: true;
      sessions: readonly unknown[];
    }
  | {
      ok: false;
      reason: string;
    };

type BackupHealthResponse =
  | {
      ok: true;
      healthOk: boolean;
      databaseReachable: boolean;
      requiredTables: Array<{
        present: boolean;
      }>;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
    };

type TestingSmokeStateResponse =
  | {
      ok: true;
      stateFileConfigured: boolean;
      state: {
        status: "passing" | "failing" | "unknown";
        stateAvailable: boolean;
        hadActiveFailure: boolean | null;
        lastSuccessAt: string | null;
        lastFailureNotifiedAt: string | null;
        lastFailureSignaturePresent: boolean;
      };
    }
  | {
      ok: false;
      reason: string;
    };

type LiveHelperDashboardResponse =
  | {
      ok: true;
      pendingApprovals: {
        count: number;
      };
      notifications: {
        openWarningCount: number;
        openCriticalCount: number;
      };
      activeHelperGrants: {
        count: number;
      };
      fakeLocalActiveModeration: {
        count: number;
      };
    }
  | {
      ok: false;
      reason: string;
    };

type MoneyLedgerDashboardResponse =
  | {
      ok: true;
      transactions: readonly unknown[];
      warnings: readonly unknown[];
    }
  | {
      ok: false;
      reason: string;
    };

type ExportStatusTone = "idle" | "working" | "ok" | "bad";

type DashboardToneState = {
  tone: ExportStatusTone;
  message: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const groups: readonly AdminDashboardGroup[] = [
  {
    title: "Stream Windows",
    items: [
      {
        href: createControlUrl("/chat"),
        label: "Streamer Chat",
        description: "Private live chat + moderation status."
      },
      {
        href: createControlUrl("/moderation"),
        label: "Moderation Window",
        description: "Stream moderation tools and helper context."
      },
      {
        href: createControlUrl("/control"),
        label: "Control Panel",
        description: "Scene controls, stream tools, and live status."
      },
      {
        href: createControlUrl("/ai"),
        label: "AI Controls",
        description: "Safety-gated AI output controls (currently inert)."
      },
      {
        href: overlayBaseUrl,
        label: "OBS Overlay",
        description: "Shared OBS browser-source check surface."
      },
      {
        href: "/tools/notifications",
        label: "Notifications",
        description: "Owner device notices and smoke alerts.",
        preserveDevAuth: true
      }
    ]
  },
  {
    title: "Testing",
    items: [
      {
        href: "/admin/testing",
        label: "Testing Guide",
        description: "Manual test runbook and readiness commands."
      },
      {
        href: "/admin/connections",
        label: "Connections",
        description: "Provider catalog and received intake checks."
      },
      {
        href: "/admin/provider-integrations",
        label: "Provider Integrations",
        description: "Twitch, YouTube, and Discord controls."
      },
      {
        href: "/admin/event-routing",
        label: "Event Routing",
        description: "Manual routing rules and simulated approvals."
      },
      {
        href: "/admin/live-helper",
        label: "Live Helper",
        description: "Active helper grants, alerts, and moderation state."
      },
      {
        href: "/admin/backup/health",
        label: "Backup Health",
        description: "Read-only backup readiness checks."
      }
    ]
  },
  {
    title: "Stream Operations",
    items: [
      {
        href: "/admin/schedule",
        label: "Schedule",
        description: "Plan, edit, cancel, and focus planned streams."
      },
      {
        href: "/admin/tokens",
        label: "Access Tokens",
        description: "Create and rotate overlay/control URLs."
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        description: "Review and revoke active browser sessions."
      },
      {
        href: "/admin/moderators",
        label: "Moderators",
        description: "Manage helper ranks, rights, and grant state."
      }
    ]
  },
  {
    title: "Content",
    items: [
      {
        href: "/admin/pages",
        label: "Pages",
        description: "Draft, preview, and publish website content."
      },
      {
        href: "/admin/games",
        label: "Games",
        description: "Curate library and stream planning links."
      },
      {
        href: "/admin/projects",
        label: "Projects",
        description: "Manage public project details and updates."
      },
      {
        href: "/admin/links",
        label: "Creator Links",
        description: "Hub destination visibility and ordering."
      },
      {
        href: "/admin/money",
        label: "Money Ledger",
        description: "Private ledger rows, warnings, and exports."
      }
    ]
  }
];

const loadingCards = (): readonly DashboardStatusCard[] => [
  {
    key: "api",
    label: "API",
    value: "Checking",
    detail: "Health endpoint pending.",
    tone: "loading"
  },
  {
    key: "database",
    label: "Database",
    value: "Checking",
    detail: "Database health endpoint pending.",
    tone: "loading"
  },
  {
    key: "notifications",
    label: "Notifications",
    value: "Checking",
    detail: "Reading unread critical state.",
    tone: "loading"
  },
  {
    key: "provider-intake",
    label: "Provider Intake",
    value: "Checking",
    detail: "Reading mechanism health summary.",
    tone: "loading"
  },
  {
    key: "sessions",
    label: "Sessions",
    value: "Checking",
    detail: "Listing owner session admin access.",
    tone: "loading"
  },
  {
    key: "backup",
    label: "Backup",
    value: "Checking",
    detail: "Reading backup readiness probe.",
    tone: "loading"
  },
  {
    key: "smoke",
    label: "Recurring Smoke",
    value: "Checking",
    detail: "Reading latest smoke state.",
    tone: "loading"
  },
  {
    key: "pending-approvals",
    label: "Approvals",
    value: "Checking",
    detail: "Loading live-helper counts.",
    tone: "loading"
  },
  {
    key: "helpers",
    label: "Helpers",
    value: "Checking",
    detail: "Loading helper grant state.",
    tone: "loading"
  },
  {
    key: "moderation",
    label: "Moderation",
    value: "Checking",
    detail: "Loading active local moderation count.",
    tone: "loading"
  }
];

const readJson = async <Payload,>(path: string, authenticated = false): Promise<{
  status: number;
  payload: Payload | null;
}> => {
  const init: RequestInit = {
    credentials: "include"
  };

  if (authenticated) {
    init.headers = createApiHeaders();
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);

  try {
    return {
      status: response.status,
      payload: await response.json() as Payload
    };
  } catch {
    return {
      status: response.status,
      payload: null
    };
  }
};

const getFilenameFromContentDisposition = (header: string | null): string | null => {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
};

const getHumanDate = (value: string | null): string => {
  if (!value) {
    return "not recorded";
  }

  return new Date(value).toLocaleString();
};

const getDashboardItemBadge = (
  item: AdminDashboardItem,
  statusCards: readonly DashboardStatusCard[]
): AdminDashboardLinkBadge | null => {
  const statusKeyByHref: Record<string, string> = {
    "/admin/backup/health": "backup",
    "/admin/connections": "provider-intake",
    "/admin/event-routing": "pending-approvals",
    "/admin/live-helper": "helpers",
    "/admin/moderators": "helpers",
    "/admin/money": "money",
    "/admin/sessions": "sessions",
    [createControlUrl("/moderation")]: "moderation",
    "/tools/notifications": "notifications"
  };

  const statusKey = statusKeyByHref[item.href];
  if (!statusKey) {
    return null;
  }

  const statusCard = statusCards.find((card) => card.key === statusKey);
  if (!statusCard || statusCard.tone === "loading") {
    return null;
  }

  return {
    label: statusCard.value,
    tone: statusCard.tone
  };
};

const findStatusCard = (
  statusCards: readonly DashboardStatusCard[],
  key: string
): DashboardStatusCard | undefined => statusCards.find((card) => card.key === key);

const loadStatusCards = async (): Promise<readonly DashboardStatusCard[]> => {
  const [api, database, notifications, intakeHealth, sessions, backupHealth, testingSmokeState, liveHelper, moneyLedger] =
    await Promise.allSettled([
      readJson<{ ok?: boolean; surface?: string }>("/health"),
      readJson<{ ok?: boolean; database?: string }>("/health/database"),
      readJson<NotificationListResponse>("/admin/notifications?limit=5", true),
      readJson<ProviderIntakeHealthResponse>("/admin/connections/intake/health", true),
      readJson<SessionListResponse>("/admin/sessions", true),
      readJson<BackupHealthResponse>("/admin/backup/health", true),
      readJson<TestingSmokeStateResponse>("/admin/testing/smoke-state", true),
      readJson<LiveHelperDashboardResponse>("/admin/live-helper", true),
      readJson<MoneyLedgerDashboardResponse>("/admin/money/ledger", true)
    ]);

  const getFulfilled = <Payload,>(result: PromiseSettledResult<{ status: number; payload: Payload | null }>) =>
    result.status === "fulfilled" ? result.value : null;

  const apiResult = getFulfilled(api);
  const databaseResult = getFulfilled(database);
  const notificationResult = getFulfilled(notifications);
  const intakeResult = getFulfilled(intakeHealth);
  const sessionResult = getFulfilled(sessions);
  const backupResult = getFulfilled(backupHealth);
  const smokeResult = getFulfilled(testingSmokeState);
  const liveHelperResult = getFulfilled(liveHelper);
  const moneyLedgerResult = getFulfilled(moneyLedger);

  const intakeEntries = intakeResult?.payload?.ok ? intakeResult.payload.entries : [];
  const staleOrMissingIntakes = intakeEntries.filter((entry) => entry.status !== "healthy").length;

  const notificationsUnread = notificationResult?.payload?.ok ? notificationResult.payload.unreadCount : null;
  const notificationsCritical = notificationResult?.payload?.ok ? notificationResult.payload.criticalUnreadCount : 0;

  const databaseTables = backupResult?.payload?.ok ? backupResult.payload.requiredTables : [];
  const missingDatabaseTables = databaseTables.filter((table) => !table.present).length;
  const backupWarnings = backupResult?.payload?.ok ? backupResult.payload.warnings.length : 0;

  const smokeState = smokeResult?.payload?.ok ? smokeResult.payload.state : null;
  const smokeStatus = smokeState?.status ?? "unknown";
  const smokeLastRun = getHumanDate(smokeState?.lastSuccessAt ?? smokeState?.lastFailureNotifiedAt ?? null);

  const pendingApprovals = liveHelperResult?.payload?.ok ? liveHelperResult.payload.pendingApprovals.count : null;
  const activeHelpers = liveHelperResult?.payload?.ok ? liveHelperResult.payload.activeHelperGrants.count : null;
  const activeModeration = liveHelperResult?.payload?.ok ? liveHelperResult.payload.fakeLocalActiveModeration.count : null;

  const liveHelperOpenWarnings = liveHelperResult?.payload?.ok ? liveHelperResult.payload.notifications.openWarningCount : 0;
  const liveHelperOpenCriticals = liveHelperResult?.payload?.ok ? liveHelperResult.payload.notifications.openCriticalCount : 0;

  const moneyWarnings = moneyLedgerResult?.payload?.ok ? moneyLedgerResult.payload.warnings.length : null;

  return [
    {
      key: "api",
      label: "API",
      value: apiResult?.payload?.ok ? "Online" : "Offline",
      detail: apiResult?.payload?.ok ? `Surface: ${apiResult.payload.surface ?? "api"}` : `HTTP ${apiResult?.status ?? "failed"}`,
      tone: apiResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "database",
      label: "Database",
      value: databaseResult?.payload?.ok ? "Connected" : "Unavailable",
      detail: databaseResult?.payload?.ok
        ? `Driver: ${databaseResult.payload.database ?? "connected"}`
        : `HTTP ${databaseResult?.status ?? "failed"}`,
      tone: databaseResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "notifications",
      label: "Notifications",
      value: notificationsUnread === null ? "Unavailable" : `${notificationsUnread} unread`,
      detail: notificationsUnread === null
        ? `HTTP ${notificationResult?.status ?? "failed"}`
        : `${notificationsCritical} critical`,
      tone:
        notificationsUnread === null
          ? "bad"
          : notificationsCritical > 0
            ? "bad"
            : notificationsUnread > 0
              ? "warn"
              : "ok"
    },
    {
      key: "provider-intake",
      label: "Provider Intake",
      value: intakeResult?.payload?.ok
        ? `${intakeEntries.length - staleOrMissingIntakes}/${intakeEntries.length} healthy`
        : "Unavailable",
      detail: intakeResult?.payload?.ok
        ? `${staleOrMissingIntakes} stale/missing`
        : `HTTP ${intakeResult?.status ?? "failed"}`,
      tone: !intakeResult?.payload?.ok
        ? "bad"
        : staleOrMissingIntakes === 0
          ? "ok"
          : "warn"
    },
    {
      key: "sessions",
      label: "Sessions",
      value: sessionResult?.payload?.ok
        ? `${sessionResult.payload.sessions.length} active`
        : "Unavailable",
      detail: sessionResult?.payload?.ok ? "Session admin list reachable." : `HTTP ${sessionResult?.status ?? "failed"}`,
      tone: sessionResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "backup",
      label: "Backup",
      value:
        backupResult?.payload?.ok && backupResult.payload.databaseReachable
          ? `${databaseTables.length - missingDatabaseTables}/${databaseTables.length} tables`
          : "Unavailable",
      detail: !backupResult?.payload?.ok
        ? `HTTP ${backupResult?.status ?? "failed"}`
        : backupResult.payload.healthOk
          ? `${backupWarnings} warning${backupWarnings === 1 ? "" : "s"}`
          : backupResult.payload.databaseReachable
            ? "Missing required tables"
            : "Database unavailable",
      tone:
        !backupResult?.payload?.ok || !backupResult.payload.healthOk
          ? "bad"
          : backupWarnings > 0
            ? "warn"
            : "ok"
    },
    {
      key: "smoke",
      label: "Recurring Smoke",
      value:
        smokeStatus === "passing"
          ? "Passing"
          : smokeStatus === "failing"
            ? "Failing"
            : "Unknown",
      detail: smokeResult?.payload?.ok ? `Last run: ${smokeLastRun}.` : `HTTP ${smokeResult?.status ?? "failed"}`,
      tone:
        !smokeResult?.payload?.ok
          ? "bad"
          : smokeStatus === "passing"
            ? "ok"
            : smokeStatus === "failing"
              ? "bad"
              : "warn"
    },
    {
      key: "pending-approvals",
      label: "Approvals",
      value: pendingApprovals === null ? "Unavailable" : `${pendingApprovals} pending`,
      detail: pendingApprovals === null ? `HTTP ${liveHelperResult?.status ?? "failed"}` : "Safe simulated/test approvals awaiting review.",
      tone: pendingApprovals === null
        ? "bad"
        : pendingApprovals > 0
          ? "warn"
          : "ok"
    },
    {
      key: "helpers",
      label: "Helpers",
      value: activeHelpers === null ? "Unavailable" : `${activeHelpers} active`,
      detail: activeHelpers === null
        ? `HTTP ${liveHelperResult?.status ?? "failed"}`
        : "Non-owner helper/moderator grants currently active.",
      tone: activeHelpers === null ? "bad" : "ok"
    },
    {
      key: "moderation",
      label: "Moderation",
      value: activeModeration === null ? "Unavailable" : `${activeModeration} active`,
      detail: activeModeration === null
        ? `HTTP ${liveHelperResult?.status ?? "failed"}`
        : `${liveHelperOpenWarnings + liveHelperOpenCriticals} open local alerts`,
      tone:
        activeModeration === null
          ? "bad"
          : liveHelperOpenCriticals > 0
              ? "bad"
              : activeModeration > 0
                ? "warn"
                : "ok"
    },
    {
      key: "money",
      label: "Money",
      value: moneyWarnings === null ? "Unavailable" : `${moneyWarnings} warning${moneyWarnings === 1 ? "" : "s"}`,
      detail: moneyWarnings === null
        ? `HTTP ${moneyLedgerResult?.status ?? "failed"}`
        : moneyWarnings === 0
          ? "No money warnings"
          : "Money ledger warning state requires review",
      tone:
        moneyWarnings === null
          ? "bad"
          : moneyWarnings > 0
            ? "warn"
            : "ok"
    }
  ];
};

const toneLabel: Record<ExportStatusTone, string> = {
  idle: "Neutral",
  working: "Working",
  ok: "Good",
  bad: "Attention"
};

const statusToneClass = (tone: DashboardStatusTone): string => {
  if (tone === "loading") {
    return styles.statusLoading ?? "";
  }

  if (tone === "ok") {
    return styles.statusOk ?? "";
  }

  if (tone === "warn") {
    return styles.statusWarn ?? "";
  }

  return styles.statusBad ?? "";
};

const exportStatusClass = (tone: ExportStatusTone): string => {
  if (tone === "ok") {
    return styles.exportOk ?? "";
  }

  if (tone === "bad") {
    return styles.exportBad ?? "";
  }

  return tone === "working" ? styles.exportWorking ?? "" : styles.exportIdle ?? "";
};

const badgeClass = (tone: DashboardStatusTone): string => {
  if (tone === "ok") {
    return styles.badgeOk ?? "";
  }

  if (tone === "warn") {
    return styles.badgeWarn ?? "";
  }

  return styles.badgeBad ?? "";
};

const getDashboardLinkHref = (item: AdminDashboardItem, devAuthToken: string | null): string =>
  item.preserveDevAuth === false ? item.href : withDevAuthToken(item.href, devAuthToken);

const AdminDashboardClient = (): React.ReactNode => {
  const [devAuthToken, setDevAuthToken] = useState<string | null>(null);
  const [statusCards, setStatusCards] = useState<readonly DashboardStatusCard[]>(() => loadingCards());
  const [statusMessage, setStatusMessage] = useState("Loading dashboard status...");
  const [exportStatus, setExportStatus] = useState<DashboardToneState>({
    tone: "idle",
    message: "Ready to download a read-only key-data JSON export."
  });

  const refreshStatus = async (): Promise<void> => {
    setStatusCards(loadingCards());
    setStatusMessage("Loading dashboard status...");

    try {
      setStatusCards(await loadStatusCards());
      setStatusMessage("Dashboard status loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dashboard status failed.";
      setStatusMessage(message);
      setStatusCards((cards) =>
        cards.map((card) => ({
          ...card,
          value: "Failed",
          detail: message,
          tone: "bad"
        }))
      );
    }
  };

  const downloadKeyDataExport = async (): Promise<void> => {
    setExportStatus({
      tone: "working",
      message: "Preparing key-data export..."
    });

    try {
      const response = await fetch(`${apiBaseUrl}/admin/backup/key-data-export`, {
        credentials: "include",
        headers: createApiHeaders()
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { reason?: string } | null;
        throw new Error(payload?.reason ?? `Export failed with HTTP ${response.status}.`);
      }

      const blob = await response.blob();
      const filename =
        getFilenameFromContentDisposition(response.headers.get("content-disposition"))
        ?? `maiks-yt-key-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportStatus({
        tone: "ok",
        message: `Downloaded ${filename}.`
      });
    } catch (error) {
      setExportStatus({
        tone: "bad",
        message: error instanceof Error ? error.message : "Key-data export failed."
      });
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    setDevAuthToken(getDevAuthToken());
    void refreshStatus();
  }, []);

  const apiStatus = findStatusCard(statusCards, "api");
  return (
    <section className={styles.adminShell}>
      <header className={styles.dashboardHeader}>
        <div>
          <p className={styles.eyebrow}>Private Admin</p>
          <h1>Admin Dashboard</h1>
          <p>
            Stream tools, safety, testing health, content, and site operations in one place.
          </p>
        </div>
        <p className={styles.statusPill}>
          API status: {apiStatus?.value ?? "Unknown"}
        </p>
      </header>

      <section className={styles.controlPanel}>
        <div className={styles.controlPanelHeader}>
          <div>
            <h2>Testing Status</h2>
            <p>{statusMessage}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => void downloadKeyDataExport()}>
              Download key data
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => void refreshStatus()}>
              Refresh status
            </button>
          </div>
        </div>

        <div className={styles.statusGrid}>
          {statusCards.map((card) => (
            <article className={`${styles.statusCard} ${statusToneClass(card.tone)}`} key={card.key}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <p className={`${styles.exportStatus} ${exportStatusClass(exportStatus.tone)}`}>
          <span>{toneLabel[exportStatus.tone]}</span>
          {exportStatus.message}
        </p>
      </section>

      <div className={styles.groupGrid}>
        {groups.map((group) => (
          <section className={styles.groupCard} key={group.title}>
            <h2>{group.title}</h2>
            <div className={styles.linkGrid}>
              {group.items.map((item) => {
                const badge = getDashboardItemBadge(item, statusCards);
                const href = getDashboardLinkHref(item, devAuthToken);
                return (
                  <a
                    className={styles.toolLink}
                    href={href}
                    key={item.href}
                  >
                    <div>
                      <div className={styles.toolTitleRow}>
                        <strong>{item.label}</strong>
                        {badge ? (
                          <span className={`${styles.badge} ${badgeClass(badge.tone)}`}>
                            {badge.label}
                          </span>
                        ) : null}
                      </div>
                      <p>{item.description}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

export default AdminDashboardClient;
