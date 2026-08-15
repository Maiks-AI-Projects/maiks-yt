import type { Metadata } from "next";

import styles from "./affiliates.module.css";

export const metadata: Metadata = {
  title: "Affiliate disclosure",
  description:
    "How Maiks.yt labels affiliate links, personal recommendations, firsthand use, and paid placements."
};

const disclosureLabels = [
  {
    label: "Affiliate",
    kind: "commercial",
    title: "May generate income or another benefit",
    description:
      "Using the link may pay Michael a commission, credit, product, or other benefit. This label does not mean he recommends the product."
  },
  {
    label: "Recommended",
    kind: "editorial",
    title: "Michael actively recommends it",
    description:
      "This records Michael's opinion. If a commercial relationship also exists, both labels must appear."
  },
  {
    label: "Personally used",
    kind: "editorial",
    title: "Used or owned by Michael",
    description:
      "This describes firsthand experience. It is not automatically a recommendation and does not say whether the link produces income."
  },
  {
    label: "Sponsored / ad",
    kind: "commercial",
    title: "Paid placement or campaign",
    description:
      "A company paid for or otherwise funded the placement. The disclosure should be clearly visible wherever the message or link appears."
  }
] as const;

const AffiliatesPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Affiliate disclosure</p>
      <h1>Know when a link can pay me.</h1>
      <p>
        Commercial relationships, personal recommendations, and firsthand use are separate facts
        on Maiks.yt. Every applicable label should appear before someone follows a link.
      </p>
    </header>

    <aside className={styles.statusNotice} aria-label="Affiliate system status">
      <p className={styles.sectionLabel}>Current status</p>
      <strong>No affiliate or income links are published on Maiks.yt yet.</strong>
      <p>
        The public label system exists as a disclosure standard. The affiliate manager, partner
        records, product feeds, and income reporting are still being built.
      </p>
    </aside>

    <section className={styles.labels} aria-labelledby="labels-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Disclosure labels</p>
          <h2 id="labels-heading">Four labels, four different claims.</h2>
        </div>
        <p>
          More than one label can apply to the same link. Showing every applicable label keeps a
          commercial relationship separate from Michael's actual experience or opinion.
        </p>
      </header>

      <ol className={styles.labelList}>
        {disclosureLabels.map((item, index) => (
          <li className={styles.labelRow} key={item.label}>
            <span className={styles.labelNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.labelIdentity}>
              <span className={styles.labelTag} data-kind={item.kind}>{item.label}</span>
              <h3>{item.title}</h3>
            </div>
            <p>{item.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.policy} aria-labelledby="policy-heading">
      <div>
        <p className={styles.sectionLabel}>Placement policy</p>
        <h2 id="policy-heading">Disclosure stays beside the decision.</h2>
      </div>
      <div className={styles.policyContent}>
        <p>
          <strong>If a link can provide money, credit, a free product, or another benefit,</strong>{" "}
          that relationship is identified near the link itself. It is not hidden in a site-wide
          footer.
        </p>
        <p>
          An affiliate label is not a recommendation. A recommendation label is not proof that no
          commercial relationship exists. Every applicable fact should be visible.
        </p>
        <p>
          Prices, availability, and product terms can change after publication. The store or
          provider page remains the source for the current offer.
        </p>
        <a
          className={styles.textLink}
          href="https://www.acm.nl/nl/publicaties/extra-maatregelen-nodig-voor-minderjarigen-om-influencer-reclame-te-kunnen-herkennen"
          rel="noreferrer"
          target="_blank"
        >
          Dutch guidance on recognizable commercial influence &rarr;
        </a>
      </div>
    </section>

    <section className={styles.currentState} aria-labelledby="relationships-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Published relationships</p>
          <h2 id="relationships-heading">Active links and partners</h2>
        </div>
        <p>
          Future entries should identify the partner, the commercial relationship, the applicable
          labels, and whether the link is still active.
        </p>
      </header>
      <div className={styles.emptyState}>
        <strong>No affiliate, sponsored, or other income-producing links are active.</strong>
        <p>This list will use live records when the affiliate management system is connected.</p>
      </div>
    </section>
  </main>
);

export default AffiliatesPage;
