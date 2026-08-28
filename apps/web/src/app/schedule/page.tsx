import type { Metadata } from "next";

import { ScheduleEvent } from "./schedule-event";
import { getPublicStreamSchedule } from "./stream-schedule-data";
import { getPublicScheduleEntryKey } from "./stream-schedule-public-keys.rules";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stream schedule",
  description: "Upcoming Maiks.yt streams, changes, cancellations, games, and project focus."
};

const SchedulePage = async (): Promise<React.ReactNode> => {
  const result = await getPublicStreamSchedule();
  const featuredStreamIndex = result.streams.findIndex((stream) => stream.status === "live");
  const nextPlannedStreamIndex = result.streams.findIndex((stream) => stream.status === "planned");
  const selectedFeaturedStreamIndex = featuredStreamIndex >= 0 ? featuredStreamIndex : nextPlannedStreamIndex;
  const featuredStream = selectedFeaturedStreamIndex >= 0
    ? result.streams[selectedFeaturedStreamIndex] ?? null
    : null;
  const upcomingStreams = result.streams
    .map((stream, index) => ({ stream, index }))
    .filter(({ stream, index }) => stream.status === "planned" && index !== selectedFeaturedStreamIndex);
  const recentChanges = result.streams
    .map((stream, index) => ({ stream, index }))
    .filter(({ stream }) => stream.status === "cancelled");

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Stream schedule</p>
        <h1>Streams, changes, and what comes next.</h1>
        <p>
          Planned streams appear here with their game or project focus. Changes and cancellations
          remain visible instead of quietly disappearing from the schedule.
        </p>
      </header>

      {result.status === "error" ? (
        <section className={styles.stateBand} aria-live="polite">
          <p className={styles.eyebrow}>Temporarily unavailable</p>
          <h2>The schedule could not be loaded.</h2>
          <p>Please try again shortly.</p>
        </section>
      ) : result.streams.length === 0 ? (
        <section className={styles.stateBand}>
          <p className={styles.eyebrow}>Nothing planned yet</p>
          <h2>No public streams are scheduled.</h2>
          <p>New streams will appear here after they are added and marked public.</p>
        </section>
      ) : null}

      {featuredStream ? (
        <section className={styles.scheduleSection} aria-labelledby="schedule-current-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{featuredStream.status === "live" ? "Live now" : "Up next"}</p>
              <h2 id="schedule-current-title">
                {featuredStream.status === "live" ? "Happening now" : "The next planned stream"}
              </h2>
            </div>
            <p>
              Times are shown using the visitor&apos;s device. Plans can still change, so the latest
              status remains part of each entry.
            </p>
          </div>
          <ScheduleEvent featured stream={featuredStream} />
        </section>
      ) : null}

      {upcomingStreams.length > 0 ? (
        <section
          className={`${styles.scheduleSection} ${styles.alternateSection}`}
          aria-labelledby="schedule-upcoming-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Coming up</p>
              <h2 id="schedule-upcoming-title">Upcoming streams</h2>
            </div>
            <p>
              Game streams, project work, and technical sessions can share one schedule while keeping
              their channel and topic clear.
            </p>
          </div>
          <div className={styles.eventList}>
            {upcomingStreams.map(({ stream, index }) => (
              <ScheduleEvent key={getPublicScheduleEntryKey(stream, index)} stream={stream} />
            ))}
          </div>
        </section>
      ) : null}

      {recentChanges.length > 0 ? (
        <section className={styles.scheduleSection} aria-labelledby="schedule-changes-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Recent status</p>
              <h2 id="schedule-changes-title">Changes stay visible</h2>
            </div>
            <p>
              Completed and cancelled entries provide a short public record. Cancellation wording
              can stay factual without requiring a detailed personal explanation.
            </p>
          </div>
          <div className={styles.eventList}>
            {recentChanges.map(({ stream, index }) => (
              <ScheduleEvent key={getPublicScheduleEntryKey(stream, index)} stream={stream} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
};

export default SchedulePage;
