import { telemetryEventDefinitions } from "@maiks-yt/config";
import type { Metadata } from "next";

import styles from "./analytics.module.css";

export const metadata: Metadata = {
  title: "Analytics and privacy",
  description: "The limited telemetry Maiks.yt permits, why it exists, and how long it may remain."
};

const dataClassLabels = {
  operational: "Detect service failures",
  security: "Protect accounts and access",
  "sponsor-aggregate": "Count promised sponsor visibility"
} as const;

const privacyFacts = [
  {
    title: "No general page-view tracking",
    description: "Ordinary visits are not turned into a general browsing timeline."
  },
  {
    title: "No cross-site profile",
    description: "Activity here is not joined to an advertising identity elsewhere."
  },
  {
    title: "No sale of personal data",
    description: "Personal information is not treated as a product for data brokers or advertisers."
  },
  {
    title: "Sensitive content stays out",
    description: "Message text, medical details, and sensitive profile fields are excluded."
  }
] as const;

const AnalyticsPrivacyPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Analytics privacy</p>
      <h1>Only what the service needs.</h1>
      <p>
        Maiks.yt uses an explicit telemetry allowlist. It permits limited operational, security,
        and aggregate sponsor events instead of recording every visit or interaction by default.
      </p>
    </header>

    <section className={styles.principles} aria-label="Privacy summary">
      <ul className={styles.factList}>
        {privacyFacts.map((fact, index) => (
          <li key={fact.title}>
            <span className={styles.factNumber}>{String(index + 1).padStart(2, "0")}</span>
            <strong>{fact.title}</strong>
            <p>{fact.description}</p>
          </li>
        ))}
      </ul>
    </section>

    <section className={styles.telemetry} aria-labelledby="telemetry-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Explicit allowlist</p>
          <h2 id="telemetry-heading">Permitted telemetry</h2>
        </div>
        <p>
          These are the event names the current design permits. Being listed means an event may be
          recorded when the relevant feature is active; it does not mean every event is constantly
          being collected.
        </p>
      </header>

      <table className={styles.telemetryTable}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Reason</th>
            <th>Maximum retention</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(telemetryEventDefinitions).map(([eventName, definition]) => (
            <tr key={eventName}>
              <td><code>{eventName}</code></td>
              <td>{dataClassLabels[definition.dataClass]}</td>
              <td>{definition.retentionDays} days</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <section className={styles.boundaries} aria-labelledby="boundaries-heading">
      <div>
        <p className={styles.sectionLabel}>Boundaries</p>
        <h2 id="boundaries-heading">Telemetry is not the same as feature data.</h2>
      </div>
      <div className={styles.boundaryContent}>
        <p>
          <strong>This allowlist excludes private content.</strong> Chat message text, private
          messages, medical information, and sensitive profile data do not belong in these
          telemetry events.
        </p>
        <p>
          Account details, linked providers, posts, schedules, and other information deliberately
          saved to use a feature have their own purpose. They should not be quietly repurposed as
          general analytics.
        </p>
        <p className={styles.boundaryNote}>
          Sponsor impressions and clicks are permitted only as aggregate reporting. If no sponsor
          reporting is active, the allowlist does not require those events to be collected.
        </p>
      </div>
    </section>
  </main>
);

export default AnalyticsPrivacyPage;
