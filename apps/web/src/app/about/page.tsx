import type { Metadata } from "next";

import { AboutNavigation } from "./about-navigation";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About Michael",
  description: "A straightforward introduction to Michael and why he is building Maiks.yt."
};

const AboutPage = (): React.ReactNode => (
  <main className={styles.page}>
    <AboutNavigation current="about" />

    <header className={styles.intro}>
      <p className={styles.eyebrow}>Who I am now</p>
      <h1>I'm Michael.</h1>
      <p className={styles.lead}>
        I am building my way back to streaming, and Maiks.yt is the place where the streams,
        projects, community, and work behind that return can live together.
      </p>
    </header>

    <section className={styles.proseBand} aria-labelledby="about-present-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>The present</p>
        <h2 id="about-present-title">More than one channel or one kind of project</h2>
      </div>
      <div className={styles.prose}>
        <p>
          My interests move between games, technology, software, streaming, and practical projects.
          I do not want each interest to become an isolated account with a different version of me
          behind it. This website is the shared home underneath all of them.
        </p>
        <p>
          The platform itself is also part of the work. I am building the website, stream overlays,
          control tools, community features, and the systems that make progress and decisions easier
          to explain honestly.
        </p>
      </div>
    </section>

    <section className={`${styles.proseBand} ${styles.alternateBand}`} aria-labelledby="about-return-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>Why now</p>
        <h2 id="about-return-title">Streaming had to stop. The wish to return did not.</h2>
      </div>
      <div className={styles.prose}>
        <p>
          I stopped streaming while undergoing treatment and therapy. I am now creating the
          platform and practical tools I want available when I return.
        </p>
        <p>
          Health is one part of the record. The games, ideas, work, mistakes, changes, and people in
          my life belong here too.
        </p>
        <a className={styles.textLink} href="/about/health">Read the medical context &rarr;</a>
      </div>
    </section>

    <section className={styles.proseBand} aria-labelledby="about-values-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>What matters here</p>
        <h2 id="about-values-title">Open progress, human control, and room for context</h2>
      </div>
      <div className={styles.prose}>
        <p>
          You should be able to watch, read, and understand the work without being forced to make an
          account. Plans should not be presented as finished work. Automation can assist, but people
          should remain in control of public, moderation, privacy, and financial decisions.
        </p>
        <p>
          I also want to tell my own history directly. That includes good years, difficult years,
          mistakes, failed attempts, changes, and the parts I am still working out. The history page
          starts small and will grow only from details I have deliberately chosen to publish.
        </p>
        <a className={styles.textLink} href="/about/history">Open the history timeline &rarr;</a>
      </div>
    </section>
  </main>
);

export default AboutPage;
