import type { PublicGameLibraryEntry } from "@maiks-yt/domain/games";
import { FiExternalLink } from "react-icons/fi";
import { SiSteam } from "react-icons/si";

import { formatGameStatus } from "./game-library-data";
import { GameIcon } from "./game-icon";
import styles from "./games.module.css";

const getSteamAppUrl = (storeUrl: string | null): string | null => {
  if (!storeUrl) {
    return null;
  }

  try {
    const url = new URL(storeUrl);
    const appId = url.hostname === "store.steampowered.com"
      ? /^\/app\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1]
      : null;

    return appId ? `steam://store/${appId}` : null;
  } catch {
    return null;
  }
};

export const GameLibraryEntry = ({
  game,
  index
}: {
  game: PublicGameLibraryEntry;
  index: number;
}): React.ReactNode => {
  const steamAppUrl = game.storeProvider === "steam" ? getSteamAppUrl(game.storeUrl) : null;

  return (
    <article className={styles.gameRow} data-interest={game.interestStatus}>
    <div className={styles.gameIdentity}>
      <div className={styles.gameMeta}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span>{game.categoryLabel ?? "Game"}</span>
        <span>{formatGameStatus(game.interestStatus)}</span>
      </div>
      <div className={styles.gameTitle}>
        <GameIcon artworkUrl={game.artworkUrl} title={game.title} />
        <h2>{game.title}</h2>
      </div>
      {game.streamFitNote ? <p>{game.streamFitNote}</p> : null}
      {game.storeUrl ? (
        <div className={styles.storeActions}>
          <span className={styles.storeActionsLabel}>View in:</span>
          {steamAppUrl ? (
            <a className={styles.steamButton} href={steamAppUrl} title="Open in Steam app">
              <SiSteam aria-hidden="true" />
              App
            </a>
          ) : null}
          <a
            className={styles.steamButton}
            href={game.storeUrl}
            rel="noreferrer"
            target="_blank"
            title="View on the Steam website"
          >
            <FiExternalLink aria-hidden="true" />
            Web
          </a>
        </div>
      ) : null}
    </div>

    <dl className={styles.gameFacts}>
      <div>
        <dt>Access</dt>
        <dd>{formatGameStatus(game.ownershipStatus)}</dd>
      </div>
      <div>
        <dt>Platform</dt>
        <dd>{game.platformLabel ?? "Not specified"}</dd>
      </div>
      <div>
        <dt>Popularity</dt>
        <dd>
          {game.popularityScore === null
            ? "Not available"
            : `${new Intl.NumberFormat("en").format(game.popularityScore)} playing now`}
        </dd>
      </div>
    </dl>

    {game.contentWarnings ? (
      <p className={styles.contentNote}>
        <strong>Content note</strong>
        <span>{game.contentWarnings}</span>
      </p>
    ) : null}
    </article>
  );
};
