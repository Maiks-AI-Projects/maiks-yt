import styles from "../home.module.css";
import type { HomeProjectSlot } from "./home-project-data";
import type { HomeScheduleSlot } from "./home-schedule-data";

type HomeCurrentSectionProps = {
  projectSlot: HomeProjectSlot;
  scheduleSlot: HomeScheduleSlot;
};

type ProjectCardCopy = {
  heading: string;
  body: string;
  href: string;
  linkLabel: string;
  milestoneTitle?: string;
};

const getSchedulePanelCopy = (scheduleSlot: HomeScheduleSlot): {
  heading: string;
  body: string;
  eyebrow: string;
} => {
  if (scheduleSlot.status === "live") {
    const gameCopy = scheduleSlot.gameFocus
      ? ` Game: ${scheduleSlot.gameFocus.title}${scheduleSlot.gameFocus.platformLabel ? ` / ${scheduleSlot.gameFocus.platformLabel}` : ""}.`
      : "";

    return {
      eyebrow: "Live now",
      heading: scheduleSlot.title,
      body: `Started ${scheduleSlot.timeLabel}. The schedule has the latest status.${gameCopy}`
    };
  }

  if (scheduleSlot.status === "planned") {
    const gameCopy = scheduleSlot.gameFocus
      ? ` Game: ${scheduleSlot.gameFocus.title}${scheduleSlot.gameFocus.platformLabel ? ` / ${scheduleSlot.gameFocus.platformLabel}` : ""}.`
      : "";

    return {
      eyebrow: "Up next",
      heading: scheduleSlot.title,
      body: `${scheduleSlot.timeLabel}. Plans can still change, so the schedule stays authoritative.${gameCopy}`
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

const getProjectCardCopy = (projectSlot: HomeProjectSlot): ProjectCardCopy => {
  if (projectSlot.status === "available") {
    return {
      heading: projectSlot.title,
      body: projectSlot.summary,
      href: `/projects/${encodeURIComponent(projectSlot.slug)}`,
      linkLabel: "Open the project →",
      ...(projectSlot.nextMilestoneTitle ? { milestoneTitle: projectSlot.nextMilestoneTitle } : {})
    };
  }

  if (projectSlot.status === "unavailable") {
    return {
      heading: "Current project temporarily unavailable",
      body: "The public project list could not be loaded. Please check back shortly.",
      href: "/projects",
      linkLabel: "Open the projects →"
    };
  }

  return {
    heading: "No current project published yet",
    body: "Active and planning projects will appear here when they are ready for public view.",
    href: "/projects",
    linkLabel: "Open the projects →"
  };
};

export const HomeCurrentSection = ({
  projectSlot,
  scheduleSlot
}: HomeCurrentSectionProps): React.ReactNode => {
  const copy = getSchedulePanelCopy(scheduleSlot);
  const projectCopy = getProjectCardCopy(projectSlot);

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
              <h3>{projectCopy.heading}</h3>
              <p>{projectCopy.body}</p>
              {projectCopy.milestoneTitle ? <p>Current milestone: {projectCopy.milestoneTitle}</p> : null}
              <a className={styles.inlineLink} href={projectCopy.href}>{projectCopy.linkLabel}</a>
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
