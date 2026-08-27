export type DashboardStatusTone = "loading" | "ok" | "warn" | "bad";

export type DashboardStatusCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardStatusTone;
};

export const adminDashboardStatusRequestPaths = {
  health: "/health",
  databaseHealth: "/health/database",
  notifications: "/admin/notifications?limit=5",
  providerIntakeHealth: "/admin/connections/intake/health",
  sessions: "/admin/sessions",
  backupHealth: "/admin/backup/health",
  localAgentStatus: "/admin/local-agent/status",
  activity: "/admin/overview/activity",
  moneyLedger: "/admin/money/ledger"
} as const;

export const createAdminDashboardLoadingCards = (): readonly DashboardStatusCard[] => [
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
    key: "money",
    label: "Money",
    value: "Checking",
    detail: "Loading private ledger warning count.",
    tone: "loading"
  }
];
