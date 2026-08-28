"use client";

import { useCallback, useEffect, useState } from "react";
import { FiLock, FiRefreshCw, FiShield } from "react-icons/fi";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { getDeviceSummary, getSessionCountLabel } from "./session-admin-data";
import SessionAdminRows from "./session-admin-rows";
import styles from "./session-admin.module.css";
import type { SessionAdminListResponse, SessionAdminRecord } from "./session-admin.types";

type SessionAdminResponse =
  | SessionAdminListResponse
  | { ok: false; reason: string };

type SessionAdminMutationResponse =
  | { ok: true; revokedCount?: number }
  | { ok: false; reason: string };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") return "Sign in before managing sessions.";
  if (response.status === 403 || reason === "session_admin_forbidden") {
    return "Your account does not have session management permission.";
  }
  if (response.status === 404 || reason === "session_admin_not_found") return "That session could not be found.";
  return `Session request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") return "signed-out";
  if (response.status === 403 || reason === "session_admin_forbidden" || reason === "session_admin_user_unlinked") {
    return "forbidden";
  }
  return "failed";
};

const SessionAdminClient = (): React.ReactNode => {
  const [sessions, setSessions] = useState<readonly SessionAdminRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading active sessions...");
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [shownCount, setShownCount] = useState(0);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadSessions = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading active sessions...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/sessions`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<SessionAdminResponse>(response);

      if (response.ok && payload?.ok) {
        setSessions(payload.sessions);
        setHasMoreSessions(payload.hasMore);
        setShownCount(payload.shownCount);
        setLoadState("ready");
        setMessage(payload.shownCount === 0 ? "No signed-in sessions found." : "Sessions loaded.");
        return;
      }

      setSessions([]);
      setHasMoreSessions(false);
      setShownCount(0);
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setSessions([]);
      setHasMoreSessions(false);
      setShownCount(0);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Session request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (session: SessionAdminRecord): Promise<void> => {
    const device = getDeviceSummary(session.userAgent);
    const confirmed = window.confirm(
      session.isCurrent
        ? "Revoke this current session? You will be signed out here and need to sign in again."
        : `Revoke this ${device.label} session? That session will be signed out immediately.`
    );

    if (!confirmed) return;

    setBusySessionId(session.id);
    setMessage("Revoking session...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/sessions/${session.id}/revoke`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<SessionAdminMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setExpandedSessionId(null);
        await loadSessions();
        setMessage("Session revoked.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Session revoke failed.");
    } finally {
      setBusySessionId(null);
    }
  };

  const revokeOtherSessions = async (): Promise<void> => {
    const confirmed = window.confirm("Revoke every other session and keep this browser signed in?");
    if (!confirmed) return;

    setBusySessionId("revoke-others");
    setMessage("Revoking other sessions...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/sessions/revoke-others`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<SessionAdminMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setExpandedSessionId(null);
        await loadSessions();
        setMessage(`Revoked ${payload.revokedCount ?? 0} other session${payload.revokedCount === 1 ? "" : "s"}.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk session revoke failed.");
    } finally {
      setBusySessionId(null);
    }
  };

  const orderedSessions = [...sessions].sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent));
  const hasCurrentSession = sessions.some((session) => session.isCurrent);
  const sessionCountLabel = getSessionCountLabel(shownCount, hasMoreSessions);

  return (
    <section className={`${styles.shell} project-admin-shell`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className="eyebrow">Private Admin</p>
          <h1>Sessions</h1>
          <p>Check where your account is signed in and revoke anything you don&apos;t recognize.</p>
        </div>
        <div className={styles.toolbar}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void loadSessions()}
            disabled={loadState === "loading" || busySessionId !== null}
          >
            <FiRefreshCw aria-hidden="true" />
            Refresh
          </button>
          <div className={styles.bulkAction}>
            <button
              className={styles.dangerOutlineButton}
              type="button"
              onClick={() => void revokeOtherSessions()}
              disabled={loadState !== "ready" || sessions.length <= 1 || !hasCurrentSession || busySessionId !== null}
            >
              <FiShield aria-hidden="true" />
              {busySessionId === "revoke-others" ? "Revoking..." : "Revoke all other sessions"}
            </button>
            <small>Keeps this session signed in</small>
          </div>
        </div>
      </header>

      <div className={styles.recoveryNote}>
        <FiShield aria-hidden="true" />
        <span>Security recovery</span>
        <span aria-hidden="true">·</span>
        <p>Compare the device, IP, and activity time before revoking access.</p>
      </div>

      <p
        className={`${styles.requestStatus} ${styles[`requestStatus${loadState}`]}`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true" />
        {message}
      </p>

      {loadState === "ready" ? (
        <section className={styles.sessionTable} aria-labelledby="signed-in-sessions-heading">
          <header className={styles.tableTitle}>
            <h2 id="signed-in-sessions-heading">Signed-in sessions</h2>
            <span>{sessionCountLabel}</span>
          </header>

          {orderedSessions.length === 0 ? (
            <div className={styles.emptyState}>
              <FiLock aria-hidden="true" />
              <p>No signed-in sessions were found.</p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Device</th>
                    <th scope="col">Location / IP</th>
                    <th scope="col">Last activity</th>
                    <th scope="col">Signed in</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSessions.map((session) => {
                    const device = getDeviceSummary(session.userAgent);
                    const isExpanded = expandedSessionId === session.id;

                    return (
                      <SessionAdminRows
                        key={session.id}
                        session={session}
                        device={device}
                        isExpanded={isExpanded}
                        isBusy={busySessionId === session.id}
                        onToggleDetails={() => setExpandedSessionId(isExpanded ? null : session.id)}
                        onRevoke={() => void revokeSession(session)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <footer className={styles.privacyNote}>
        <FiLock aria-hidden="true" />
        <p>Session tokens are never shown. Revoking access signs that session out immediately.</p>
      </footer>
    </section>
  );
};

export default SessionAdminClient;
