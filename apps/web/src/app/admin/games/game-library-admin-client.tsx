"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiSearch
} from "react-icons/fi";
import { FaSteam } from "react-icons/fa";
import {
  createGameSlugFromTitle,
  gameInterestStatuses,
  gameOwnershipStatuses,
  gameSuggestionStatuses,
  gameVisibilities,
  isValidGameLibraryAdminInput,
  normalizeGameSlug
} from "@maiks-yt/domain/games";
import type {
  GameInterestStatus,
  GameLibraryAdminEntry,
  GameOwnershipStatus,
  GameSuggestionSource,
  GameSuggestionStatus,
  GameVisibility
} from "@maiks-yt/domain/games";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { getSteamAppUrl } from "../../games/steam-store-url-data";
import styles from "./game-library-admin.module.css";

type AdminGamesResponse =
  | {
    ok: true;
    games: readonly GameLibraryAdminEntry[];
    suggestions: readonly GameSuggestionSource[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminGameMutationResponse =
  | {
    ok: true;
    game: GameLibraryAdminEntry;
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
type ActiveView = "library" | "suggestions";
type GameFilter = "all" | "owned" | "not-owned" | "gifted" | "private";
type OwnershipFilter = "all" | GameOwnershipStatus;
type InterestFilter = "all" | GameInterestStatus;
type ReviewedSuggestionStatus = Exclude<GameSuggestionStatus, "pending">;
type ReviewedStatusFilter = "all" | ReviewedSuggestionStatus;

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

const reviewedSuggestionStatuses = gameSuggestionStatuses.filter(
  (status): status is ReviewedSuggestionStatus => status !== "pending"
);

const toGameForm = (game: GameLibraryAdminEntry): GameFormState => ({
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

const suggestionToGameForm = (suggestion: GameSuggestionSource): GameFormState => ({
  title: suggestion.title,
  slug: createGameSlugFromTitle(suggestion.title),
  platformLabel: suggestion.platformLabel ?? "",
  storeProvider: "",
  storeUrl: suggestion.storeUrl ?? "",
  ownershipStatus: "unknown",
  interestStatus: "interested",
  streamFitNote: suggestion.reason ?? "",
  contentWarnings: "",
  categoryLabel: suggestion.tags[0] ?? "",
  visibility: "private",
  sortOrder: 0
});

const suggestionToGiftedGameForm = (suggestion: GameSuggestionSource): GameFormState => ({
  ...suggestionToGameForm(suggestion),
  ownershipStatus: "gifted"
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

const sortGames = (games: readonly GameLibraryAdminEntry[]): readonly GameLibraryAdminEntry[] =>
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

const getReviewedSortValue = (suggestion: GameSuggestionSource): number => {
  const timestamp = Date.parse(suggestion.reviewedAt ?? suggestion.updatedAt);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatReviewedDate = (value: string | null): string => {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatStatus = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatScheduleSummaryTime = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
};

const GameArtwork = ({ game, large = false }: { game: GameLibraryAdminEntry; large?: boolean }): React.ReactNode => {
  const [failed, setFailed] = useState(false);
  const initial = game.title.trim().charAt(0).toUpperCase() || "G";

  return game.artworkUrl && !failed ? (
    <img
      alt=""
      className={large ? styles.artworkLarge : styles.artwork}
      height={large ? 72 : 40}
      loading="lazy"
      onError={() => setFailed(true)}
      src={game.artworkUrl}
      width={large ? 104 : 58}
    />
  ) : (
    <span aria-hidden="true" className={large ? styles.artworkFallbackLarge : styles.artworkFallback}>
      {initial}
    </span>
  );
};

const GameLibraryAdminClient = (): React.ReactNode => {
  const [games, setGames] = useState<readonly GameLibraryAdminEntry[]>([]);
  const [suggestions, setSuggestions] = useState<readonly GameSuggestionSource[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [gameForm, setGameForm] = useState<GameFormState>(defaultGameForm);
  const [suggestionReview, setSuggestionReview] = useState<SuggestionReviewState>(defaultSuggestionReviewState);
  const [activeView, setActiveView] = useState<ActiveView>("library");
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [interestFilter, setInterestFilter] = useState<InterestFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState("");
  const [showAllReviewed, setShowAllReviewed] = useState(false);
  const [reviewedSearchQuery, setReviewedSearchQuery] = useState("");
  const [reviewedStatusFilter, setReviewedStatusFilter] = useState<ReviewedStatusFilter>("all");
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

  const replaceGame = useCallback((game: GameLibraryAdminEntry): void => {
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
  ): Promise<GameLibraryAdminEntry | null> => {
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
        return payload.game;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
      return null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const reviewSuggestion = async (
    suggestionId: string,
    status: Exclude<GameSuggestionStatus, "pending">,
    override?: Partial<SuggestionReviewState>
  ): Promise<GameSuggestionSource | null> => {
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
          linkedGameId: (override?.linkedGameId ?? suggestionReview.linkedGameId) || null,
          reviewerNote: (override?.reviewerNote ?? suggestionReview.reviewerNote.trim()) || null
        })
      });
      const payload = await parseJson<AdminSuggestionMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setSuggestions((current) => current.map((suggestion) => (
          suggestion.id === payload.suggestion.id ? payload.suggestion : suggestion
        )));
        setSuggestionReview(defaultSuggestionReviewState);
        setMessage("Game suggestion reviewed.");
        return payload.suggestion;
      }

      setMessage(payload?.ok === false && payload.reason === "game_suggestion_invalid_input"
        ? "Check the suggestion review fields."
        : `Game suggestion review failed with ${response.status}.`);
      return null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Game suggestion review failed.");
      return null;
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
    setActiveView("library");
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

  const createPrivateGameFromSuggestion = async (
    suggestion: GameSuggestionSource,
    options: {
      gifted?: boolean;
    } = {}
  ): Promise<void> => {
    const draft = options.gifted
      ? suggestionToGiftedGameForm(suggestion)
      : suggestionToGameForm(suggestion);
    const issue = getLocalFormIssue(draft);

    if (issue) {
      setMessage(issue);
      return;
    }

    const game = await runGameMutation(
      options.gifted ? "Creating private gifted game from suggestion" : "Creating private game from suggestion",
      "/admin/games",
      {
        method: "POST",
        body: toPayload(draft)
      }
    );

    if (!game) {
      return;
    }

    await reviewSuggestion(suggestion.id, "accepted", {
      linkedGameId: game.id,
      reviewerNote: suggestionReview.reviewerNote.trim()
        || (options.gifted
          ? `Created private gifted game from suggestion: ${suggestion.title}`
          : `Created private game from suggestion: ${suggestion.title}`)
    });
  };

  const draftGameFromSuggestion = (suggestion: GameSuggestionSource): void => {
    setActiveView("library");
    setSelectedId("");
    setGameForm(suggestionToGameForm(suggestion));
    setSuggestionReview((current) => ({
      ...current,
      reviewerNote: current.reviewerNote || `Drafted from suggestion: ${suggestion.title}`
    }));
    setMessage("Suggestion copied into a private game draft. Save it before reviewing the suggestion.");
  };

  const visibleGames = sortGames(games);
  const gameTitleById = new Map(visibleGames.map((game) => [game.id, game.title]));
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending");
  const reviewedSuggestions = suggestions
    .filter((suggestion) => suggestion.status !== "pending")
    .slice()
    .sort((left, right) => getReviewedSortValue(right) - getReviewedSortValue(left));
  const normalizedReviewedSearch = reviewedSearchQuery.trim().toLocaleLowerCase();
  const filteredReviewedSuggestions = reviewedSuggestions.filter((suggestion) => {
    const matchesStatus = reviewedStatusFilter === "all" || suggestion.status === reviewedStatusFilter;
    const matchesSearch = normalizedReviewedSearch.length === 0
      || [suggestion.title, suggestion.platformLabel, suggestion.suggestedByName, suggestion.reviewerNote]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedReviewedSearch));

    return matchesStatus && matchesSearch;
  });
  const displayedReviewedSuggestions = showAllReviewed
    ? filteredReviewedSuggestions
    : reviewedSuggestions.slice(0, 8);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredGames = visibleGames.filter((game) => {
    const matchesQuickFilter = gameFilter === "all"
      || (gameFilter === "private" ? game.visibility === "private" : game.ownershipStatus === gameFilter);
    const matchesOwnership = ownershipFilter === "all" || game.ownershipStatus === ownershipFilter;
    const matchesInterest = interestFilter === "all" || game.interestStatus === interestFilter;
    const matchesSearch = normalizedSearch.length === 0
      || [game.title, game.platformLabel, game.categoryLabel, game.storeProvider]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));

    return matchesQuickFilter && matchesOwnership && matchesInterest && matchesSearch;
  });
  const steamAppUrl = gameForm.storeProvider.trim().toLocaleLowerCase() === "steam"
    ? getSteamAppUrl(gameForm.storeUrl.trim() || null)
    : null;
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedSuggestionId)
    ?? pendingSuggestions[0]
    ?? reviewedSuggestions[0]
    ?? null;
  const selectedScheduleAssociations = selectedGame?.scheduleAssociations ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <h1>Games</h1>
          <span>{visibleGames.length} records</span>
        </div>
        <button type="button" onClick={startNewGame}>
          <FiPlus aria-hidden="true" />
          New game
        </button>
      </header>

      <p
        aria-live="polite"
        className={`${styles.statusMessage} ${message === "Game Library loaded." ? styles.visuallyHidden : ""}`}
      >
        {message}
      </p>

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
        <>
          <nav aria-label="Game management views" className={styles.tabs}>
            <button
              aria-current={activeView === "library" ? "page" : undefined}
              className={activeView === "library" ? styles.activeTab : undefined}
              onClick={() => setActiveView("library")}
              type="button"
            >
              Library <span>{visibleGames.length}</span>
            </button>
            <button
              aria-current={activeView === "suggestions" ? "page" : undefined}
              className={activeView === "suggestions" ? styles.activeTab : undefined}
              onClick={() => setActiveView("suggestions")}
              type="button"
            >
              Suggestions <span>{pendingSuggestions.length}</span>
            </button>
          </nav>

          {activeView === "library" ? (
            <div className={styles.workspace}>
              <section aria-label="Game library" className={styles.masterPane}>
                <div className={styles.libraryToolbar}>
                  <label className={styles.searchField}>
                    <FiSearch aria-hidden="true" />
                    <span className={styles.visuallyHidden}>Search games</span>
                    <input
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search games..."
                      type="search"
                      value={searchQuery}
                    />
                  </label>
                  <div aria-label="Quick game filters" className={styles.filters} role="group">
                    {([
                      ["all", "All"],
                      ["owned", "Owned"],
                      ["not-owned", "Not owned"],
                      ["gifted", "Gifted"],
                      ["private", "Private"]
                    ] as const).map(([value, label]) => (
                      <button
                        aria-pressed={gameFilter === value}
                        className={gameFilter === value ? styles.activeFilter : undefined}
                        key={value}
                        onClick={() => {
                          setGameFilter(value);
                          setOwnershipFilter("all");
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.advancedFilters}>
                  <label>
                    <span>Ownership</span>
                    <select
                      aria-label="Filter by ownership"
                      onChange={(event) => {
                        setOwnershipFilter(event.target.value as OwnershipFilter);
                        setGameFilter("all");
                      }}
                      value={ownershipFilter}
                    >
                      <option value="all">Any ownership</option>
                      {gameOwnershipStatuses.map((status) => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Interest</span>
                    <select
                      aria-label="Filter by interest"
                      onChange={(event) => setInterestFilter(event.target.value as InterestFilter)}
                      value={interestFilter}
                    >
                      <option value="all">Any interest</option>
                      {gameInterestStatuses.map((status) => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={styles.gameListHeader} aria-hidden="true">
                  <span>Game</span>
                  <span>Platform</span>
                  <span>Ownership</span>
                  <span>Interest</span>
                  <span>Schedule</span>
                  <span>Visibility</span>
                  <span />
                </div>
                <div className={styles.gameList}>
                  {filteredGames.length === 0 ? (
                    <div className={styles.emptyState}>
                      <strong>No matching games</strong>
                      <span>Change the search or filter to see other records.</span>
                    </div>
                  ) : filteredGames.map((game) => (
                    <button
                      aria-pressed={game.id === selectedId}
                      className={`${styles.gameRow} ${game.id === selectedId ? styles.selectedRow : ""}`}
                      key={game.id}
                      onClick={() => selectGame(game.id)}
                      type="button"
                    >
                      <span className={styles.gameIdentity}>
                        <GameArtwork game={game} />
                        <strong>{game.title}</strong>
                      </span>
                      <span className={styles.platformCell}>
                        {game.storeProvider?.toLocaleLowerCase() === "steam" ? <FaSteam aria-hidden="true" /> : null}
                        {game.platformLabel ?? "—"}
                      </span>
                      <span className={`${styles.pill} ${styles.ownershipPill}`}>{formatStatus(game.ownershipStatus)}</span>
                      <span className={`${styles.pill} ${styles.interestPill}`}>{formatStatus(game.interestStatus)}</span>
                      <span className={styles.scheduleSummaryCell}>
                        <FiCalendar aria-hidden="true" />
                        {game.scheduleAssociations.length > 0
                          ? `${game.scheduleAssociations.length} ${game.scheduleAssociations.length === 1 ? "link" : "links"}`
                          : "No plan"}
                      </span>
                      <span className={styles.visibilityCell}>
                        {game.visibility === "public" ? <FiEye aria-hidden="true" /> : <FiEyeOff aria-hidden="true" />}
                        {formatStatus(game.visibility)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <form className={styles.detailPane} id="game-editor-form" onSubmit={(event) => void saveGame(event)}>
                <header className={styles.detailHeader}>
                  {selectedGame ? <GameArtwork game={selectedGame} key={selectedGame.id} large /> : (
                    <span aria-hidden="true" className={styles.artworkFallbackLarge}>+</span>
                  )}
                  <div className={styles.detailTitle}>
                    <h2 className={styles.visuallyHidden}>{selectedGame?.title ?? "New game"}</h2>
                    <input
                      aria-label="Title"
                      className={styles.titleInput}
                      maxLength={191}
                      onChange={(event) => setGameForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Game title"
                      required
                      value={gameForm.title}
                    />
                    <input
                      aria-label="Slug"
                      className={styles.slugInput}
                      maxLength={191}
                      onChange={(event) => setGameForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="derived from title"
                      value={gameForm.slug}
                    />
                    {gameForm.storeUrl ? (
                      <span className={styles.storeLinks}>
                        {steamAppUrl ? (
                          <a href={steamAppUrl} title="Open in Steam app">
                            <FaSteam aria-hidden="true" /> Open in Steam
                          </a>
                        ) : null}
                        <a href={gameForm.storeUrl} rel="noreferrer" target="_blank">
                          Open store <FiExternalLink aria-hidden="true" />
                        </a>
                      </span>
                    ) : null}
                  </div>
                  <button disabled={busyAction !== null} type="submit">
                    {busyAction ? "Saving..." : selectedGame ? "Save changes" : "Create game"}
                  </button>
                </header>

                <section className={styles.formSection}>
                  <h3>State</h3>
                  <div className={styles.threeColumnFields}>
                    <label>
                      Ownership
                      <select value={gameForm.ownershipStatus} onChange={(event) => setGameForm((current) => ({ ...current, ownershipStatus: event.target.value as GameOwnershipStatus }))}>
                        {gameOwnershipStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                      </select>
                    </label>
                    <label>
                      Interest
                      <select value={gameForm.interestStatus} onChange={(event) => setGameForm((current) => ({ ...current, interestStatus: event.target.value as GameInterestStatus }))}>
                        {gameInterestStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                      </select>
                    </label>
                    <label>
                      Visibility
                      <select value={gameForm.visibility} onChange={(event) => setGameForm((current) => ({ ...current, visibility: event.target.value as GameVisibility }))}>
                        {gameVisibilities.map((visibility) => <option key={visibility} value={visibility}>{formatStatus(visibility)}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <section className={styles.formSection}>
                  <h3>Store</h3>
                  <div className={styles.storeFields}>
                    <label>
                      Platform
                      <input value={gameForm.platformLabel} onChange={(event) => setGameForm((current) => ({ ...current, platformLabel: event.target.value }))} maxLength={120} />
                    </label>
                    <label>
                      Provider
                      <input value={gameForm.storeProvider} onChange={(event) => setGameForm((current) => ({ ...current, storeProvider: event.target.value }))} maxLength={80} />
                    </label>
                    <label>
                      Store URL
                      <span className={styles.urlField}>
                        <input value={gameForm.storeUrl} onChange={(event) => setGameForm((current) => ({ ...current, storeUrl: event.target.value }))} maxLength={1024} />
                        {gameForm.storeUrl ? (
                          <a aria-label="Open store URL" href={gameForm.storeUrl} rel="noreferrer" target="_blank"><FiExternalLink aria-hidden="true" /></a>
                        ) : null}
                      </span>
                    </label>
                  </div>
                </section>

                <section className={styles.formSection}>
                  <h3>Planning notes</h3>
                  <label>
                    Stream fit notes
                    <textarea value={gameForm.streamFitNote} onChange={(event) => setGameForm((current) => ({ ...current, streamFitNote: event.target.value }))} maxLength={500} rows={2} />
                  </label>
                  <label>
                    Content warnings
                    <textarea value={gameForm.contentWarnings} onChange={(event) => setGameForm((current) => ({ ...current, contentWarnings: event.target.value }))} maxLength={2000} rows={2} />
                  </label>
                  <label>
                    Category / theme
                    <input value={gameForm.categoryLabel} onChange={(event) => setGameForm((current) => ({ ...current, categoryLabel: event.target.value }))} maxLength={120} />
                  </label>
                </section>

                <section className={styles.formSection}>
                  <div className={styles.sectionHeadingRow}>
                    <h3>Schedule</h3>
                    <a href="/admin/schedule">Open Schedule <FiExternalLink aria-hidden="true" /></a>
                  </div>
                  {selectedGame ? (
                    selectedScheduleAssociations.length > 0 ? (
                      <ol className={styles.scheduleSummaryList}>
                        {selectedScheduleAssociations.map((association) => (
                          <li key={association.scheduleEntryId}>
                            <span className={`${styles.pill} ${styles.schedulePill}`}>{formatStatus(association.status)}</span>
                            <div>
                              <strong>{association.title}</strong>
                              <span>{formatScheduleSummaryTime(association.startsAt)} · {formatStatus(association.relationship)} · {formatStatus(association.visibility)}</span>
                              {association.publicNote ? <small>{association.publicNote}</small> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className={styles.mutedLine}>No upcoming or live schedule links for this game.</p>
                    )
                  ) : (
                    <p className={styles.mutedLine}>Save the game before linking it from Schedule.</p>
                  )}
                </section>

                <section className={styles.formSection}>
                  <h3>Ordering</h3>
                  <label className={styles.sortField}>
                    Sort order
                    <input type="number" value={gameForm.sortOrder} onChange={(event) => setGameForm((current) => ({ ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} min={-10000} max={10000} />
                  </label>
                </section>

                <a className={styles.scheduleLink} href="/admin/schedule">
                  <FiCalendar aria-hidden="true" />
                  <span>Stream links are managed in Schedule</span>
                  <strong>Open Schedule <FiExternalLink aria-hidden="true" /></strong>
                </a>
              </form>
            </div>
          ) : (
            <div className={styles.suggestionWorkspace}>
              <section aria-label="Game suggestions" className={styles.suggestionListPane}>
                <div className={styles.suggestionHeading}>
                  <h2>Pending</h2>
                  <span>{pendingSuggestions.length}</span>
                </div>
                {pendingSuggestions.length === 0 ? (
                  <div className={styles.emptyState}>
                    <strong>No suggestions waiting</strong>
                    <span>New viewer suggestions will appear here for private review.</span>
                  </div>
                ) : pendingSuggestions.map((suggestion) => (
                  <button
                    className={`${styles.suggestionRow} ${selectedSuggestion?.id === suggestion.id ? styles.selectedSuggestion : ""}`}
                    key={suggestion.id}
                    onClick={() => {
                      setSelectedSuggestionId(suggestion.id);
                      setSuggestionReview(defaultSuggestionReviewState);
                    }}
                    type="button"
                  >
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.platformLabel ?? "Platform not provided"}</span>
                    {suggestion.reason ? <small>{suggestion.reason}</small> : null}
                  </button>
                ))}

                <div className={styles.suggestionHeading}>
                  <h2>Recently reviewed</h2>
                  <span>{reviewedSuggestions.length}</span>
                </div>
                {showAllReviewed ? (
                  <div className={styles.reviewedToolbar}>
                    <label className={styles.searchField}>
                      <FiSearch aria-hidden="true" />
                      <span className={styles.visuallyHidden}>Search reviewed suggestions</span>
                      <input
                        onChange={(event) => setReviewedSearchQuery(event.target.value)}
                        placeholder="Search reviewed..."
                        type="search"
                        value={reviewedSearchQuery}
                      />
                    </label>
                    <label>
                      <span className={styles.visuallyHidden}>Filter reviewed suggestions by status</span>
                      <select
                        aria-label="Filter reviewed suggestions by status"
                        onChange={(event) => setReviewedStatusFilter(event.target.value as ReviewedStatusFilter)}
                        value={reviewedStatusFilter}
                      >
                        <option value="all">All decisions</option>
                        {reviewedSuggestionStatuses.map((status) => (
                          <option key={status} value={status}>{formatStatus(status)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                {reviewedSuggestions.length === 0 ? (
                  <p className={styles.mutedLine}>No reviewed suggestions yet.</p>
                ) : displayedReviewedSuggestions.length === 0 ? (
                  <p className={styles.mutedLine}>No reviewed suggestions match these filters.</p>
                ) : displayedReviewedSuggestions.map((suggestion) => (
                  <button
                    className={`${styles.suggestionRow} ${selectedSuggestion?.id === suggestion.id ? styles.selectedSuggestion : ""}`}
                    key={suggestion.id}
                    onClick={() => setSelectedSuggestionId(suggestion.id)}
                    type="button"
                  >
                    <strong>{suggestion.title}</strong>
                    <span>{formatStatus(suggestion.status)} · {formatReviewedDate(suggestion.reviewedAt)}</span>
                  </button>
                ))}
                {reviewedSuggestions.length > 8 ? (
                  <button
                    className={`secondary-action ${styles.reviewedToggle}`}
                    onClick={() => setShowAllReviewed((current) => !current)}
                    type="button"
                  >
                    {showAllReviewed ? "Show less" : `Show all (${reviewedSuggestions.length})`}
                  </button>
                ) : null}
              </section>

              <section className={styles.suggestionDetail}>
                {selectedSuggestion ? (
                  <>
                    <header>
                      <div>
                        <span className={styles.suggestionLabel}>{formatStatus(selectedSuggestion.status)}</span>
                        <h2>{selectedSuggestion.title}</h2>
                        <p>{[selectedSuggestion.platformLabel, selectedSuggestion.suggestedByName].filter(Boolean).join(" · ") || "Viewer suggestion"}</p>
                      </div>
                      {selectedSuggestion.storeUrl ? (
                        <a href={selectedSuggestion.storeUrl} rel="noreferrer" target="_blank">Open store <FiExternalLink aria-hidden="true" /></a>
                      ) : null}
                    </header>
                    {selectedSuggestion.reason ? <p className={styles.suggestionReason}>{selectedSuggestion.reason}</p> : null}
                    {selectedSuggestion.tags.length > 0 ? (
                      <div className={styles.tags}>{selectedSuggestion.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                    ) : null}

                    {selectedSuggestion.status === "pending" ? (
                      <>
                        <div className={styles.twoColumnFields}>
                          <label>
                            Link existing game
                            <select value={suggestionReview.linkedGameId} onChange={(event) => setSuggestionReview((current) => ({ ...current, linkedGameId: event.target.value }))}>
                              <option value="">No linked game</option>
                              {visibleGames.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
                            </select>
                          </label>
                          <label>
                            Review note
                            <input value={suggestionReview.reviewerNote} onChange={(event) => setSuggestionReview((current) => ({ ...current, reviewerNote: event.target.value }))} maxLength={1000} />
                          </label>
                        </div>
                        <div className={styles.suggestionActions}>
                          <button type="button" onClick={() => void createPrivateGameFromSuggestion(selectedSuggestion)} disabled={busyAction !== null}>Create private game</button>
                          <button type="button" className="secondary-action" onClick={() => void createPrivateGameFromSuggestion(selectedSuggestion, { gifted: true })} disabled={busyAction !== null}>Create gifted game</button>
                          <button type="button" className="secondary-action" onClick={() => draftGameFromSuggestion(selectedSuggestion)} disabled={busyAction !== null}>Draft game</button>
                          <button type="button" onClick={() => void reviewSuggestion(selectedSuggestion.id, "accepted")} disabled={busyAction !== null}>Accept</button>
                          <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(selectedSuggestion.id, "maybe-later")} disabled={busyAction !== null}>Maybe later</button>
                          <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(selectedSuggestion.id, "rejected")} disabled={busyAction !== null}>Reject</button>
                          <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(selectedSuggestion.id, "duplicate")} disabled={busyAction !== null}>Duplicate</button>
                          <button type="button" className="secondary-action" onClick={() => void reviewSuggestion(selectedSuggestion.id, "already-played")} disabled={busyAction !== null}>Already played</button>
                        </div>
                      </>
                    ) : (
                      <dl className={styles.reviewSummary}>
                        <div><dt>Status</dt><dd>{formatStatus(selectedSuggestion.status)}</dd></div>
                        <div><dt>Reviewed</dt><dd>{formatReviewedDate(selectedSuggestion.reviewedAt)}</dd></div>
                        <div><dt>Linked game</dt><dd>{selectedSuggestion.linkedGameId ? gameTitleById.get(selectedSuggestion.linkedGameId) ?? selectedSuggestion.linkedGameId : "None"}</dd></div>
                        <div><dt>Review note</dt><dd>{selectedSuggestion.reviewerNote ?? "None"}</dd></div>
                      </dl>
                    )}
                  </>
                ) : (
                  <div className={styles.emptyDetail}>
                    <h2>No suggestion selected</h2>
                    <p>There are no pending or reviewed suggestions to show.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default GameLibraryAdminClient;
