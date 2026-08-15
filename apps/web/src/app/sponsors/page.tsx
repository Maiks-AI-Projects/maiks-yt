import type { Metadata } from "next";

import styles from "./sponsors.module.css";

export const metadata: Metadata = {
  title: "Sponsors and advertising",
  description:
    "How Maiks.yt should label paid placements, document campaign promises, and report delivery without hidden advertising."
};

const campaignRecord = [
  {
    title: "Who paid",
    description:
      "Name the sponsor or advertiser and describe the commercial relationship in plain language."
  },
  {
    title: "What was promised",
    description:
      "Record the placement, format, duration, stream or page context, and any important exclusions."
  },
  {
    title: "What was delivered",
    description:
      "Report display sessions, duration, location, and clearly labelled aggregate or estimated reach where available."
  },
  {
    title: "What changed",
    description:
      "Keep dated corrections when a campaign, relationship, asset, or reported result changes materially."
  }
] as const;

const relationshipLabels = [
  {
    label: "Sponsored / ad",
    meaning: "A company paid for or otherwise funded the placement."
  },
  {
    label: "Affiliate",
    meaning: "Using a link may generate income or another benefit."
  },
  {
    label: "Recommended",
    meaning: "Michael actively recommends it as his own opinion."
  },
  {
    label: "Personally used",
    meaning: "Michael has used or owned it; that alone is not a recommendation."
  }
] as const;

const SponsorsPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Commercial transparency</p>
      <h1>Paid placement should look paid.</h1>
      <p>
        Sponsorship can fund streams and projects, but it should never borrow the appearance of an
        independent opinion. The relationship, campaign context, and available delivery record
        should be visible enough for viewers to judge for themselves.
      </p>
    </header>

    <aside className={styles.statusNotice} aria-label="Sponsor system status">
      <p className={styles.sectionLabel}>Current status</p>
      <strong>No sponsor campaigns or advertising placements are published.</strong>
      <p>
        Maiks.yt is not currently presenting any company as a sponsor. Campaign management,
        overlay ad slots, delivery records, and sponsor reports are still being built.
      </p>
    </aside>

    <section className={styles.record} aria-labelledby="record-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Campaign record</p>
          <h2 id="record-heading">A sponsor promise needs evidence.</h2>
        </div>
        <p>
          A future campaign should leave enough public context to understand the relationship and
          enough private evidence to resolve delivery questions without rewriting history.
        </p>
      </header>

      <ol className={styles.recordList}>
        {campaignRecord.map((item, index) => (
          <li key={item.title}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.measurement} aria-labelledby="measurement-heading">
      <div>
        <p className={styles.sectionLabel}>Measurement boundary</p>
        <h2 id="measurement-heading">Evidence without a viewer profile.</h2>
      </div>
      <div className={styles.measurementContent}>
        <p>
          Sponsor reporting may use aggregate display sessions, total visible time, placement, and
          estimated audience size. Estimates must remain labelled as estimates rather than being
          presented as exact individual views.
        </p>
        <p>
          A campaign does not justify general page-view tracking, cross-site identity matching, or
          collecting private content. Sponsor measurement remains inside the analytics privacy
          boundary.
        </p>
        <a href="/privacy/analytics">Read the analytics boundary &rarr;</a>
      </div>
    </section>

    <section className={styles.labels} aria-labelledby="labels-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Relationship labels</p>
          <h2 id="labels-heading">Commercial and personal claims stay separate.</h2>
        </div>
        <p>
          More than one label may apply at once. A paid campaign is not automatically a personal
          recommendation, and personal use does not erase a commercial relationship.
        </p>
      </header>

      <dl className={styles.labelList}>
        {relationshipLabels.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.meaning}</dd>
          </div>
        ))}
      </dl>
      <a className={styles.textLink} href="/affiliates">Open the full affiliate disclosure &rarr;</a>
    </section>

    <section className={styles.campaigns} aria-labelledby="campaigns-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Published campaigns</p>
          <h2 id="campaigns-heading">Active and completed records</h2>
        </div>
        <p>
          When campaigns exist, this section should identify their status, sponsor, placement
          period, disclosure, and available public result or correction record.
        </p>
      </header>
      <div className={styles.emptyState}>
        <strong>No sponsor campaign records have been published.</strong>
        <p>An empty section does not imply an undisclosed campaign or payment.</p>
      </div>
    </section>
  </main>
);

export default SponsorsPage;
