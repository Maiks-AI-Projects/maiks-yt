import type { Metadata } from "next";

import { getPublicStreamSchedule } from "../schedule/stream-schedule-data";
import { GameLibraryEntry } from "./game-library-entry";
import { getPublicGames } from "./game-library-data";
import { GamePlayPlan } from "./game-play-plan";
import GameSuggestionForm from "./game-suggestion-form";
import styles from "./games.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Game library and play plans",
  description: "Games Michael is playing, planning, pausing, or considering for future streams."
};

const GamesPage = async (): Promise<React.ReactNode> => {
  const [gamesResult, scheduleResult] = await Promise.all([
    getPublicGames(),
    getPublicStreamSchedule()
  ]);
  const playPlans = scheduleResult.streams.filter((stream) =>
    (stream.status === "live" || stream.status === "planned") && stream.gameLinks.length > 0
  );
  const wishlistGames = gamesResult.games.filter((game) => game.ownershipStatus === "not-owned");
  const libraryGames = gamesResult.games.filter((game) => game.ownershipStatus !== "not-owned");

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Game library and play plans</p>
        <h1>What I play, pause, and plan to return to.</h1>
        <p>
          A public view of the games on my radar, why they may work on stream, and where they fit
          into upcoming plans. Suggestions stay private until they have been reviewed.
        </p>
      </header>

      {gamesResult.status === "error" ? (
        <section className={styles.stateBand} aria-live="polite">
          <p className={styles.eyebrow}>Temporarily unavailable</p>
          <h2>The game library could not be loaded.</h2>
          <p>The live service did not respond. No placeholder games are being shown.</p>
        </section>
      ) : (
        <>
          <section className={styles.wishlist} aria-labelledby="game-wishlist-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Steam wishlist</p>
                <h2 id="game-wishlist-title">Games I may play next</h2>
              </div>
              <p>
                Games I do not own yet, ordered by current Steam activity. These stay linked to
                Steam so their details can be inspected there before I decide what to add.
              </p>
            </div>

            {wishlistGames.length === 0 ? (
              <p className={styles.formMessage}>The live Steam wishlist is currently empty.</p>
            ) : (
              <div className={styles.gameList}>
                {wishlistGames.map((game, index) => (
                  <GameLibraryEntry game={game} index={index} key={game.id} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.library} aria-labelledby="game-library-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>The library</p>
                <h2 id="game-library-title">Games I own</h2>
              </div>
              <p>
                Published entries show current interest, platform, stream fit, and useful content
                notes without exposing private suggestions or review details.
              </p>
            </div>

            {libraryGames.length === 0 ? (
              <div className={styles.stateBand}>
                <p className={styles.eyebrow}>Library ready</p>
                <h2>No games have been published yet.</h2>
                <p>The live library is connected. Its first public entries still need to be selected.</p>
              </div>
            ) : (
              <div className={styles.gameList}>
                {libraryGames.map((game, index) => (
                  <GameLibraryEntry game={game} index={index} key={game.id} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className={styles.playPlans} aria-labelledby="play-plans-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Play plans</p>
            <h2 id="play-plans-title">Linked to the stream schedule</h2>
          </div>
          <p>
            Scheduled streams appear here automatically when they have a public game attached.
            Plans can change, and the current schedule status remains visible.
          </p>
        </div>
        {scheduleResult.status === "error" ? (
          <p className={styles.formMessage}>Play plans are temporarily unavailable.</p>
        ) : playPlans.length === 0 ? (
          <p className={styles.formMessage}>No upcoming streams currently have a game attached.</p>
        ) : (
          <div className={styles.playPlanList}>
            {playPlans.map((stream) => <GamePlayPlan key={stream.id} stream={stream} />)}
          </div>
        )}
      </section>

      <GameSuggestionForm />
    </main>
  );
};

export default GamesPage;
