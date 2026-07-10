"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders, getDevAuthToken } from "../dev-auth-token";

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

type ExportStatusTone = "idle" | "working" | "ok" | "bad";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const groups: readonly AdminDashboardGroup[] = [
  {
    title: "Stream Windows",
    items: [
      {
        href: "https://control-dev.maiks.yt/chat",
        label: "Streamer Chat",
        description: "Standalone private chat window for live messages and quick local moderation."
      },
      {
        href: "https://control-dev.maiks.yt/moderation",
        label: "Moderation Window",
        description: "Dedicated moderator/creator window for chat, rules, approvals, and helper context."
      },
      {
        href: "https://control-dev.maiks.yt/control",
        label: "Control Panel",
        description: "Overlay controls, scene designer, and stream tool controls."
      },
      {
        href: "https://overlay-dev.maiks.yt/",
        label: "OBS Overlay",
        description: "Shared overlay browser-source surface for OBS checks."
      },
      {
        href: "/tools/notifications",
        label: "Notifications",
        description: "Installed alert panel for dev smoke failures and important system notices.",
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
        description: "Manual testing order and readiness commands for the current dev build."
      },
      {
        href: "/admin/connections",
        label: "Connections",
        description: "Provider intake catalog, health, and recent received events."
      },
      {
        href: "/admin/provider-integrations",
        label: "Provider Integrations",
        description: "Twitch, YouTube, and Discord connection controls."
      },
      {
        href: "/admin/event-routing",
        label: "Event Routing",
        description: "Manual routing rules and pending simulated approvals."
      },
      {
        href: "/admin/live-helper",
        label: "Live Helper",
        description: "Read-only helper snapshot for moderation and stream state."
      },
      {
        href: "/admin/backup/health",
        label: "Backup Health",
        description: "Read-only backup/export readiness checks."
      }
    ]
  },
  {
    title: "Stream Operations",
    items: [
      {
        href: "/admin/schedule",
        label: "Schedule",
        description: "Create, edit, cancel, and focus planned streams."
      },
      {
        href: "/admin/tokens",
        label: "Access Tokens",
        description: "Create and rotate overlay/control URL tokens."
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        description: "Review and revoke active browser sessions."
      },
      {
        href: "/admin/moderators",
        label: "Moderators",
        description: "Manage helper ranks, rights, and grants."
      }
    ]
  },
  {
    title: "Content",
    items: [
      {
        href: "/admin/pages",
        label: "Pages",
        description: "Draft, preview, and publish editable site pages."
      },
      {
        href: "/admin/games",
        label: "Games",
        description: "Manage the curated game library and stream-planning metadata."
      },
      {
        href: "/admin/projects",
        label: "Projects",
        description: "Manage public project content, milestones, and updates."
      },
      {
        href: "/admin/links",
        label: "Creator Links",
        description: "Edit public hub links and availability."
      },
      {
        href: "/admin/money",
        label: "Money Ledger",
        description: "Private ledger entries, warnings, corrections, and exports."
      }
    ]
  }
];

const getDevAuthQuery = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const token = getDevAuthToken();

  return token ? `?devAuthToken=${encodeURIComponent(token)}` : "";
};

const getDashboardLinkHref = (item: AdminDashboardItem, devAuthQuery: string): string =>
  item.preserveDevAuth !== false && item.href.startsWith("/") ? `${item.href}${devAuthQuery}` : item.href;

const findStatusCard = (statusCards: readonly DashboardStatusCard[], key: string): DashboardStatusCard | null =>
  statusCards.find((card) => card.key === key) ?? null;

const toLinkBadgeTone = (tone: DashboardStatusTone): AdminDashboardLinkBadge["tone"] | null =>
  tone === "loading" ? null : tone;

const getDashboardItemBadge = (
  item: AdminDashboardItem,
  statusCards: readonly DashboardStatusCard[]
): AdminDashboardLinkBadge | null => {
  const statusKeyByHref: Record<string, string> = {
    "/admin/backup/health": "backup",
    "/admin/connections": "provider-intake",
    "/admin/event-routing": "pending-approvals",
    "/admin/live-helper": "live-helper",
    "/admin/moderators": "active-helpers",
    "/admin/sessions": "sessions",
    "https://control-dev.maiks.yt/moderation": "active-moderation",
    "/tools/notifications": "notifications"
  };
  const statusKey = statusKeyByHref[item.href];

  if (!statusKey) {
    return null;
  }

  const statusCard = findStatusCard(statusCards, statusKey);
  if (!statusCard) {
    return null;
  }

  const tone = toLinkBadgeTone(statusCard.tone);

  return tone ? {
    label: statusCard.value,
    tone
  } : null;
};

