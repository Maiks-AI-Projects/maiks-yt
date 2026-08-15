import Link from "next/link";
import { communityRules, moderationSteps } from "./community-rules-data";
import styles from "./community-rules.module.css";

export const metadata = {
  title: "Community Participation | Maiks.yt",
  description: "The shared expectations and human-reviewed moderation approach for Maiks.yt."
};

const CommunityRulesPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Community participation</p>
      <h1>A place people can join without giving up their boundaries.</h1>
      <p className={styles.introText}>
        Watching, reading, and following public work should not require an account. When people choose to participate,
        these shared expectations keep the website, streams, and connected communities usable.
      </p>
      <p className={styles.draftNote}>
        This is the working public policy. Its wording can be clarified as the community grows, but changes should not
        quietly rewrite how earlier situations were judged.
      </p>
    </header>

    <section className={styles.principles} aria-labelledby="short-version-heading">
      <div>
        <p className={styles.sectionLabel}>The short version</p>
        <h2 id="short-version-heading">Participate freely. Do not take that freedom from someone else.</h2>
      </div>
      <dl className={styles.principleList}>
        <div>
          <dt>Access</dt>
          <dd>Public content stays open wherever an account is not genuinely needed.</dd>
        </div>
        <div>
          <dt>Choice</dt>
          <dd>Accounts and public stream interactions are optional, with privacy controls where identity is involved.</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>Disagreement is allowed. Harassment, fraud, exposure of private information, and deliberate disruption are not.</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>Moderation decisions should keep context, remain reviewable, and be corrected when the facts change.</dd>
        </div>
      </dl>
    </section>

    <section className={styles.rulesSection} aria-labelledby="rules-heading">
      <div className={styles.sectionHeading}>
        <h2 id="rules-heading">Six shared rules</h2>
        <div>
          <p className={styles.sectionLabel}>Across the platform</p>
          <p>
            These apply to chat, profiles, display names, linked accounts, overlays, website interactions, and
            money-adjacent features. Context matters, but the basic boundaries should not depend on the surface.
          </p>
        </div>
      </div>

      <ol className={styles.ruleList}>
        {communityRules.map((rule, index) => (
          <li className={styles.rule} key={rule.title}>
            <span className={styles.ruleNumber}>{String(index + 1).padStart(2, "0")}</span>
            <h3>{rule.title}</h3>
            <p>{rule.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.moderationSection} aria-labelledby="moderation-heading">
      <div className={styles.sectionHeading}>
        <h2 id="moderation-heading">A human-reviewed response</h2>
        <div>
          <p className={styles.sectionLabel}>Normal moderation path</p>
          <p>
            The response should fit the situation. A note is not a punishment, a warning should explain what needs to
            change, and restrictions should protect a shared space without becoming an automatic permanent decision.
          </p>
        </div>
      </div>

      <ol className={styles.stepList}>
        {moderationSteps.map((step) => (
          <li className={styles.step} key={step.title}>
            <span className={styles.stepLabel}>{step.label}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>

      <p className={styles.threshold}>
        <strong>Three active strikes trigger owner review, not an automatic ban.</strong> Severe safety incidents can
        still require an immediate temporary response while the facts are reviewed.
      </p>
    </section>

    <section className={styles.reviewSection} aria-labelledby="review-heading">
      <div className={styles.reviewLead}>
        <p className={styles.sectionLabel}>Accountability goes both ways</p>
        <h2 id="review-heading">Moderation should be correctable.</h2>
        <p>
          Accounts can be hacked, context can be missed, and another person may have used someone&apos;s device. Warnings,
          strikes, and restrictions should retain enough context for a later review.
        </p>
        <Link className={styles.progressLink} href="/progress#community-participation">
          Follow the community system progress
        </Link>
      </div>

      <div className={styles.reviewPoints}>
        <article className={styles.reviewPoint}>
          <h3>What helpers can do</h3>
          <p>
            Helpers and moderators can monitor shared spaces and use only the tools granted to their role. Their access
            should stay narrow, visible, and removable.
          </p>
        </article>
        <article className={styles.reviewPoint}>
          <h3>What remains an owner decision</h3>
          <p>
            Permanent bans, serious appeals, role authority, private account access, secrets, and money decisions stay
            with Michael unless a reviewed permission explicitly delegates them.
          </p>
        </article>
        <article className={styles.reviewPoint}>
          <h3>What is still being built</h3>
          <p>
            Account-visible warnings and strikes, appeals, offensive-name handling, and consistent enforcement across
            every connected provider are not complete yet. The public rules do not pretend those systems are finished.
          </p>
        </article>
      </div>
    </section>
  </main>
);

export default CommunityRulesPage;
