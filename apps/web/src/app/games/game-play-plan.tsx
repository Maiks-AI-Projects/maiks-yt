import type { StreamScheduleEntry } from "@maiks-yt/domain/schedule";
import Link from "next/link";

import { ScheduleDateTime } from "../schedule/schedule-date-time";
import { formatGameStatus } from "./game-library-data";
import styles from "./games.module.css";

export const GamePlayPlan = ({ stream }: { stream: StreamScheduleEntry }): React.ReactNode => (
  <article className={styles.playPlan}>
    <div>
      <span>{formatGameStatus(stream.status)}</span>
      <ScheduleDateTime endsAt={stream.endsAt} startsAt={stream.startsAt} />
    </div>
    <div>
      <h3>{stream.title}</h3>
      {stream.description ? <p>{stream.description}</p> : null}
      <div className={styles.playPlanGames}>
        {stream.gameLinks.map((game) => (
          <Link href="/games" key={game.id}>
            {game.title}{game.platformLabel ? ` / ${game.platformLabel}` : ""}
          </Link>
        ))}
      </div>
    </div>
  </article>
);