const loadingCards = (): readonly DashboardStatusCard[] => [
  {
    key: "api",
    label: "API",
    value: "Checking",
    detail: "Waiting for API health.",
    tone: "loading"
  },
  {
    key: "database",
    label: "Database",
    value: "Checking",
    detail: "Waiting for database health.",
    tone: "loading"
  },
  {
    key: "notifications",
    label: "Notifications",
    value: "Checking",
    detail: "Waiting for notification counts.",
    tone: "loading"
  },
  {
    key: "provider-intake",
    label: "Provider Intake",
    value: "Checking",
    detail: "Waiting for provider intake health.",
    tone: "loading"
  },
  {
    key: "sessions",
    label: "Sessions",
    value: "Checking",
    detail: "Waiting for session-admin access.",
    tone: "loading"
  },
  {
    key: "backup",
    label: "Backup Health",
    value: "Checking",
    detail: "Waiting for backup health.",
    tone: "loading"
  },
  {
    key: "recurring-smoke",
    label: "Recurring Smoke",
    value: "Checking",
    detail: "Waiting for recurring smoke state.",
    tone: "loading"
  },
  {
    key: "pending-approvals",
    label: "Pending Approvals",
    value: "Checking",
    detail: "Waiting for live helper approval counts.",
    tone: "loading"
  },
  {
    key: "active-helpers",
    label: "Active Helpers",
    value: "Checking",
    detail: "Waiting for helper grant counts.",
    tone: "loading"
  },
  {
    key: "active-moderation",
    label: "Active Moderation",
    value: "Checking",
    detail: "Waiting for active local moderation counts.",
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

const loadStatusCards = async (): Promise<readonly DashboardStatusCard[]> => {
  const [
    api,
    database,
    notifications,
    intakeHealth,
    sessions,
    backupHealth,
    testingSmokeState,
    liveHelper
  ] = await Promise.allSettled([
    readJson<{ ok?: boolean; surface?: string }>("/health"),
    readJson<{ ok?: boolean; database?: string }>("/health/database"),
    readJson<NotificationListResponse>("/admin/notifications?limit=5", true),
    readJson<ProviderIntakeHealthResponse>("/admin/connections/intake/health", true),
    readJson<SessionListResponse>("/admin/sessions", true),
    readJson<BackupHealthResponse>("/admin/backup/health", true),
    readJson<TestingSmokeStateResponse>("/admin/testing/smoke-state", true),
    readJson<LiveHelperDashboardResponse>("/admin/live-helper", true)
  ]);
  const getFulfilled = <Payload,>(result: PromiseSettledResult<{
    status: number;
    payload: Payload | null;
  }>) => result.status === "fulfilled" ? result.value : null;
  const apiResult = getFulfilled(api);
  const databaseResult = getFulfilled(database);
  const notificationResult = getFulfilled(notifications);
  const intakeResult = getFulfilled(intakeHealth);
  const sessionResult = getFulfilled(sessions);
  const backupResult = getFulfilled(backupHealth);
  const smokeResult = getFulfilled(testingSmokeState);
  const liveHelperResult = getFulfilled(liveHelper);
  const intakeEntries = intakeResult?.payload?.ok ? intakeResult.payload.entries : [];
  const staleOrMissing = intakeEntries.filter((entry) => entry.status !== "healthy").length;
  const criticalUnread = notificationResult?.payload?.ok ? notificationResult.payload.criticalUnreadCount : 0;
  const unread = notificationResult?.payload?.ok ? notificationResult.payload.unreadCount : 0;
  const backupTables = backupResult?.payload?.ok ? backupResult.payload.requiredTables : [];
  const missingBackupTables = backupTables.filter((table) => !table.present).length;
  const backupWarningCount = backupResult?.payload?.ok ? backupResult.payload.warnings.length : 0;
  const smokeState = smokeResult?.payload?.ok ? smokeResult.payload.state : null;
  const smokeLastRun = smokeState?.lastSuccessAt ?? smokeState?.lastFailureNotifiedAt ?? null;
  const pendingApprovalCount = liveHelperResult?.payload?.ok ? liveHelperResult.payload.pendingApprovals.count : 0;
  const openHelperWarningCount = liveHelperResult?.payload?.ok ? liveHelperResult.payload.notifications.openWarningCount : 0;
  const openHelperCriticalCount = liveHelperResult?.payload?.ok ? liveHelperResult.payload.notifications.openCriticalCount : 0;
  const activeHelperCount = liveHelperResult?.payload?.ok ? liveHelperResult.payload.activeHelperGrants.count : 0;
  const activeModerationCount = liveHelperResult?.payload?.ok ? liveHelperResult.payload.fakeLocalActiveModeration.count : 0;
  const totalHelperAlertCount = openHelperWarningCount + openHelperCriticalCount;

  return [
    {
      key: "api",
      label: "API",
      value: apiResult?.payload?.ok ? "Online" : "Problem",
      detail: apiResult?.payload?.ok ? `Surface: ${apiResult.payload.surface ?? "api"}` : `HTTP ${apiResult?.status ?? "failed"}`,
      tone: apiResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "database",
      label: "Database",
      value: databaseResult?.payload?.ok ? "Online" : "Problem",
      detail: databaseResult?.payload?.ok ? `Driver: ${databaseResult.payload.database ?? "connected"}` : `HTTP ${databaseResult?.status ?? "failed"}`,
      tone: databaseResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "notifications",
      label: "Notifications",
      value: notificationResult?.payload?.ok ? `${unread} unread` : "Unavailable",
      detail: notificationResult?.payload?.ok
        ? `${criticalUnread} critical unread.`
        : `HTTP ${notificationResult?.status ?? "failed"}`,
      tone: !notificationResult?.payload?.ok ? "bad" : criticalUnread > 0 ? "bad" : unread > 0 ? "warn" : "ok"
    },
    {
      key: "provider-intake",
      label: "Provider Intake",
      value: intakeResult?.payload?.ok ? `${intakeEntries.length - staleOrMissing}/${intakeEntries.length} healthy` : "Unavailable",
      detail: intakeResult?.payload?.ok
        ? `${staleOrMissing} stale or missing mechanisms.`
        : `HTTP ${intakeResult?.status ?? "failed"}`,
      tone: !intakeResult?.payload?.ok ? "bad" : staleOrMissing > 0 ? "warn" : "ok"
    },
    {
      key: "sessions",
      label: "Sessions",
      value: sessionResult?.payload?.ok ? `${sessionResult.payload.sessions.length} listed` : "Unavailable",
      detail: sessionResult?.payload?.ok ? "Owner session admin is reachable." : `HTTP ${sessionResult?.status ?? "failed"}`,
      tone: sessionResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "backup",
      label: "Backup Health",
      value: backupResult?.payload?.ok ? `${backupTables.length - missingBackupTables}/${backupTables.length} tables` : "Unavailable",
      detail: backupResult?.payload?.ok
        ? backupResult.payload.healthOk
          ? `${missingBackupTables} missing table(s). ${backupWarningCount} warning(s).`
          : backupResult.payload.databaseReachable
            ? "One or more required tables are missing."
            : "Database is not reachable."
        : `HTTP ${backupResult?.status ?? "failed"}`,
      tone: !backupResult?.payload?.ok || !backupResult.payload.healthOk
        ? "bad"
        : backupWarningCount > 0
          ? "warn"
          : "ok"
    },
    {
      key: "recurring-smoke",
      label: "Recurring Smoke",
      value: smokeResult?.payload?.ok
        ? smokeState?.status === "passing"
          ? "Passing"
          : smokeState?.status === "failing"
            ? "Failure active"
            : "Unknown"
        : "Unavailable",
      detail: smokeResult?.payload?.ok
        ? smokeState?.stateAvailable
          ? `Last recorded run: ${smokeLastRun ? new Date(smokeLastRun).toLocaleString() : "unknown"}.`
          : "No recurring smoke state file has been recorded yet."
        : `HTTP ${smokeResult?.status ?? "failed"}`,
      tone: !smokeResult?.payload?.ok
        ? "bad"
        : smokeState?.status === "failing"
          ? "bad"
          : smokeState?.status === "passing"
            ? "ok"
            : "warn"
    },
    {
      key: "pending-approvals",
      label: "Pending Approvals",
      value: liveHelperResult?.payload?.ok ? `${pendingApprovalCount} pending` : "Unavailable",
      detail: liveHelperResult?.payload?.ok
        ? "Safe simulated/test approvals waiting for review."
        : `HTTP ${liveHelperResult?.status ?? "failed"}`,
      tone: !liveHelperResult?.payload?.ok ? "bad" : pendingApprovalCount > 0 ? "warn" : "ok"
    },
    {
      key: "active-helpers",
      label: "Active Helpers",
      value: liveHelperResult?.payload?.ok ? `${activeHelperCount} active` : "Unavailable",
      detail: liveHelperResult?.payload?.ok
        ? "Non-owner active helper/moderator grants."
        : `HTTP ${liveHelperResult?.status ?? "failed"}`,
      tone: liveHelperResult?.payload?.ok ? "ok" : "bad"
    },
    {
      key: "active-moderation",
      label: "Active Moderation",
      value: liveHelperResult?.payload?.ok ? `${activeModerationCount} active` : "Unavailable",
      detail: liveHelperResult?.payload?.ok
        ? `${totalHelperAlertCount} open warning/critical alert(s).`
        : `HTTP ${liveHelperResult?.status ?? "failed"}`,
      tone: !liveHelperResult?.payload?.ok
        ? "bad"
        : openHelperCriticalCount > 0
          ? "bad"
          : activeModerationCount > 0 || openHelperWarningCount > 0
            ? "warn"
            : "ok"
    }
  ];
};

const AdminDashboardClient = (): React.ReactNode => {
  const [devAuthQuery, setDevAuthQuery] = useState("");
  const [statusCards, setStatusCards] = useState<readonly DashboardStatusCard[]>(() => loadingCards());
  const [statusMessage, setStatusMessage] = useState("Loading dashboard status...");
  const [exportStatus, setExportStatus] = useState<{
    tone: ExportStatusTone;
    message: string;
  }>({
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
      setStatusMessage(error instanceof Error ? error.message : "Dashboard status failed.");
      setStatusCards((cards) => cards.map((card) => ({
        ...card,
        value: "Failed",
        detail: "Status check failed.",
        tone: "bad"
      })));
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
      const filename = getFilenameFromContentDisposition(response.headers.get("content-disposition"))
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
    setDevAuthQuery(getDevAuthQuery());
    void refreshStatus();
  }, []);

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Admin Dashboard</h1>
          <p>Quick links for testing and operating the current dev build.</p>
        </div>
        <div className="admin-inline-actions">
          <button type="button" onClick={() => void downloadKeyDataExport()}>
            Download key data
          </button>
          <button type="button" onClick={() => void refreshStatus()}>
            Refresh status
          </button>
        </div>
      </header>

      <section className="project-admin-panel">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Testing Status</h2>
            <p>{statusMessage}</p>
          </div>
        </div>
        <div className="admin-dashboard-status-grid">
          {statusCards.map((card) => (
            <article className={`admin-dashboard-status-card ${card.tone}`} key={card.key}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
        <p className={`admin-dashboard-export-status ${exportStatus.tone}`}>
          {exportStatus.message}
        </p>
      </section>

      <div className="project-admin-grid">
        {groups.map((group) => (
          <section className="project-admin-preview" key={group.title}>
            <h2>{group.title}</h2>
            <div className="admin-list">
              {group.items.map((item) => {
                const badge = getDashboardItemBadge(item, statusCards);

                return (
                  <a className="admin-list-item admin-dashboard-link" href={getDashboardLinkHref(item, devAuthQuery)} key={item.href}>
                    <div>
                      <div className="admin-dashboard-link-heading">
                        <strong>{item.label}</strong>
                        {badge ? (
                          <span className={`admin-dashboard-link-badge ${badge.tone}`}>
                            {badge.label}
                          </span>
                        ) : null}
                      </div>
                      <span>{item.href}</span>
                    </div>
                    <p>{item.description}</p>
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
