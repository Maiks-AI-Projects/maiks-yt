import type { Metadata } from "next";

import styles from "./support.module.css";

export const metadata: Metadata = {
  title: "Support and transparency",
  description:
    "How future support on Maiks.yt should be allocated, reported, corrected, and kept voluntary."
};

const supportPromises = [
  {
    title: "A named destination",
    description:
      "Support should identify the project, item, or general purpose it is intended for before anyone pays."
  },
  {
    title: "The costs around it",
    description:
      "Provider fees, platform splits, taxes, and other known deductions should not be disguised as money available to spend."
  },
  {
    title: "Rules for changed plans",
    description:
      "If a goal changes materially, the original allocation and the available redirect, credit, or refund path should remain understandable."
  },
  {
    title: "A useful public outcome",
    description:
      "Public reporting should show progress and material corrections without exposing private donor, payment, or accounting records."
  }
] as const;

const moneyTrail = [
  {
    label: "Received",
    description: "Record the original amount, currency, source, and applicable provider costs."
  },
  {
    label: "Allocated",
    description: "Connect the usable value to its stated project, item, or approved purpose."
  },
  {
    label: "Changed",
    description: "Add a dated record for a correction, redirection, refund, or chargeback."
  },
  {
    label: "Reported",
    description: "Publish understandable totals and outcomes while the private ledger keeps the evidence."
  }
] as const;

const SupportPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Support and transparency</p>
      <h1>Support should never be a blind payment.</h1>
      <p>
        If Maiks.yt accepts money, the purpose, costs, changes, and outcome should remain traceable.
        Support must stay voluntary, understandable, and separate from access to the community.
      </p>
    </header>

    <aside className={styles.statusNotice} aria-label="Support system status">
      <div>
        <p className={styles.sectionLabel}>Current status</p>
        <strong>Payments and public support destinations are not open yet.</strong>
      </div>
      <p>
        There is no active checkout, donation link, public balance, or fundraising total on this
        site. Private accounting tools are being developed separately, but they do not receive or
        promise public support.
      </p>
    </aside>

    <section className={styles.promises} aria-labelledby="promises-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Before support opens</p>
          <h2 id="promises-heading">What you should know before giving.</h2>
        </div>
        <p>
          These requirements apply whether support eventually arrives through a direct payment,
          platform subscription, Bits, membership, credit, or another provider.
        </p>
      </header>

      <ol className={styles.promiseList}>
        {supportPromises.map((promise, index) => (
          <li key={promise.title}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <strong>{promise.title}</strong>
            <p>{promise.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.trail} aria-labelledby="trail-heading">
      <div className={styles.trailHeading}>
        <p className={styles.sectionLabel}>Money trail</p>
        <h2 id="trail-heading">Changes add records. They do not rewrite the past.</h2>
        <p>
          The planned accounting model keeps the original event and adds dated corrections. That
          makes fees, reallocations, refunds, and disputes visible instead of silently changing an
          old total.
        </p>
      </div>
      <ol className={styles.trailList}>
        {moneyTrail.map((step, index) => (
          <li key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.boundaries} aria-labelledby="boundaries-heading">
      <div>
        <p className={styles.sectionLabel}>Opening conditions</p>
        <h2 id="boundaries-heading">What still has to be decided.</h2>
      </div>
      <div className={styles.boundaryContent}>
        <p>
          A payment provider, fee model, currency handling, guest-support policy, refund and
          chargeback rules, project-allocation behavior, and public reporting boundary all need to
          be reviewed before accepting money. One or more ongoing court cases also need to conclude
          before this support system can be used as intended; no case details or conclusions are
          published here while those matters remain ongoing.
        </p>
        <p>
          Platform support such as Twitch Bits, subscriptions, and YouTube memberships should be
          recorded as platform-derived value with the estimated or confirmed creator share. It
          should not be presented as if the full viewer payment arrived here.
        </p>
        <div className={styles.relatedLinks}>
          <a href="/projects">See current projects &rarr;</a>
          <a href="/accountability">Read the accountability standard &rarr;</a>
        </div>
      </div>
    </section>
  </main>
);

export default SupportPage;
