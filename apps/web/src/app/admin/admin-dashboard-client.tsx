"use client";

import { useEffect, useState } from "react";

import { createApiHeaders, withDevAuthToken } from "../dev-auth-token";
import { useAdminAccess } from "./admin-access";
import { adminNavigationGroups, helperAdminNavigationItem, type AdminNavigationItem } from "./admin-navigation-data";
import { createControlUrl, overlayBaseUrl } from "../tool-surface-urls.service";
import styles from "./admin-dashboard.module.css";

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

type LiveWindowLink = {
  href: string;
  label: string;
  description: string;
  statusKey?: string;
};

type DashboardStatusSummary = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardStatusTone;
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

const liveWindowLinks: readonly LiveWindowLink[] = [
  {
    href: createControlUrl("/chat"),
    label: "Streamer Chat",
    description: "Private live chat and service dots.",
    statusKey: "moderation"
  },
  {
    href: createControlUrl("/moderation"),
    label: "Moderation Window",
    description: "Chat-first moderation and helper context.",
    statusKey: "moderation"
  },
  {
    href: createControlUrl("/control"),
    label: "Control Panel",
    description: "Scene controls and live stream tools."
  },
  {
    href: createControlUrl("/ai"),
    label: "AI Controls",
    description: "Safety-gated controls, currently inert."
  },
  {
    href: overlayBaseUrl,
    label: "OBS Overlay",
    description: "Shared browser-source check surface."
  },
  {
    href: "/tools/notifications",
    label: "Notifications",
    description: "Owner device notices and smoke alerts.",
    statusKey: "notifications"
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
  },
  {
    key: "money",
    label: "Money",
    value: "Checking",
    detail: "Loading private ledger warning count.",
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
  item: Pick<AdminNavigationItem, "statusKey">,
  statusCards: readonly DashboardStatusCard[]
): AdminDashboardLinkBadge | null => {
  if (!item.statusKey) {
    return null;
  }

  const statusCard = statusCards.find((card) => card.key === item.statusKey);
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

const getDashboardLinkHref = (href: string, devAuthToken: string | null): string => withDevAuthToken(href, devAuthToken);

const getWorstTone = (cards: readonly DashboardStatusCard[]): DashboardStatusTone => {
  if (cards.some((card) => card.tone === "loading")) {
    return "loading";
  }

  if (cards.some((card) => card.tone === "bad")) {
    return "bad";
  }

  if (cards.some((card) => card.tone === "warn")) {
    return "warn";
  }

  return "ok";
};

const toneSummaryLabel: Record<DashboardStatusTone, string> = {
  loading: "Checking",
  ok: "Clear",
  warn: "Review",
  bad: "Attention"
};

const buildStatusSummary = (
  key: string,
  label: string,
  statusCards: readonly DashboardStatusCard[],
  statusKeys: readonly string[]
): DashboardStatusSummary => {
  const cards = statusKeys
    .map((statusKey) => findStatusCard(statusCards, statusKey))
    .filter((card): card is DashboardStatusCard => Boolean(card));
  const tone = getWorstTone(cards);

  return {
    key,
    label,
    value: toneSummaryLabel[tone],
    detail: cards.map((card) => `${card.label}: ${card.value}`).join(" · "),
    tone
  };
};

const buildStatusSummaries = (statusCards: readonly DashboardStatusCard[]): readonly DashboardStatusSummary[] => [
  buildStatusSummary("platform", "Platform Health", statusCards, ["api", "database", "backup", "smoke"]),
  buildStatusSummary("safety", "Safety Signals", statusCards, ["notifications", "provider-intake", "pending-approvals", "moderation"]),
  buildStatusSummary("access", "Access", statusCards, ["sessions", "helpers"]),
  buildStatusSummary("finance", "Finance", statusCards, ["money"])
];

const AdminDashboardClient = (): React.ReactNode => {
  const { accessState, devAuthToken } = useAdminAccess();
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
    if (accessState !== "owner") {
      return;
    }

    void refreshStatus();
  }, [accessState]);

  if (accessState !== "owner") {
    const isChecking = accessState === "checking";
    const isHelper = accessState === "helper";

    return (
      <section className={styles.adminShell}>
        <header className={styles.dashboardHeader}>
          <div>
            <p className={styles.eyebrow}>Private Admin</p>
            <h1>{isChecking ? "Checking access" : isHelper ? "Limited admin access" : "Access required"}</h1>
            <p>
              {isChecking
                ? "Checking whether this account can open the admin overview."
                : isHelper
                  ? "This account can use the live-helper admin surface, but owner-only admin areas stay hidden."
                  : "Sign in with an account that has admin access to view this overview."}
            </p>
          </div>
        </header>
        <section className={styles.accessPanel} aria-labelledby="admin-access-state-title">
          <h2 id="admin-access-state-title">{isChecking ? "Checking" : isHelper ? "Available destination" : "No admin navigation available"}</h2>
          <p>
            {isChecking
              ? "No admin destinations are shown until access is confirmed."
              : isHelper
                ? "Open the helper dashboard for active helper grants, alerts, and moderation state."
                : "The route remains protected by the existing page and API access checks."}
          </p>
          {isHelper ? (
            <a className={styles.accessLink} href={getDashboardLinkHref(helperAdminNavigationItem.href, devAuthToken)}>
              Open {helperAdminNavigationItem.label}
            </a>
          ) : null}
        </section>
      </section>
    );
  }

  const apiStatus = findStatusCard(statusCards, "api");
  const statusSummaries = buildStatusSummaries(statusCards);

  return (
    <section className={styles.adminShell}>
      <header className={styles.dashboardHeader}>
        <div>
          <p className={styles.eyebrow}>Private Admin</p>
          <h1>Admin</h1>
          <p>
            Compact status and entry points for the focused admin sections.
          </p>
        </div>
        <p className={styles.statusPill}>
          API status: {apiStatus?.value ?? "Unknown"}
        </p>
      </header>

      <section className={styles.controlPanel}>
        <div className={styles.controlPanelHeader}>
          <div>
            <h2>Overview Status</h2>
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

        <div className={styles.statusSummaryGrid}>
          {statusSummaries.map((summary) => (
            <article className={`${styles.statusSummaryCard} ${statusToneClass(summary.tone)}`} key={summary.key}>
              <span>{summary.label}</span>
              <strong>{summary.value}</strong>
              <p>{summary.detail}</p>
            </article>
          ))}
        </div>

        <p className={`${styles.exportStatus} ${exportStatusClass(exportStatus.tone)}`}>
          <span>{toneLabel[exportStatus.tone]}</span>
          {exportStatus.message}
        </p>
      </section>

      <section className={styles.areaSection} aria-labelledby="admin-areas-title">
        <div className={styles.sectionHeading}>
          <h2 id="admin-areas-title">Admin Areas</h2>
          <p>The side rail keeps every destination available; these cards open each group.</p>
        </div>
        <div className={styles.areaGrid}>
          {adminNavigationGroups.map((group) => {
            const statusItems = group.items
              .map((item) => getDashboardItemBadge(item, statusCards))
              .filter((badge): badge is AdminDashboardLinkBadge => Boolean(badge));

            return (
              <a className={styles.areaCard} href={getDashboardLinkHref(group.href, devAuthToken)} key={group.id}>
                <div className={styles.areaCardHeader}>
                  <span>{group.shortLabel}</span>
                  <strong>{group.label}</strong>
                </div>
                <p>{group.description}</p>
                <div className={styles.areaMeta}>
                  <span>{group.items.length} {group.items.length === 1 ? "destination" : "destinations"}</span>
                  {statusItems.slice(0, 2).map((badge, index) => (
                    <span className={`${styles.badge} ${badgeClass(badge.tone)}`} key={`${group.id}-${badge.label}-${index}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className={styles.launchSection} aria-labelledby="admin-live-windows-title">
        <div className={styles.sectionHeading}>
          <h2 id="admin-live-windows-title">Live Windows</h2>
          <p>Standalone stream tools stay separate from the admin page content.</p>
        </div>
        <div className={styles.launchGrid}>
          {liveWindowLinks.map((item) => {
            const badge = getDashboardItemBadge(item, statusCards);

            return (
              <a className={styles.launchLink} href={getDashboardLinkHref(item.href, devAuthToken)} key={item.href}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
                {badge ? (
                  <span className={`${styles.badge} ${badgeClass(badge.tone)}`}>
                    {badge.label}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default AdminDashboardClient;
