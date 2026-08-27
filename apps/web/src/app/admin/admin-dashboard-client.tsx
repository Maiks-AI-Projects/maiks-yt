"use client";

import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import {
  FaArrowsRotate,
  FaBell,
  FaBrain,
  FaChevronRight,
  FaCircleInfo,
  FaComments,
  FaDisplay,
  FaShieldHalved,
  FaSliders
} from "react-icons/fa6";

import { createApiHeaders, withDevAuthToken } from "../dev-auth-token";
import { useAdminAccess } from "./admin-access";
import { createControlUrl, overlayBaseUrl } from "../tool-surface-urls.service";
import styles from "./admin-dashboard.module.css";

type DashboardStatusTone = "loading" | "ok" | "warn" | "bad";
type HealthSummaryTone = "loading" | "ok" | "neutral" | "bad";

type DashboardStatusCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardStatusTone;
};

type LiveWindowLink = {
  href: string;
  label: string;
  description: string;
  icon: IconType;
  note?: string;
  statusKey?: string;
};

type HealthSummaryRow = {
  key: "core" | "local-agent" | "backup" | "access" | "finance";
  area: string;
  state: string;
  detail: string;
  tone: HealthSummaryTone;
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

type LocalAgentStatusResponse =
  | {
      ok: true;
      connection: {
        state: "not_configured" | "disconnected" | "connected" | "degraded";
        serviceVersion: string | null;
      };
      modules: Array<{
        availability: "available" | "degraded" | "unavailable";
      }>;
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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const liveWindowLinks: readonly LiveWindowLink[] = [
  {
    href: createControlUrl("/chat"),
    label: "Streamer chat",
    description: "Private live chat and service dots.",
    icon: FaComments,
    statusKey: "moderation"
  },
  {
    href: createControlUrl("/moderation"),
    label: "Moderation",
    description: "Chat-first moderation and helper context.",
    icon: FaShieldHalved,
    statusKey: "moderation"
  },
  {
    href: createControlUrl("/control"),
    label: "Control panel",
    description: "Scene controls and live stream tools.",
    icon: FaSliders
  },
  {
    href: createControlUrl("/ai"),
    label: "AI controls",
    description: "Safety-gated controls, currently inert.",
    icon: FaBrain,
    note: "Safety-gated"
  },
  {
    href: overlayBaseUrl,
    label: "OBS overlay",
    description: "Shared browser-source check surface.",
    icon: FaDisplay
  },
  {
    href: "/tools/notifications",
    label: "Notifications",
    description: "Owner device notices and smoke alerts.",
    icon: FaBell,
    statusKey: "notifications"
  }
];

const liveActivityLinks: readonly Omit<LiveWindowLink, "icon">[] = [
  {
    href: "/admin/event-routing",
    label: "Approvals",
    description: "Safe simulated events waiting for review.",
    statusKey: "pending-approvals"
  },
  {
    href: "/tools/notifications",
    label: "Live alerts",
    description: "Open warning and critical notifications.",
    statusKey: "live-alerts"
  },
  {
    href: "/admin/moderators",
    label: "Helpers",
    description: "Active non-owner helper and moderator grants.",
    statusKey: "helpers"
  },
  {
    href: createControlUrl("/moderation"),
    label: "Local test state",
    description: "Active fake/local moderation state.",
    statusKey: "moderation"
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
    key: "local-agent",
    label: "Local Agent",
    value: "Checking",
    detail: "Reading streaming-PC service health.",
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
    key: "live-alerts",
    label: "Live Alerts",
    value: "Checking",
    detail: "Loading warning and critical state.",
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

const getHumanDate = (value: string | null): string => {
  if (!value) {
    return "not recorded";
  }

  return new Date(value).toLocaleString();
};

const findStatusCard = (
  statusCards: readonly DashboardStatusCard[],
  key: string
): DashboardStatusCard | undefined => statusCards.find((card) => card.key === key);

const loadStatusCards = async (): Promise<readonly DashboardStatusCard[]> => {
  const [api, database, notifications, intakeHealth, sessions, backupHealth, localAgent, testingSmokeState, liveHelper, moneyLedger] =
    await Promise.allSettled([
      readJson<{ ok?: boolean; surface?: string }>("/health"),
      readJson<{ ok?: boolean; database?: string }>("/health/database"),
      readJson<NotificationListResponse>("/admin/notifications?limit=5", true),
      readJson<ProviderIntakeHealthResponse>("/admin/connections/intake/health", true),
      readJson<SessionListResponse>("/admin/sessions", true),
      readJson<BackupHealthResponse>("/admin/backup/health", true),
      readJson<LocalAgentStatusResponse>("/admin/local-agent/status", true),
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
  const localAgentResult = getFulfilled(localAgent);
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

  const localAgentSnapshot = localAgentResult?.payload?.ok ? localAgentResult.payload : null;
  const availableLocalAgentModules = localAgentSnapshot?.modules.filter(
    (module) => module.availability === "available"
  ).length ?? 0;
  const localAgentState = localAgentSnapshot?.connection.state ?? null;

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
      key: "local-agent",
      label: "Local Agent",
      value: localAgentState === "connected"
        ? "Connected"
        : localAgentState === "degraded"
          ? "Degraded"
          : localAgentState === "disconnected"
            ? "Disconnected"
            : localAgentState === "not_configured"
              ? "Not configured"
              : "Unavailable",
      detail: localAgentSnapshot
        ? `${availableLocalAgentModules}/${localAgentSnapshot.modules.length} modules available${localAgentSnapshot.connection.serviceVersion ? ` · service ${localAgentSnapshot.connection.serviceVersion}` : ""}`
        : `HTTP ${localAgentResult?.status ?? "failed"}`,
      tone: localAgentState === "connected"
        ? "ok"
        : localAgentState === "degraded"
          ? "warn"
          : "bad"
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
      key: "live-alerts",
      label: "Live Alerts",
      value: liveHelperResult?.payload?.ok
        ? `${liveHelperOpenWarnings + liveHelperOpenCriticals} open`
        : "Unavailable",
      detail: liveHelperResult?.payload?.ok
        ? `${liveHelperOpenWarnings} warning · ${liveHelperOpenCriticals} critical`
        : `HTTP ${liveHelperResult?.status ?? "failed"}`,
      tone: !liveHelperResult?.payload?.ok
        ? "bad"
        : liveHelperOpenCriticals > 0
          ? "bad"
          : liveHelperOpenWarnings > 0
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
      label: "Local Test State",
      value: activeModeration === null ? "Unavailable" : `${activeModeration} active`,
      detail: activeModeration === null
        ? `HTTP ${liveHelperResult?.status ?? "failed"}`
        : "Fake/local moderation only",
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

const getHealthSummaryRows = (statusCards: readonly DashboardStatusCard[]): readonly HealthSummaryRow[] => {
  const api = findStatusCard(statusCards, "api");
  const database = findStatusCard(statusCards, "database");
  const backup = findStatusCard(statusCards, "backup");
  const localAgent = findStatusCard(statusCards, "local-agent");
  const sessions = findStatusCard(statusCards, "sessions");
  const money = findStatusCard(statusCards, "money");
  const coreTone = getWorstTone([api, database].filter((card): card is DashboardStatusCard => Boolean(card)));

  const backupTableSummary = backup?.value.match(/^(\d+)\/(\d+) tables$/);
  const backupDetail = backupTableSummary
    ? `${backupTableSummary[1]} / ${backupTableSummary[2]} source tables present · Coverage and recency unverified`
    : backup?.tone === "loading"
      ? "Checking source table presence"
      : "Source table presence unavailable · Coverage and recency unverified";

  return [
    {
      key: "core",
      area: "Core services",
      state: coreTone === "loading" ? "Checking" : coreTone === "ok" ? "Healthy" : "Attention",
      detail: `API ${api?.value.toLowerCase() ?? "unknown"} · Database ${database?.value.toLowerCase() ?? "unknown"}`,
      tone: coreTone === "warn" ? "bad" : coreTone
    },
    {
      key: "backup",
      area: "Backup",
      state: backup?.tone === "loading" ? "Checking" : backup?.tone === "bad" ? "Attention" : "Unverified",
      detail: backupDetail,
      tone: backup?.tone === "loading" ? "loading" : backup?.tone === "bad" ? "bad" : "neutral"
    },
    {
      key: "local-agent",
      area: "Local agent",
      state: localAgent?.value ?? "Unknown",
      detail: localAgent?.detail ?? "Streaming-PC service health unavailable",
      tone: localAgent?.tone === "warn" ? "bad" : localAgent?.tone ?? "loading"
    },
    {
      key: "access",
      area: "Access",
      state: sessions?.value ?? "Unknown",
      detail: "Owner sessions",
      tone: sessions?.tone === "loading" ? "loading" : sessions?.tone === "bad" ? "bad" : "neutral"
    },
    {
      key: "finance",
      area: "Finance",
      state: money?.tone === "loading" ? "Checking" : money?.tone === "ok" ? "Clear" : "Attention",
      detail: money?.tone === "ok" ? `0 money warnings` : money?.detail ?? "Money warning state unavailable",
      tone: money?.tone === "warn" ? "bad" : money?.tone ?? "loading"
    }
  ];
};

const getProviderActivitySummary = (statusCard: DashboardStatusCard | undefined): string => {
  const counts = statusCard?.value.match(/^(\d+)\/(\d+) healthy$/);

  if (counts) {
    return `${counts[1]} / ${counts[2]} mechanisms recently active`;
  }

  return statusCard?.tone === "loading" ? "checking" : statusCard?.value.toLowerCase() ?? "unavailable";
};

const getSmokeSummary = (statusCard: DashboardStatusCard | undefined): string => {
  if (!statusCard || statusCard.tone === "loading") {
    return "checking";
  }

  if (statusCard.value === "Unknown") {
    return "no recorded run";
  }

  return statusCard.value.toLowerCase();
};

const AdminDashboardClient = (): React.ReactNode => {
  const { accessState, devAuthToken } = useAdminAccess();
  const [statusCards, setStatusCards] = useState<readonly DashboardStatusCard[]>(() => loadingCards());
  const [statusMessage, setStatusMessage] = useState("Checking now");

  const refreshStatus = async (): Promise<void> => {
    setStatusCards(loadingCards());
    setStatusMessage("Checking now");

    try {
      setStatusCards(await loadStatusCards());
      setStatusMessage("Checked just now");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dashboard status failed.";
      setStatusMessage("Check failed");
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

  useEffect(() => {
    if (accessState !== "owner") {
      return;
    }

    void refreshStatus();
  }, [accessState]);

  if (accessState !== "owner") {
    const isChecking = accessState === "checking";

    return (
      <section className={styles.adminShell}>
        <header className={styles.dashboardHeader}>
          <div>
            <p className={styles.eyebrow}>Private Admin</p>
            <h1>{isChecking ? "Checking access" : "Access required"}</h1>
          </div>
        </header>
        <section className={styles.accessPanel} aria-labelledby="admin-access-state-title">
          <h2 id="admin-access-state-title">{isChecking ? "Checking" : "No admin navigation available"}</h2>
          <p>
            {isChecking
              ? "No admin destinations are shown until access is confirmed."
              : "The route remains owner-only. Moderators and helpers use the separate Moderation PWA."}
          </p>
        </section>
      </section>
    );
  }

  const apiStatus = findStatusCard(statusCards, "api");
  const healthSummaryRows = getHealthSummaryRows(statusCards);
  const providerActivity = getProviderActivitySummary(findStatusCard(statusCards, "provider-intake"));
  const smokeSummary = getSmokeSummary(findStatusCard(statusCards, "smoke"));
  const liveActivity = liveActivityLinks.map((item) => ({
    ...item,
    status: item.statusKey ? findStatusCard(statusCards, item.statusKey) : undefined
  }));

  return (
    <section className={styles.adminShell}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>Private Admin</p>
          <div className={styles.titleRow}>
            <h1>Overview</h1>
            <span>{statusMessage}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <p className={styles.statusPill} data-tone={apiStatus?.tone ?? "loading"}>
            API status: {apiStatus?.value ?? "Unknown"}
          </p>
          <button type="button" className={styles.refreshButton} onClick={() => void refreshStatus()}>
            <FaArrowsRotate aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <section className={styles.streamSection} aria-labelledby="admin-stream-windows-title">
        <h2 id="admin-stream-windows-title">Stream windows</h2>
        <div className={styles.streamWindowGrid}>
          {liveWindowLinks.map((item) => {
            const Icon = item.icon;
            const status = item.statusKey ? findStatusCard(statusCards, item.statusKey) : undefined;

            return (
              <a
                className={styles.streamWindowLink}
                href={getDashboardLinkHref(item.href, devAuthToken)}
                key={item.href}
                title={item.description}
              >
                <Icon aria-hidden="true" />
                <span className={styles.streamWindowCopy}>
                  <strong>{item.label}</strong>
                  {item.note ? <small>{item.note}</small> : null}
                </span>
                {status ? (
                  <span className={styles.compactStatus} data-tone={status.tone}>
                    {status.value}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      </section>

      <section className={styles.liveActivitySection} aria-labelledby="admin-live-activity-title">
        <h2 id="admin-live-activity-title">Live activity</h2>
        <div className={styles.liveActivityGrid}>
          {liveActivity.map((item) => (
            <a
              className={styles.liveActivityLink}
              data-tone={item.status?.tone ?? "loading"}
              href={getDashboardLinkHref(item.href, devAuthToken)}
              key={item.label}
              title={item.description}
            >
              <span className={styles.activityDot} aria-hidden="true" />
              <span>
                <span>{item.label}</span>
                <strong>{item.status?.value ?? "Checking"}</strong>
              </span>
              <FaChevronRight aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section className={styles.healthSection} aria-labelledby="admin-health-summary-title">
        <h2 id="admin-health-summary-title">Health summary</h2>
        <div className={styles.healthTableWrapper}>
          <table className={styles.healthTable}>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">State</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {healthSummaryRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.area}</th>
                  <td>
                    <span className={styles.healthState} data-tone={row.tone}>
                      <span aria-hidden="true" />
                      {row.state}
                    </span>
                  </td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.informationalNote}>
          <FaCircleInfo aria-hidden="true" />
          <div>
            <strong>Informational</strong>
            <p>Provider activity: {providerActivity} · Recurring smoke: {smokeSummary}</p>
            <small>Inactive provider mechanisms are expected when services are not running.</small>
          </div>
        </div>
      </section>
    </section>
  );
};

export default AdminDashboardClient;
