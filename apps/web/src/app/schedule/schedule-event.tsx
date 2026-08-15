import type { StreamScheduleEntry } from "@maiks-yt/domain/schedule";

import { cancellationReasonLabels, formatScheduleLabel } from "./stream-schedule-data";
import { ScheduleDateTime } from "./schedule-date-time";
import styles from "./schedule.module.css";

type ScheduleEventProps = {
  featured?: boolean;
  stream: StreamScheduleEntry;
};

export const ScheduleEvent = ({ featured = false, stream }: ScheduleEventProps): React.ReactNode => (
  <article className={styles.event} data-featured={featured || undefined} data-status={stream.status}>
    <div className={styles.eventTime}>
      <span className={styles.status}>{formatScheduleLabel(stream.status)}</span>
      <ScheduleDateTime endsAt={stream.endsAt} startsAt={stream.startsAt} />
    </div>

    <div className={styles.eventBody}>
      <div className={styles.eventMeta}>
        <span>{formatScheduleLabel(stream.channelKey)}</span>
        <span>{stream.topicKey ? formatScheduleLabel(stream.topicKey) : "General"}</span>
      </div>
      <h2>{stream.title}</h2>
      {stream.description ? <p>{stream.description}</p> : null}

      {stream.focusProject ? (
        <div className={styles.focus}>
          <strong>{stream.focusLabel || "Project focus"}</strong>
          <a href={`/projects/${encodeURIComponent(stream.focusProject.slug)}`}>
            {stream.focusProject.title}
          </a>
          {stream.focusNote ? <span>{stream.focusNote}</span> : null}
        </div>
      ) : null}

      {stream.gameLinks.length > 0 ? (
        <div className={styles.focus}>
          <strong>Game focus</strong>
          {stream.gameLinks.map((game) => (
            <a href="/games" key={game.id}>
              {game.title}{game.platformLabel ? ` / ${game.platformLabel}` : ""}
              {game.publicNote ? <span>{game.publicNote}</span> : null}
            </a>
          ))}
        </div>
      ) : null}

      {stream.status === "cancelled" ? (
        <div className={styles.cancellation} role="status">
          <strong>
            {stream.cancellationReasonCode
              ? cancellationReasonLabels[stream.cancellationReasonCode]
              : "Cancelled"}
          </strong>
          <span>{stream.cancellationReason}</span>
        </div>
      ) : null}
    </div>
  </article>
);
