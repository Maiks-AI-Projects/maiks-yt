import type { PublicGameLibraryEntry } from "@maiks-yt/domain/games";

import GameSuggestionForm from "./game-suggestion-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Games | Maiks.yt",
  description: "Curated games Michael is playing, planning, or tracking for future streams."
};

type PublicGamesResponse =
  | {
    ok: true;
    games: readonly PublicGameLibraryEntry[];
  }
  | {
    ok: false;
    reason: string;
  };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const loadGames = async (): Promise<readonly PublicGameLibraryEntry[]> => {
  try {
    const response = await fetch(`${apiBaseUrl}/games`, {
      cache: "no-store"
    });
    const payload = await response.json() as PublicGamesResponse;

    return response.ok && payload.ok ? payload.games : [];
  } catch {
    return [];
  }
};

const formatStatus = (value: string): string =>
  value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const GamesPage = async (): Promise<React.ReactNode> => {
  const games = await loadGames();

  return (
    <main className="content-page game-library-page">
      <article className="content-page-article">
        <header className="content-page-header">
          <p className="eyebrow">Stream Planning</p>
          <h1>Games</h1>
          <p>A curated view of games on the stream radar.</p>
        </header>

        {games.length === 0 ? (
          <section className="project-admin-state">
            <h2>No public games yet</h2>
            <p>The private library is ready, but no game records are public yet.</p>
          </section>
        ) : (
          <section className="game-library-grid" aria-label="Curated games">
            {games.map((game) => (
              <article className="game-library-card" key={game.id}>
                <div>
                  <span>{game.categoryLabel ?? game.platformLabel ?? "Game"}</span>
                  <h2>{game.title}</h2>
                </div>
                <dl>
                  <div>
                    <dt>Interest</dt>
                    <dd>{formatStatus(game.interestStatus)}</dd>
                  </div>
                  <div>
                    <dt>Access</dt>
                    <dd>{formatStatus(game.ownershipStatus)}</dd>
                  </div>
                  {game.platformLabel ? (
                    <div>
                      <dt>Platform</dt>
                      <dd>{game.platformLabel}</dd>
                    </div>
                  ) : null}
                </dl>
                {game.streamFitNote ? <p>{game.streamFitNote}</p> : null}
                {game.contentWarnings ? (
                  <p className="game-library-warning">Content notes: {game.contentWarnings}</p>
                ) : null}
              </article>
            ))}
          </section>
        )}

        <GameSuggestionForm />
      </article>
    </main>
  );
};

export default GamesPage;
