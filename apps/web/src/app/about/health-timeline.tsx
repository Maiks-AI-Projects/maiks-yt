import styles from "./about.module.css";
import { healthTimeline } from "./health-timeline-data";

export const HealthTimeline = (): React.ReactNode => (
  <section className={styles.healthTimelineSection} aria-labelledby="health-timeline-title">
    <header className={styles.healthTimelineHeading}>
      <div>
        <p className={styles.eyebrow}>Medical timeline</p>
        <h2 id="health-timeline-title">The larger events and the years around them</h2>
      </div>
      <div>
        <p>
          My memories are fragmented, so this summary was reconstructed from the records currently
          available from two hospitals and my GP. It combines obvious duplicate entries instead of
          counting the same care twice.
        </p>
        <p>
          A plus sign means <strong>at least</strong> that many records were found. Missing years or
          lower numbers do not prove that no other care occurred. I will add details when they come
          back to me and I can place them within at least a general period; approximate dates will
          be labelled as such.
        </p>
      </div>
    </header>

    <ol className={styles.healthTimeline}>
      {healthTimeline.map((entry) => (
        <li key={entry.year}>
          <div className={styles.healthTimelineYear}>{entry.year}</div>
          <div className={styles.healthTimelineContent}>
            <h3>{entry.title}</h3>
            <p>{entry.summary}</p>
            <ul className={styles.healthMetrics} aria-label={`Documented care during ${entry.year}`}>
              {entry.metrics.map((metric) => (
                <li key={`${metric.value}-${metric.label}`}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  </section>
);
