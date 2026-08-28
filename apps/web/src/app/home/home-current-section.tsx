import styles from "../home.module.css";
import type { HomeScheduleSlot } from "./home-schedule-data";

type HomeCurrentSectionProps = {
  scheduleSlot: HomeScheduleSlot;
};

const getSchedulePanelCopy = (scheduleSlot: HomeScheduleSlot): {
  heading: string;
  body: string;
  eyebrow: string;
} => {
  if (scheduleSlot.status === "live") {
    return {
      eyebrow: "Live now",
      heading: scheduleSlot.title,
      body: `Started ${scheduleSlot.timeLabel}. The schedule has the latest status.`
    };
  }

  if (scheduleSlot.status === "planned") {
    return {
      eyebrow: "Up next",
      heading: scheduleSlot.title,
      body: `${scheduleSlot.timeLabel}. Plans can still change, so the schedule stays authoritative.`
    };
  }

  if (scheduleSlot.status === "unavailable") {
    return {
      eyebrow: "Up next",
      heading: "Schedule temporarily unavailable",
      body: "The public schedule could not be loaded. Please check back shortly."
    };
  }

  return {
    eyebrow: "Up next",
    heading: "No date published yet",
    body: "The next stream will appear here as soon as it is scheduled. No invented countdowns."
  };
};

export const HomeCurrentSection = ({ scheduleSlot }: HomeCurrentSectionProps): React.ReactNode => {
  const copy = getSchedulePanelCopy(scheduleSlot);

  return (
    <section className={styles.band} id="current-signal" aria-labelledby="current-signal-title">
      <div className={styles.bandInner}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Current signal</p>
            <h2 id="current-signal-title">What I'm working on now.</h2>
          </div>
          <p>
            This site is being built in public. Finished work, active work, and uncertain plans are
            labelled differently so progress stays honest.
          </p>
        </div>
        <div className={styles.currentGrid}>
          <article className={styles.projectFeature}>
            <span className={styles.projectIndex}>01</span>
            <div>
              <h3>Building the Maiks.yt platform</h3>
              <p>
                The stream website, control tools, community system, projects, and transparent
                accounting are becoming one shared platform instead of disconnected services.
              </p>
              <a className={styles.inlineLink} href="/projects">Open the projects →</a>
            </div>
          </article>
          <aside className={styles.schedulePanel} aria-labelledby="home-schedule-title">
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h3 id="home-schedule-title">{copy.heading}</h3>
            <p>{copy.body}</p>
            <a className={styles.scheduleLink} href="/schedule">View the schedule</a>
          </aside>
        </div>
      </div>
    </section>
  );
};
