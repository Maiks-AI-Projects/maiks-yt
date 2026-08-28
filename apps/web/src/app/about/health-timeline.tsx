import styles from "./about.module.css";
import { healthTimeline } from "./health-timeline-data";

export const HealthTimeline = (): React.ReactNode => (
  <section className={styles.healthTimelineSection} aria-labelledby="health-timeline-title">
    <header className={styles.healthTimelineHeading}>
      <div>
        <p className={styles.eyebrow}>Tumor timeline</p>
        <h2 id="health-timeline-title">Starting with the confirmed 2017 record</h2>
      </div>
      <div>
        <p>
          My memories are fragmented, so this summary was reconstructed from the records currently
          available from two hospitals and my GP. It is limited to the tumor, treatment,
          monitoring, and practical effects that help explain the current situation.
        </p>
        <p>
          A plus sign means <strong>at least</strong> that many records were found. Missing years or
          lower numbers do not prove that no other care occurred. Older fractures, unrelated
          injuries, routine visits, and private details are not rendered here unless they become
          useful context for understanding me now.
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
