"use client";

import { useEffect, useId, useRef, useState } from "react";

import { createApiHeaders } from "../../dev-auth-token";

export type GameCatalogComboboxResult = {
  catalogGameId: string;
  title: string;
  matchState: "discovered" | "owner-confirmed";
  provider: "steam" | "twitch" | "igdb" | "other";
  providerGameId: string;
  storeUrl: string | null;
  artworkUrl: string | null;
  lastRefreshedAt: string;
  stale: boolean;
};

type GameCatalogSearchResponse =
  | {
    ok: true;
    providerState: "ready" | "rate_limited" | "malformed_response" | "network_failure" | "provider_unavailable";
    cacheOnly: boolean;
    results: readonly GameCatalogComboboxResult[];
  }
  | {
    ok: false;
    reason: string;
  };

const parseJson = async (response: Response): Promise<GameCatalogSearchResponse | null> => {
  try {
    return await response.json() as GameCatalogSearchResponse;
  } catch {
    return null;
  }
};

const GameCatalogCombobox = ({
  apiBaseUrl,
  value,
  selectedCatalogGameId,
  onValueChange,
  onSelect
}: {
  apiBaseUrl: string;
  value: string;
  selectedCatalogGameId: string;
  onValueChange: (value: string) => void;
  onSelect: (result: GameCatalogComboboxResult) => void;
}): React.ReactNode => {
  const listboxId = useId();
  const requestSequence = useRef(0);
  const [results, setResults] = useState<readonly GameCatalogComboboxResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const query = value.trim();

    if (query.length < 2 || selectedCatalogGameId) {
      setResults([]);
      setOpen(false);
      setStatus("");
      return;
    }

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setStatus("Searching games...");

      try {
        const response = await fetch(
          `${apiBaseUrl}/admin/games/catalog/search?q=${encodeURIComponent(query)}`,
          {
            headers: createApiHeaders(),
            credentials: "include",
            signal: controller.signal
          }
        );
        const payload = await parseJson(response);

        if (requestSequence.current !== sequence) {
          return;
        }

        if (response.ok && payload?.ok) {
          setResults(payload.results);
          setActiveIndex(payload.results.length > 0 ? 0 : -1);
          setOpen(true);
          setStatus(payload.cacheOnly
            ? payload.results.length > 0
              ? "Steam is unavailable. Showing cached matches."
              : "Steam is unavailable and no cached matches were found."
            : payload.results.length > 0
              ? `${payload.results.length} game matches.`
              : "No game matches found. You can keep the typed title.");
          return;
        }

        setResults([]);
        setOpen(false);
        setStatus(response.status === 401
          ? "Sign in to search the game catalog."
          : "Game search is unavailable. You can keep the typed title.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResults([]);
        setOpen(false);
        setStatus("Game search is unavailable. You can keep the typed title.");
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [apiBaseUrl, selectedCatalogGameId, value]);

  const selectResult = (result: GameCatalogComboboxResult): void => {
    onSelect(result);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setStatus(`${result.title} selected from the ${result.provider} catalog.`);
  };

  return (
    <div className="game-catalog-combobox">
      <input
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        required
        maxLength={191}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setOpen(results.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          } else if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open && activeIndex >= 0) {
            const result = results[activeIndex];
            if (result) {
              event.preventDefault();
              selectResult(result);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open ? (
        <div className="game-catalog-combobox-list" id={listboxId} role="listbox">
          {results.map((result, index) => (
            <button
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={`${result.provider}:${result.providerGameId}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectResult(result)}
            >
              <span className="game-catalog-combobox-placeholder" aria-hidden="true">
                G
                {result.artworkUrl ? (
                  <img
                    src={result.artworkUrl}
                    alt=""
                    width={46}
                    height={24}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.hidden = true; }}
                  />
                ) : null}
              </span>
              <span>
                <strong>{result.title}</strong>
                <small>{result.provider} · {result.stale ? "cached" : "current"}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <small className="game-catalog-combobox-status" aria-live="polite">
        {selectedCatalogGameId ? "Catalog game selected. Edit the title to search again." : status}
      </small>
    </div>
  );
};

export default GameCatalogCombobox;
