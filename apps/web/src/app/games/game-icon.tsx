"use client";

import { useState } from "react";

import styles from "./games.module.css";

export const GameIcon = ({
  artworkUrl,
  title
}: {
  artworkUrl: string | null;
  title: string;
}): React.ReactNode => {
  const [failed, setFailed] = useState(false);
  const initial = title.trim().charAt(0).toUpperCase() || "G";

  return artworkUrl && !failed ? (
    <img
      alt=""
      className={styles.gameIcon}
      height="40"
      loading="lazy"
      onError={() => setFailed(true)}
      src={artworkUrl}
      width="40"
    />
  ) : (
    <span aria-hidden="true" className={styles.gameIconFallback}>{initial}</span>
  );
};
