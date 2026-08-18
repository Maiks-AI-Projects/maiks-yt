import { FiAlertTriangle, FiCheck } from "react-icons/fi";

import { getMusicSafetyLabels } from "./music-catalog.service";
import type { MusicCatalogTrack, MusicSafetyContext } from "./music-track.types";
import styles from "./music-searchable-select.module.css";

export const MusicTrackSummary = ({
  isSelected,
  safetyContext,
  track,
  unavailableReason
}: {
  readonly isSelected: boolean;
  readonly safetyContext: MusicSafetyContext;
  readonly track: MusicCatalogTrack;
  readonly unavailableReason: string | null;
}): React.ReactNode => (
  <div className={styles.trackSummary}>
    <div className={styles.titleLine}>
      <strong>{track.title}</strong>
      {isSelected ? <FiCheck aria-label="Selected" /> : null}
    </div>
    <div className={styles.metaLine}>
      <span>{track.artist}</span>
      <span>{track.provider}</span>
      {track.sourceLabel ? <span>{track.sourceLabel}</span> : null}
      {track.attributionCue ? <span>{track.attributionCue}</span> : null}
    </div>
    <div className={styles.badgeLine}>
      {getMusicSafetyLabels(track).map((safetyLabel) => (
        <span
          className={styles.badge}
          data-muted={
            safetyLabel.includes("review")
            || (safetyContext === "live" && safetyLabel.startsWith("VOD"))
            || (safetyContext === "vod" && safetyLabel.startsWith("Live"))
          }
          key={safetyLabel}
        >
          {safetyLabel}
        </span>
      ))}
      {unavailableReason ? (
        <span className={styles.unavailableBadge}>
          <FiAlertTriangle aria-hidden="true" />
          {unavailableReason}
        </span>
      ) : null}
    </div>
  </div>
);
