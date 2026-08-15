import type { Metadata } from "next";

import { AboutNavigation } from "../about-navigation";
import styles from "../about.module.css";
import { createHistoryTimeline } from "../history-timeline-data";

const timelineKindLabels = {
  birth: "Beginning",
  birthday: "Birthday",
  residence: "Residence",
  streaming: "Streaming"
} as const;

export const metadata: Metadata = {
  title: "My history",
  description: "Michael's public life timeline, beginning with confirmed dates and places."
};

const HistoryPage = (): React.ReactNode => {
  const timeline = createHistoryTimeline();

  return (
    <main className={styles.page}>
      <AboutNavigation current="history" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>My history</p>
        <h1>This is what happened.</h1>
        <p className={styles.lead}>
          This is a dated record of my life from birth to the present. I will add facts as the
          records and my memory allow. People can draw their own conclusions from them.
        </p>
      </header>

      <section className={styles.timelineIntroduction} aria-labelledby="history-timeline-title">
        <div>
          <p className={styles.eyebrow}>Timeline foundation</p>
          <h2 id="history-timeline-title">Starting with confirmed dates and places</h2>
        </div>
        <p>
          My memories are fragmented, so this timeline is being reconstructed from records and the
          details I can place with confidence. Birthdays come from my confirmed birth date, and
          residence changes come from the government registration history currently available to
          me. I will add events when they come back to me and I can place them within at least a
          general period. Approximate dates will be labelled as such, and exact addresses remain
          deliberately omitted.
        </p>
      </section>

      <ol className={styles.timeline}>
        {timeline.map((entry) => (
          <li id={entry.id} key={entry.id}>
            <div className={styles.timelineDate}>
              <span>{entry.year}</span>
              <time dateTime={entry.dateTime}>{entry.date}</time>
            </div>
            <div className={styles.timelineMarker} aria-hidden="true"><span /></div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineKind}>{timelineKindLabels[entry.kind]}</span>
              <h2>{entry.title}</h2>
              <p>{entry.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className={styles.timelineEnd} aria-label="Timeline status">
        <p className={styles.eyebrow}>Incomplete record</p>
        <p>
          These are the facts added so far, not a complete history. More events will be included as
          they can be supported by records or recalled well enough to place within a general date.
        </p>
      </section>
    </main>
  );
};

export default HistoryPage;
