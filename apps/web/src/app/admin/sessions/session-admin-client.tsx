"use client";

import { useCallback, useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type SessionAdminRecord = {
  id: string;
  authUserId: string;
  userName: string;
  userEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isExpired: boolean;
};

type SessionAdminResponse =
  | {
    ok: true;
    sessions: readonly SessionAdminRecord[];
  }
  | {
    ok: false;
    reason: string;
  };

type SessionAdminMutationResponse =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing sessions.";
  }

  if (response.status === 403 || reason === "session_admin_forbidden") {
    return "Your account does not have session management permission.";
  }

  if (response.status === 404 || reason === "session_admin_not_found") {
    return "That session could not be found.";
  }

  return `Session request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

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
        setLoadState("ready");
        setMessage(payload.sessions.length === 0 ? "No active browser sessions found." : "Sessions loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Session request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (session: SessionAdminRecord): Promise<void> => {
    const confirmed = window.confirm(
      session.isCurrent
        ? "Revoke your current browser session? You may need to sign in again."
        : `Revoke the session for ${session.userEmail}?`
    );

    if (!confirmed) {
      return;
    }

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

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Sessions</h1>
          <p>Review active browser sessions and revoke anything suspicious.</p>
        </div>
        <div className="admin-inline-actions">
          <button type="button" onClick={() => void loadSessions()} disabled={loadState === "loading"}>
            Refresh
          </button>
        </div>
      </header>

      <p className={`admin-status admin-status-${loadState}`}>{message}</p>

      {loadState === "ready" ? (
        <div className="admin-list">
          {sessions.length === 0 ? (
            <p>No sessions found.</p>
          ) : sessions.map((session) => (
            <article className="admin-list-item" key={session.id}>
              <div>
                <strong>{session.userName || session.userEmail}</strong>
                <span>
                  {session.userEmail}
                  {session.isCurrent ? " · current" : ""}
                  {session.isExpired ? " · expired" : ""}
                </span>
              </div>
              <p>
                Updated {formatDate(session.updatedAt)} · Expires {formatDate(session.expiresAt)}
              </p>
              <p>
                IP: {session.ipAddress ?? "unknown"}
              </p>
              <p title={session.userAgent ?? undefined}>
                User agent: {session.userAgent ?? "unknown"}
              </p>
              <div className="admin-inline-actions">
                <button
                  type="button"
                  onClick={() => void revokeSession(session)}
                  disabled={busySessionId === session.id}
                >
                  {busySessionId === session.id ? "Revoking..." : "Revoke"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default SessionAdminClient;
