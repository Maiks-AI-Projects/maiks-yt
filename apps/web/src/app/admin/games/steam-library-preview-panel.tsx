"use client";

import { useCallback, useEffect, useState } from "react";

import { createApiHeaders } from "../../dev-auth-token";
import SteamWishlistPreviewPanel from "./steam-wishlist-preview-panel";

type SteamConnectionState = "configured" | "missing" | "invalid";

type SteamConnectionStatusResponse =
  | {
    ok: true;
    provider: "steam";
    state: SteamConnectionState;
    configured: boolean;
    readOnly: true;
    detail: string;
  }
  | {
    ok: false;
    reason: string;
  };

type SteamPreviewGame = {
  appId: number;
  title: string;
  iconUrl: string | null;
  playtimeMinutes: number;
  recentPlaytimeMinutes: number | null;
};

type SteamPreviewFailureState =
  | "missing_config"
  | "invalid_config"
  | "private_library"
  | "invalid_credentials"
  | "rate_limited"
  | "malformed_response"
  | "network_failure"
  | "provider_unavailable";

type SteamPreviewResponse =
  | {
    ok: true;
    provider: "steam";
    state: "ready";
    readOnly: true;
    gameCount: number;
    games: readonly SteamPreviewGame[];
  }
  | {
    ok: false;
    provider: "steam";
    state: SteamPreviewFailureState;
    readOnly: true;
    message: string;
  }
  | {
    ok: false;
    reason: string;
  };

type PanelState = "loading" | "ready" | "previewing" | "failed";

const previewFailureMessages: Record<SteamPreviewFailureState, string> = {
  missing_config: "Steam discovery is not configured on the server.",
  invalid_config: "Steam discovery configuration needs review.",
  private_library: "Steam did not expose this account's game details. Check the Steam game-details privacy setting.",
  invalid_credentials: "Steam rejected the configured credentials.",
  rate_limited: "Steam rate-limited this preview. Try again later.",
  malformed_response: "Steam returned an unexpected response.",
  network_failure: "Steam could not be reached for this preview.",
  provider_unavailable: "Steam discovery is temporarily unavailable."
};

const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};

const formatPlaytime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

const SteamLibraryPreviewPanel = ({ apiBaseUrl }: { apiBaseUrl: string }): React.ReactNode => {
  const [connection, setConnection] = useState<Extract<SteamConnectionStatusResponse, { ok: true }> | null>(null);
  const [preview, setPreview] = useState<Extract<SteamPreviewResponse, { ok: true }> | null>(null);
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [message, setMessage] = useState("Checking Steam discovery status...");

  const loadConnectionStatus = useCallback(async (): Promise<void> => {
    setPanelState("loading");
    setMessage("Checking Steam discovery status...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/games/steam/status`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<SteamConnectionStatusResponse>(response);

      if (response.ok && payload?.ok) {
        setConnection(payload);
        setPanelState("ready");
        setMessage(payload.detail);
        return;
      }

      setConnection(null);
      setPanelState("failed");
      setMessage(response.status === 401
        ? "Sign in before checking Steam discovery."
        : response.status === 403
          ? "Your account does not have game-library permission."
          : "Steam discovery status is unavailable.");
    } catch {
      setConnection(null);
      setPanelState("failed");
      setMessage("Steam discovery status is unavailable.");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadConnectionStatus();
  }, [loadConnectionStatus]);

  const loadPreview = async (): Promise<void> => {
    setPanelState("previewing");
    setPreview(null);
    setMessage("Loading a fresh read-only Steam preview...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/games/steam/preview`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<SteamPreviewResponse>(response);

      if (response.ok && payload?.ok) {
        setPreview(payload);
        setPanelState("ready");
        setMessage(`Previewed ${payload.gameCount} Steam games and refreshed their catalog metadata. Nothing was added to your personal library or published.`);
        return;
      }

      setPreview(null);
      setPanelState("failed");
      setMessage(payload?.ok === false && "state" in payload
        ? previewFailureMessages[payload.state]
        : response.status === 401
          ? "Sign in before previewing Steam games."
          : response.status === 403
            ? "Your account does not have game-library permission."
            : "Steam discovery preview is unavailable.");
    } catch {
      setPreview(null);
      setPanelState("failed");
      setMessage("Steam discovery preview is unavailable.");
    }
  };

  return (
    <section className="project-admin-panel steam-library-preview-panel" aria-labelledby="steam-library-preview-heading">
      <div className="project-admin-panel-heading">
        <div>
          <h2 id="steam-library-preview-heading">Steam Discovery Preview</h2>
          <p>Owner-only, read-only library discovery from the configured Steam account.</p>
        </div>
        <span className={`admin-dashboard-link-badge ${connection?.configured ? "ok" : "warn"}`}>
          {connection?.state ?? (panelState === "loading" ? "checking" : "unavailable")}
        </span>
      </div>

      <p className="game-library-warning">
        <strong>Provider read-only.</strong> Sanitized metadata is cached locally for resilient search, but games are not added to your personal library or made public.
      </p>
      <div className="project-admin-actions">
        <p aria-live="polite">{message}</p>
        <div className="admin-inline-actions">
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={!connection?.configured || panelState === "previewing"}
          >
            {panelState === "previewing" ? "Previewing..." : preview ? "Refresh Preview" : "Preview Steam Library"}
          </button>
          {panelState === "failed" ? (
            <button type="button" className="secondary-action" onClick={() => void loadConnectionStatus()}>
              Recheck Status
            </button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="steam-library-preview-list" aria-label="Steam library import preview">
          {preview.games.length === 0 ? (
            <p>No visible Steam games were returned.</p>
          ) : preview.games.map((game) => (
            <article className="steam-library-preview-game" key={game.appId}>
              {game.iconUrl ? <img src={game.iconUrl} alt="" width={32} height={32} loading="lazy" /> : <span className="steam-library-preview-icon" aria-hidden="true">S</span>}
              <div>
                <strong>{game.title}</strong>
                <span>AppID {game.appId}</span>
              </div>
              <div className="steam-library-preview-playtime">
                <span>{formatPlaytime(game.playtimeMinutes)} total</span>
                {game.recentPlaytimeMinutes !== null ? <span>{formatPlaytime(game.recentPlaytimeMinutes)} recent</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <SteamWishlistPreviewPanel
        apiBaseUrl={apiBaseUrl}
        configured={connection?.configured === true}
      />
    </section>
  );
};

export default SteamLibraryPreviewPanel;
