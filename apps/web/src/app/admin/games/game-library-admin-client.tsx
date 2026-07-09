"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGameSlugFromTitle,
  gameInterestStatuses,
  gameOwnershipStatuses,
  gameVisibilities,
  isValidGameLibraryAdminInput,
  normalizeGameSlug
} from "@maiks-yt/domain/games";
import type {
  GameInterestStatus,
  GameLibrarySource,
  GameOwnershipStatus,
  GameSuggestionSource,
  GameSuggestionStatus,
  GameVisibility
} from "@maiks-yt/domain/games";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type AdminGamesResponse =
  | {
    ok: true;
    games: readonly GameLibrarySource[];
    suggestions: readonly GameSuggestionSource[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminGameMutationResponse =
  | {
    ok: true;
    game: GameLibrarySource;
  }
  | {
    ok: false;
    reason: string;
  };

type AdminSuggestionMutationResponse =
  | {
    ok: true;
    suggestion: GameSuggestionSource;
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type GameFormState = {
  title: string;
  slug: string;
  platformLabel: string;
  storeProvider: string;
  storeUrl: string;
  ownershipStatus: GameOwnershipStatus;
  interestStatus: GameInterestStatus;
  streamFitNote: string;
  contentWarnings: string;
  categoryLabel: string;
  visibility: GameVisibility;
  sortOrder: number;
};

type SuggestionReviewState = {
  linkedGameId: string;
  reviewerNote: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const defaultGameForm: GameFormState = {
  title: "",
  slug: "",
  platformLabel: "",
  storeProvider: "",
  storeUrl: "",
  ownershipStatus: "unknown",
  interestStatus: "interested",
  streamFitNote: "",
  contentWarnings: "",
  categoryLabel: "",
  visibility: "private",
  sortOrder: 0
};

const defaultSuggestionReviewState: SuggestionReviewState = {
  linkedGameId: "",
  reviewerNote: ""
};

const toGameForm = (game: GameLibrarySource): GameFormState => ({
  title: game.title,
  slug: game.slug,
  platformLabel: game.platformLabel ?? "",
  storeProvider: game.storeProvider ?? "",
  storeUrl: game.storeUrl ?? "",
  ownershipStatus: game.ownershipStatus,
  interestStatus: game.interestStatus,
  streamFitNote: game.streamFitNote ?? "",
  contentWarnings: game.contentWarnings ?? "",
  categoryLabel: game.categoryLabel ?? "",
  visibility: game.visibility,
  sortOrder: game.sortOrder
});

const toPayload = (form: GameFormState): Record<string, unknown> => ({
  title: form.title.trim(),
  slug: form.slug.trim() || null,
  platformLabel: form.platformLabel.trim() || null,
  storeProvider: form.storeProvider.trim() || null,
  storeUrl: form.storeUrl.trim() || null,
  ownershipStatus: form.ownershipStatus,
  interestStatus: form.interestStatus,
  streamFitNote: form.streamFitNote.trim() || null,
  contentWarnings: form.contentWarnings.trim() || null,
  categoryLabel: form.categoryLabel.trim() || null,
  visibility: form.visibility,
  sortOrder: form.sortOrder
});

const getLocalFormIssue = (form: GameFormState): string | null => {
  const title = form.title.trim();
  const slug = form.slug.trim() || createGameSlugFromTitle(title);

  if (title.length === 0) {
    return "Add a game title before saving.";
  }

  if (!normalizeGameSlug(slug).ok) {
    return "Use a simple game slug with lowercase letters, numbers, and hyphens.";
  }

  if (!isValidGameLibraryAdminInput({
    title,
    slug,
    platformLabel: form.platformLabel,
    storeProvider: form.storeProvider,
    storeUrl: form.storeUrl,
    ownershipStatus: form.ownershipStatus,
    interestStatus: form.interestStatus,
    streamFitNote: form.streamFitNote,
    contentWarnings: form.contentWarnings,
    categoryLabel: form.categoryLabel,
    visibility: form.visibility,
    sortOrder: form.sortOrder
  })) {
    return "Check the game details. URLs must start with http or https, and text fields must stay within limits.";
  }

  return null;
};

const sortGames = (games: readonly GameLibrarySource[]): readonly GameLibrarySource[] =>
  games
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing games.";
  }

  if (response.status === 403 || reason === "game_library_admin_forbidden") {
    return "Your account does not have game-library permission.";
  }

  if (reason === "game_library_slug_conflict") {
    return "That game slug is already used.";
  }

  if (reason === "game_library_invalid_input") {
    return "The game request has invalid or missing fields.";
  }

  if (reason === "game_library_not_found") {
    return "That game could not be found.";
  }

  return `Game Library request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "game_library_admin_forbidden" || reason === "game_library_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const GameLibraryAdminClient = (): React.ReactNode => {
  const [games, setGames] = useState<readonly GameLibrarySource[]>([]);
  const [suggestions, setSuggestions] = useState<readonly GameSuggestionSource[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [gameForm, setGameForm] = useState<GameFormState>(defaultGameForm);
  const [suggestionReview, setSuggestionReview] = useState<SuggestionReviewState>(defaultSuggestionReviewState);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading Game Library...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedId) ?? null,
    [games, selectedId]
  );

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const replaceGame = useCallback((game: GameLibrarySource): void => {
    setGames((current) => {
      const exists = current.some((candidate) => candidate.id === game.id);
      const next = exists
        ? current.map((candidate) => candidate.id === game.id ? game : candidate)
        : [game, ...current];

      return sortGames(next);
    });
    setSelectedId(game.id);
    setGameForm(toGameForm(game));
  }, []);

  const loadGames = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading Game Library...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/games`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminGamesResponse>(response);

      if (response.ok && payload?.ok) {
        const orderedGames = sortGames(payload.games);
        const firstGame = orderedGames[0] ?? null;

        setGames(orderedGames);
        setSuggestions(payload.suggestions);
        setSelectedId(firstGame?.id ?? "");
        setGameForm(firstGame ? toGameForm(firstGame) : defaultGameForm);
        setLoadState("ready");
        setMessage(orderedGames.length === 0 ? "No games exist yet." : "Game Library loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Game Library request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadGames();
  }, [loadGames]);

  const runGameMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body: Record<string, unknown>;
    }
  ): Promise<void> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(options.body)
      });
      const payload = await parseJson<AdminGameMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceGame(payload.game);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusyAction(null);
    }
  };

  const reviewSuggestion = async (
    suggestionId: string,
    status: Exclude<GameSuggestionStatus, "pending">
  ): Promise<void> => {
    setBusyAction(`Reviewing ${suggestionId}`);
    setMessage("Reviewing game suggestion...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/games/suggestions/${encodeURIComponent(suggestionId)}`, {
        method: "PATCH",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          status,
          linkedGameId: suggestionReview.linkedGameId || null,
          reviewerNote: suggestionReview.reviewerNote.trim() || null
        })
      });
      const payload = await parseJson<AdminSuggestionMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setSuggestions((current) => current.map((suggestion) => (
          suggestion.id === payload.suggestion.id ? payload.suggestion : suggestion
        )));
        setSuggestionReview(defaultSuggestionReviewState);
        setMessage("Game suggestion reviewed.");
        return;
      }

      setMessage(payload?.ok === false && payload.reason === "game_suggestion_invalid_input"
        ? "Check the suggestion review fields."
        : `Game suggestion review failed with ${response.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Game suggestion review failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const selectGame = (id: string): void => {
    const game = games.find((candidate) => candidate.id === id);

    setSelectedId(id);
    if (game) {
      setGameForm(toGameForm(game));
    }
  };

  const startNewGame = (): void => {
    setSelectedId("");
    setGameForm(defaultGameForm);
  };

  const saveGame = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const issue = getLocalFormIssue(gameForm);

    if (issue) {
      setMessage(issue);
      return;
    }

    const payload = toPayload(gameForm);

    if (selectedGame) {
      await runGameMutation("Saving game", `/admin/games/${encodeURIComponent(selectedGame.id)}`, {
        method: "PATCH",
        body: payload
      });
      return;
    }

    await runGameMutation("Creating game", "/admin/games", {
      method: "POST",
      body: payload
    });
  };

  const visibleGames = sortGames(games);
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending");

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Game Library</h1>
        <p aria-live="polite">{message}</p>
      </header>

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadGames()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Game records">
            <div className="project-admin-sidebar-heading">
              <h2>Games</h2>
              <button type="button" className="secondary-action" onClick={startNewGame}>
                New
              </button>
            </div>
            {visibleGames.length === 0 ? (
              <p>No game records yet.</p>
            ) : (
              <div className="project-admin-selector">
                {visibleGames.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    className={game.id === selectedId ? "selected" : ""}
                    onClick={() => selectGame(game.id)}
                  >
                    <strong>{game.title}</strong>
                    <span>{game.interestStatus} / {game.ownershipStatus} / {game.visibility}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Game editor">
            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <h2>Suggestions</h2>
                <span>{pendingSuggestions.length} pending</span>
              </div>
              {pendingSuggestions.length === 0 ? (
                <p>No pending game suggestions.</p>
              ) : (
                <div className="project-admin-selector">
                  {pendingSuggestions.map((suggestion) => (
                    <article className="project-admin-state" key={suggestion.id}>
                      <h3>{suggestion.title}</h3>
                      <p>
                        {[suggestion.platformLabel, suggestion.suggestedByName].filter(Boolean).join(" / ") || "Viewer suggestion"}
                      </p>
                      {suggestion.reason ? <p>{suggestion.reason}</p> : null}
                      {suggestion.storeUrl ? (
                        <a href={suggestion.storeUrl} rel="noreferrer" target="_blank">
                          Store Page
                        </a>
                      ) : null}
                      {suggestion.tags.length > 0 ? <p>{suggestion.tags.join(", ")}</p> : null}
                      <div className="project-admin-form-grid">
                        <label>
                          Link Existing Game
                          <select value={suggestionReview.linkedGameId} onChange={(event) => setSuggestionReview((current) => ({ ...current, linkedGameId: event.target.value }))}>
                            <option value="">No linked game</option>
                            {visibleGames.map((game) => (
                              <option key={game.id} value={game.id}>{game.title}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Review Note
                          <input value={suggestionReview.reviewerNote} onChange={(event) => setSuggestionReview((current) => ({ ...current, reviewerNote: event.target.value }))} maxLength={1000} />
                        </label>
                      </div>
                      <div className="project-admin-actions">
                        <button type="button" onClick={() => void reviewSuggestion(suggestion.id, "accepted")} disabled={busyAction !== null}>
                          Accept
                        </button>
                        <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(suggestion.id, "maybe-later")} disabled={busyAction !== null}>
                          Maybe Later
                        </button>
                        <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(suggestion.id, "rejected")} disabled={busyAction !== null}>
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <form className="project-admin-panel project-admin-form" onSubmit={(event) => void saveGame(event)}>
              <div className="project-admin-panel-heading">
                <h2>{selectedGame ? "Game Details" : "Create Game"}</h2>
                <button type="submit" disabled={busyAction !== null}>
                  {busyAction ? "Saving..." : selectedGame ? "Save Game" : "Create Game"}
                </button>
              </div>

              <div className="project-admin-form-grid">
                <label>
                  Title
                  <input value={gameForm.title} onChange={(event) => setGameForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
                </label>
                <label>
                  Slug
                  <input value={gameForm.slug} onChange={(event) => setGameForm((current) => ({ ...current, slug: event.target.value }))} maxLength={191} placeholder="derived from title" />
                </label>
              </div>

              <div className="project-admin-form-grid">
                <label>
                  Ownership
                  <select value={gameForm.ownershipStatus} onChange={(event) => setGameForm((current) => ({ ...current, ownershipStatus: event.target.value as GameOwnershipStatus }))}>
                    {gameOwnershipStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Interest
                  <select value={gameForm.interestStatus} onChange={(event) => setGameForm((current) => ({ ...current, interestStatus: event.target.value as GameInterestStatus }))}>
                    {gameInterestStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Visibility
                  <select value={gameForm.visibility} onChange={(event) => setGameForm((current) => ({ ...current, visibility: event.target.value as GameVisibility }))}>
                    {gameVisibilities.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
                  </select>
                </label>
              </div>

              <div className="project-admin-form-grid">
                <label>
                  Platform
                  <input value={gameForm.platformLabel} onChange={(event) => setGameForm((current) => ({ ...current, platformLabel: event.target.value }))} maxLength={120} />
                </label>
                <label>
                  Store Provider
                  <input value={gameForm.storeProvider} onChange={(event) => setGameForm((current) => ({ ...current, storeProvider: event.target.value }))} maxLength={80} />
                </label>
                <label>
                  Sort
                  <input type="number" value={gameForm.sortOrder} onChange={(event) => setGameForm((current) => ({ ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} min={-10000} max={10000} />
                </label>
              </div>

              <label>
                Store URL
                <input value={gameForm.storeUrl} onChange={(event) => setGameForm((current) => ({ ...current, storeUrl: event.target.value }))} maxLength={1024} />
              </label>

              <label>
                Stream Fit Notes
                <textarea value={gameForm.streamFitNote} onChange={(event) => setGameForm((current) => ({ ...current, streamFitNote: event.target.value }))} maxLength={500} rows={4} />
              </label>

              <label>
                Content Warnings
                <textarea value={gameForm.contentWarnings} onChange={(event) => setGameForm((current) => ({ ...current, contentWarnings: event.target.value }))} maxLength={2000} rows={4} />
              </label>

              <label>
                Category / Theme
                <input value={gameForm.categoryLabel} onChange={(event) => setGameForm((current) => ({ ...current, categoryLabel: event.target.value }))} maxLength={120} />
              </label>
            </form>

            <section className="project-admin-panel project-admin-note">
              <h2>Later</h2>
              <p>Gifted-game handling, provider/store sync, auto category updates, money behavior, and external wishlist automation stay outside this first runtime slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default GameLibraryAdminClient;
