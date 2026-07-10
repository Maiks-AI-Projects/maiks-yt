"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders, getDevAuthToken } from "../../../dev-auth-token";

type BackupHealthResponse =
  | {
    ok: true;
    checkedAt: string;
    healthOk: boolean;
    databaseReachable: boolean;
    requiredTables: Array<{
      name: string;
      present: boolean;
    }>;
    backupTool: {
      available: boolean;
      command: string | null;
      version: string | null;
    };
    warnings: string[];
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const getDevAuthQuery = (): string => {
  const token = getDevAuthToken();

  return token ? `?devAuthToken=${encodeURIComponent(token)}` : "";
};

const getLoadFailure = (status: number, reason?: string): {
  message: string;
  state: LoadState;
} => {
  if (status === 401) {
    return {
      message: "Sign in as owner to view backup health.",
      state: "signed-out"
    };
  }

  if (status === 403 || reason === "backup_health_forbidden") {
    return {
      message: "This account cannot view backup health.",
      state: "forbidden"
    };
  }

  return {
    message: reason ?? `Backup health failed with HTTP ${status}.`,
    state: "failed"
  };
};

const formatCheckedAt = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const BackupHealthAdminClient = (): React.ReactNode => {
  const [devAuthQuery, setDevAuthQuery] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading backup health...");
  const [health, setHealth] = useState<BackupHealthResponse | null>(null);

  const loadHealth = async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading backup health...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/backup/health`, {
        credentials: "include",
        headers: createApiHeaders()
      });
      const payload = await response.json().catch(() => null) as BackupHealthResponse | null;

      if (!response.ok || !payload?.ok) {
        const failure = getLoadFailure(response.status, payload?.ok === false ? payload.reason : undefined);
        setHealth(payload);
        setLoadState(failure.state);
        setMessage(failure.message);
        return;
      }

      setHealth(payload);
      setLoadState("ready");
      setMessage(payload.healthOk ? "Backup health is ready for testing." : "Backup health has warnings.");
    } catch (error) {
      setHealth(null);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Backup health failed.");
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    setDevAuthQuery(getDevAuthQuery());
    void loadHealth();
  }, []);

  const requiredTables = health?.ok ? health.requiredTables : [];
  const backupTool = health?.ok ? health.backupTool : null;
  const warnings = health?.ok ? health.warnings : [];
  const missingRequiredTables = requiredTables.filter((table) => !table.present).length;

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Backup</p>
          <h1>Backup Health</h1>
          <p>Read-only dev backup and export readiness checks for manual testing.</p>
        </div>
        <div className="admin-inline-actions">
          <a className="admin-dashboard-link" href={`/admin${devAuthQuery}`}>
            Back to admin
          </a>
          <button type="button" onClick={() => void loadHealth()} disabled={loadState === "loading"}>
            Refresh
          </button>
        </div>
      </header>

      <section className="project-admin-panel">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Status</h2>
            <p>{message}</p>
          </div>
        </div>
        {health?.ok ? (
          <div className="admin-dashboard-status-grid">
            <article className={`admin-dashboard-status-card ${health.healthOk ? "ok" : "bad"}`}>
              <span>Overall</span>
              <strong>{health.healthOk ? "Ready" : "Problem"}</strong>
              <p>Checked {formatCheckedAt(health.checkedAt)}.</p>
            </article>
            <article className={`admin-dashboard-status-card ${health.databaseReachable ? "ok" : "bad"}`}>
              <span>Database</span>
              <strong>{health.databaseReachable ? "Reachable" : "Down"}</strong>
              <p>Database connectivity for backup/export checks.</p>
            </article>
            <article className={`admin-dashboard-status-card ${missingRequiredTables === 0 ? "ok" : "bad"}`}>
              <span>Required Tables</span>
              <strong>{requiredTables.length - missingRequiredTables}/{requiredTables.length}</strong>
              <p>{missingRequiredTables} missing required table(s).</p>
            </article>
            <article className={`admin-dashboard-status-card ${backupTool?.available ? "ok" : "warn"}`}>
              <span>Dump Tool</span>
              <strong>{backupTool?.available ? "Available" : "Missing"}</strong>
              <p>{backupTool?.command ?? "mysqldump or mariadb-dump was not found."}</p>
            </article>
          </div>
        ) : (
          <p>{loadState === "loading" ? "Checking backup health..." : message}</p>
        )}
      </section>

      {health?.ok ? (
        <div className="project-admin-grid">
          <section className="project-admin-preview">
            <h2>Required Tables</h2>
            <div className="admin-list">
              {requiredTables.map((table) => (
                <div className="admin-list-item" key={table.name}>
                  <div>
                    <strong>{table.name}</strong>
                    <span>{table.present ? "present" : "missing"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="project-admin-preview">
            <h2>Dump Tool</h2>
            <div className="admin-list">
              <div className="admin-list-item">
                <div>
                  <strong>{backupTool?.command ?? "mysqldump / mariadb-dump"}</strong>
                  <span>{backupTool?.available ? "available" : "missing"}</span>
                </div>
                {backupTool?.version ? <p>{backupTool.version}</p> : null}
              </div>
            </div>
          </section>
          <section className="project-admin-preview">
            <h2>Warnings</h2>
            {warnings.length > 0 ? (
              <ol className="project-admin-record-list">
                {warnings.map((warning) => (
                  <li key={warning}>
                    <div>
                      <p>{warning}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No backup health warnings.</p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
};

export default BackupHealthAdminClient;
