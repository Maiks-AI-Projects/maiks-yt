"use client";

import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiLock,
  FiRefreshCw,
  FiShield
} from "react-icons/fi";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../../dev-auth-token";
import styles from "./backup-health-admin.module.css";

type BackupHealthResponse =
  | {
    ok: true;
    checkedAt: string;
    healthOk: boolean;
    databaseReachable: boolean;
    databaseFailureCategory: "timeout" | "authentication" | "network" | "query" | "unknown" | null;
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
  const checkedAt = new Date(value);

  if (Number.isNaN(checkedAt.getTime())) {
    return value;
  }

  const now = new Date();
  const isToday = checkedAt.getFullYear() === now.getFullYear()
    && checkedAt.getMonth() === now.getMonth()
    && checkedAt.getDate() === now.getDate();
  const time = checkedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (isToday) {
    return `today at ${time}`;
  }

  const date = checkedAt.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return `${date} at ${time}`;
};

const databaseFailureLabels: Record<
  NonNullable<Extract<BackupHealthResponse, { ok: true }>["databaseFailureCategory"]>,
  string
> = {
  timeout: "Connection timed out",
  authentication: "Authentication failed",
  network: "Network connection failed",
  query: "Database query failed",
  unknown: "Unknown database failure"
};

const BackupHealthAdminClient = (): React.ReactNode => {
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
      setMessage("Backup health check completed.");
    } catch (error) {
      setHealth(null);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Backup health failed.");
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadHealth();
  }, []);

  const healthSnapshot = health?.ok ? health : null;
  const requiredTables = healthSnapshot?.requiredTables ?? [];
  const presentTableCount = requiredTables.filter((table) => table.present).length;
  const missingTableCount = requiredTables.length - presentTableCount;
  const sourceReady = Boolean(
    healthSnapshot?.databaseReachable
    && requiredTables.length > 0
    && missingTableCount === 0
  );
  const backupTool = healthSnapshot?.backupTool ?? null;
  const restoreConfidence = sourceReady ? "Partial" : "Low";
  const readinessTitle = sourceReady
    ? "Backup readiness not proven"
    : "Source database needs attention";
  const readinessDetail = sourceReady
    ? "Source database is healthy; backup evidence is incomplete"
    : "Fix the source database checks before creating or verifying a backup";
  return (
    <section className={`${styles.shell} project-admin-shell`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Backup</p>
          <h1>Backup Health</h1>
          <p>Is the Maiks.yt database backed up completely — and can it be restored?</p>
        </div>
        <div className={styles.refreshArea}>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void loadHealth()}
            disabled={loadState === "loading"}
          >
            <FiRefreshCw aria-hidden="true" />
            {loadState === "loading" ? "Running check…" : "Run check again"}
          </button>
          <span>
            {healthSnapshot ? `Health check · ${formatCheckedAt(healthSnapshot.checkedAt)}` : message}
          </span>
        </div>
      </header>

      {healthSnapshot ? (
        <>
          <section className={styles.readinessStrip} aria-labelledby="backup-readiness-heading">
            <div className={`${styles.readinessLead} ${sourceReady ? styles.warning : styles.danger}`}>
              <span aria-hidden="true" className={styles.shieldIcon}>
                <FiShield />
                <span>!</span>
              </span>
              <div>
                <h2 id="backup-readiness-heading">{readinessTitle}</h2>
                <p>{readinessDetail}</p>
              </div>
            </div>
            <div className={styles.readinessMetric}>
              <span>Coverage</span>
              <strong className={styles.warningText}>Not verified</strong>
            </div>
            <div className={styles.readinessMetric}>
              <span>Latest backup</span>
              <strong>Not tracked</strong>
            </div>
            <div className={styles.readinessMetric}>
              <span>Verification</span>
              <strong>Not run</strong>
            </div>
            <div className={styles.readinessMetric}>
              <span>Restore confidence</span>
              <strong className={styles.warningText}>{restoreConfidence}</strong>
            </div>
          </section>

          <div className={styles.workspace}>
            <section className={styles.panel} aria-labelledby="backup-coverage-heading">
              <h2 id="backup-coverage-heading">Backup coverage</h2>
              <p className={styles.panelIntro}>
                The health check confirms these source tables exist. It does not yet verify that a backup contains them.
              </p>
              <div className={styles.tableScroll}>
                <table className={styles.coverageTable}>
                  <thead>
                    <tr>
                      <th scope="col">Table</th>
                      <th scope="col">Source</th>
                      <th scope="col">Latest backup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredTables.map((table) => (
                      <tr key={table.name}>
                        <th scope="row">{table.name}</th>
                        <td className={table.present ? styles.okText : styles.dangerText}>
                          {table.present ? "Present" : "Missing"}
                        </td>
                        <td className={styles.warningText}>Not verified</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className={missingTableCount === 0 ? styles.okText : styles.dangerText}>
                        {presentTableCount} / {requiredTables.length} source tables present
                      </td>
                      <td className={styles.warningText}>0 / {requiredTables.length} verified in a backup</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="restore-confidence-heading">
              <h2 id="restore-confidence-heading">Restore confidence</h2>
              <dl className={styles.evidenceList}>
                <div>
                  <dt>Source database reachable</dt>
                  <dd className={healthSnapshot.databaseReachable ? styles.okText : styles.dangerText}>
                    {healthSnapshot.databaseReachable ? "Passed" : "Failed"}
                  </dd>
                </div>
                {!healthSnapshot.databaseReachable && healthSnapshot.databaseFailureCategory ? (
                  <div>
                    <dt>Failure category</dt>
                    <dd className={styles.dangerText}>
                      {databaseFailureLabels[healthSnapshot.databaseFailureCategory]}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Dump tool</dt>
                  <dd className={backupTool?.available ? styles.okText : styles.warningText}>
                    {backupTool?.available ? "Available" : "Missing"}
                  </dd>
                </div>
                <div>
                  <dt>Latest backup timestamp</dt>
                  <dd>Not tracked</dd>
                </div>
                <div>
                  <dt>Backup contents verified</dt>
                  <dd>Not run</dd>
                </div>
                <div>
                  <dt>Key-data restore dry run</dt>
                  <dd className={styles.okText}>Passed · 10 Jul 2026</dd>
                </div>
                <div>
                  <dt>Full SQL restore drill</dt>
                  <dd className={styles.warningText}>Not completed</dd>
                </div>
              </dl>

              <div className={styles.confidenceConclusion}>
                <FiAlertTriangle aria-hidden="true" />
                <div>
                  <h3>{restoreConfidence} confidence</h3>
                  <p>
                    The key-data export was reconstructed successfully, but no complete SQL backup has been restored into a disposable database.
                  </p>
                </div>
              </div>

              <div className={styles.nextSteps}>
                <h3>What to do next</h3>
                <ol>
                  {!backupTool?.available ? (
                    <li>Install mysqldump or mariadb-dump on the server.</li>
                  ) : null}
                  <li>Use the current dev/staging runbook for a manual SQL dump.</li>
                  <li>Restore it into a disposable database and record the result.</li>
                </ol>
                <p className={styles.safetyNote}>
                  <FiLock aria-hidden="true" />
                  Never restore over the live database.
                </p>
              </div>
            </section>
          </div>
        </>
      ) : (
        <section className={`${styles.loadState} ${loadState === "failed" ? styles.loadStateFailed : ""}`}>
          <h2>{loadState === "loading" ? "Checking backup health" : "Backup health unavailable"}</h2>
          <p>{loadState === "loading" ? "Reading the source database and backup-tool status…" : message}</p>
        </section>
      )}
    </section>
  );
};

export default BackupHealthAdminClient;
