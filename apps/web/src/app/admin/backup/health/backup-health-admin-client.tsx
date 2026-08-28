"use client";

import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiRefreshCw,
  FiShield
} from "react-icons/fi";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../../dev-auth-token";
import {
  backupHealthUnavailableMessage,
  getBackupHealthExceptionFailure,
  parseBackupHealthResponse
} from "./backup-health-admin.rules";
import styles from "./backup-health-admin.module.css";

import type {
  BackupHealthLoadState,
  BackupHealthProjection
} from "./backup-health-admin.rules";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

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
  NonNullable<BackupHealthProjection["databaseFailureCategory"]>,
  string
> = {
  timeout: "Connection timed out",
  authentication: "Authentication failed",
  network: "Network connection failed",
  query: "Database query failed",
  unknown: "Unknown database failure"
};

const BackupHealthAdminClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<BackupHealthLoadState>("loading");
  const [message, setMessage] = useState("Loading backup health...");
  const [health, setHealth] = useState<BackupHealthProjection | null>(null);

  const loadHealth = async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading backup health...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/backup/health`, {
        credentials: "include",
        headers: createApiHeaders()
      });
      const payload = await response.json().catch(() => null) as unknown;
      const result = parseBackupHealthResponse(response.status, payload);

      if (result.kind === "failed") {
        setHealth(null);
        setLoadState(result.state);
        setMessage(result.message);
        return;
      }

      setHealth(result.health);
      setLoadState("ready");
      setMessage("Backup health check completed.");
    } catch (error) {
      const failure = getBackupHealthExceptionFailure(error);
      setHealth(null);
      setLoadState(failure.kind === "failed" ? failure.state : "failed");
      setMessage(failure.kind === "failed" ? failure.message : backupHealthUnavailableMessage);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadHealth();
  }, []);

  const healthSnapshot = health;
  const requiredTables = healthSnapshot?.requiredTables ?? [];
  const presentTableCount = requiredTables.filter((table) => table.present).length;
  const missingTableCount = requiredTables.length - presentTableCount;
  const sourceTableIssueCount = healthSnapshot?.skipped ? 0 : missingTableCount;
  const sourceReady = Boolean(
    healthSnapshot
    && !healthSnapshot.skipped
    && healthSnapshot.databaseReachable
    && requiredTables.length > 0
    && missingTableCount === 0
  );
  const backupTool = healthSnapshot?.backupTool ?? null;
  const restoreConfidence = "Not proven";
  const readinessTitle = healthSnapshot?.skipped
    ? "Check not configured"
    : sourceReady
      ? "Source tables present"
      : healthSnapshot?.databaseReachable
        ? "Source tables need attention"
        : "Source database unavailable";
  const readinessDetail = healthSnapshot?.skipped
    ? "This read-only check did not run against a configured source database."
    : sourceReady
      ? "Every monitored source table was found. Backup contents and restore remain unproven."
      : healthSnapshot?.databaseReachable
        ? "The check found one or more monitored source tables missing."
        : "The check could not reach the source database.";
  const readinessTone = healthSnapshot?.skipped || sourceReady ? styles.warning : styles.danger;
  return (
    <section className={`${styles.shell} project-admin-shell`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Backup</p>
          <h1>Backup Health</h1>
          <p>Read-only source-table and dump-tool check. Backup contents and restore are not tracked here.</p>
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
            <div className={`${styles.readinessLead} ${readinessTone}`}>
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
              <span>Monitored source tables</span>
              <strong>{requiredTables.length}</strong>
            </div>
            <div className={styles.readinessMetric}>
              <span>Backup contents</span>
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
            <section className={styles.panel} aria-labelledby="backup-tables-heading">
              <h2 id="backup-tables-heading">Monitored source tables</h2>
              <p className={styles.panelIntro}>
                This check confirms whether these source tables exist. It does not inspect backup contents.
              </p>
              <div className={styles.tableScroll}>
                <table className={styles.coverageTable}>
                  <thead>
                    <tr>
                      <th scope="col">Table</th>
                      <th scope="col">Source</th>
                      <th scope="col">Backup contents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredTables.map((table) => (
                      <tr key={table.name}>
                        <th scope="row">{table.name}</th>
                        <td className={healthSnapshot.skipped
                          ? styles.warningText
                          : table.present ? styles.okText : styles.dangerText}>
                          {table.present ? "Present" : healthSnapshot.skipped ? "Not checked" : "Missing"}
                        </td>
                        <td className={styles.warningText}>Not tracked</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className={healthSnapshot.skipped
                        ? styles.warningText
                        : sourceTableIssueCount === 0 ? styles.okText : styles.dangerText}>
                        {healthSnapshot.skipped
                          ? "Source table check not run"
                          : `${presentTableCount} / ${requiredTables.length} source tables present`}
                      </td>
                      <td className={styles.warningText}>Backup contents not tracked.</td>
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
                  <dd className={healthSnapshot.skipped
                    ? styles.warningText
                    : healthSnapshot.databaseReachable ? styles.okText : styles.dangerText}>
                    {healthSnapshot.skipped
                      ? "Check not configured"
                      : healthSnapshot.databaseReachable ? "Passed" : "Failed"}
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
                    {backupTool?.available
                      ? `Available · ${backupTool.command}${backupTool.version ? ` · version ${backupTool.version}` : ""}`
                      : "Missing"}
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
              </dl>

              <div className={styles.confidenceConclusion}>
                <FiAlertTriangle aria-hidden="true" />
                <div>
                  <h3>{restoreConfidence} confidence</h3>
                  <p>
                    This read-only check does not inspect backup contents or perform a restore.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {healthSnapshot.warnings.length > 0 ? (
            <section className={styles.panel} aria-labelledby="backup-warnings-heading">
              <div className={styles.confidenceConclusion}>
                <FiAlertTriangle aria-hidden="true" />
                <div>
                  <h2 id="backup-warnings-heading" className={styles.warning}>Warnings</h2>
                  {healthSnapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              </div>
            </section>
          ) : null}
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
