"use client";

import { useState } from "react";

import { createApiHeaders } from "../../dev-auth-token";

type SteamWishlistItem = {
  appId: number;
  title: string | null;
  priority: number;
  dateAddedAt: string;
  storeUrl: string;
};

type SteamWishlistResponse =
  | {
    ok: true;
    provider: "steam";
    state: "ready";
    readOnly: true;
    itemCount: number;
    items: readonly SteamWishlistItem[];
  }
  | {
    ok: false;
    state?: string;
    message?: string;
    reason?: string;
  };

const parseJson = async (response: Response): Promise<SteamWishlistResponse | null> => {
  try {
    return await response.json() as SteamWishlistResponse;
  } catch {
    return null;
  }
};

const formatDateAdded = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : `Added ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date)}`;
};

const SteamWishlistPreviewPanel = ({
  apiBaseUrl,
  configured
}: {
  apiBaseUrl: string;
  configured: boolean;
}): React.ReactNode => {
  const [wishlist, setWishlist] = useState<Extract<SteamWishlistResponse, { ok: true }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Load the current Steam wishlist when you need it.");

  const loadWishlist = async (): Promise<void> => {
    setLoading(true);
    setMessage("Loading the read-only Steam wishlist...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/games/steam/wishlist`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson(response);

      if (response.ok && payload?.ok) {
        setWishlist(payload);
        setMessage(`Found ${payload.itemCount} item${payload.itemCount === 1 ? "" : "s"} on the Steam wishlist.`);
        return;
      }

      setWishlist(null);
      setMessage(response.status === 401
        ? "Sign in before loading the Steam wishlist."
        : response.status === 403
          ? "Your account does not have game-library permission."
          : payload?.ok === false && payload.message
            ? payload.message
            : "Steam wishlist preview is unavailable.");
    } catch {
      setWishlist(null);
      setMessage("Steam wishlist preview is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="steam-wishlist-preview" aria-labelledby="steam-wishlist-preview-heading">
      <div className="project-admin-panel-heading">
        <div>
          <h3 id="steam-wishlist-preview-heading">Steam Wishlist</h3>
          <p>Read-only. Add or remove games in Steam, then refresh this list.</p>
        </div>
        <button type="button" onClick={() => void loadWishlist()} disabled={!configured || loading}>
          {loading ? "Loading..." : wishlist ? "Refresh Wishlist" : "Load Wishlist"}
        </button>
      </div>

      <p aria-live="polite">{message}</p>

      {wishlist ? (
        <div className="steam-library-preview-list" aria-label="Current Steam wishlist">
          {wishlist.items.length === 0 ? (
            <p>No games are currently on the Steam wishlist.</p>
          ) : wishlist.items.map((item) => (
            <article className="steam-library-preview-game steam-wishlist-preview-item" key={item.appId}>
              <span className="steam-library-preview-icon" aria-hidden="true">S</span>
              <div>
                <strong>{item.title ?? `Steam App ${item.appId}`}</strong>
                <span>AppID {item.appId} · {formatDateAdded(item.dateAddedAt)}</span>
              </div>
              <a className="secondary-action steam-store-link" href={item.storeUrl} target="_blank" rel="noreferrer">
                Open in Steam
              </a>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SteamWishlistPreviewPanel;
