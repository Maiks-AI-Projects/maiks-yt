import type { Metadata } from "next";

import { AboutNavigation } from "../about-navigation";
import styles from "../about.module.css";

export const metadata: Metadata = {
  title: "AI and my work",
  description: "How Michael uses AI assistance on Maiks.yt while keeping the public work under his own direction and responsibility."
};

const AiPage = (): React.ReactNode => (
  <main className={styles.page}>
    <AboutNavigation current="ai" />

    <header className={`${styles.intro} ${styles.aiIntro}`}>
      <p className={styles.eyebrow}>AI and my work</p>
      <h1>I use AI. I stay responsible.</h1>
      <p className={styles.lead}>
        Maiks.yt, including the website and stream overlays, was built with AI assistance under my
        direction. I use it much like notes, checklists, search, and code tools: to keep more work
        reachable.
      </p>
    </header>

    <section className={`${styles.proseBand} ${styles.aiBand}`} aria-labelledby="ai-help-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>What AI helps with</p>
        <h2 id="ai-help-title">A tool under my direction</h2>
      </div>
      <div className={styles.prose}>
        <p>
          My memory, focus, energy, and planning are not always steady. AI helps me break work down,
          compare options, draft and rewrite text, remember what changed, and organize streams. I
          decide what to use, what to change, and what belongs on Maiks.yt.
        </p>
      </div>
    </section>

    <section
      className={`${styles.proseBand} ${styles.aiBand} ${styles.alternateBand}`}
      aria-labelledby="ai-mine-title"
    >
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>What stays mine</p>
        <h2 id="ai-mine-title">The stream is still me</h2>
      </div>
      <div className={styles.prose}>
        <p>
          The gameplay, voice, reactions, decisions, live camera, and live footage are real and mine.
          AI can help me prepare and organize, but it does not make those choices for me. I am
          responsible for what I publish and what happens on my stream.
        </p>
      </div>
    </section>

    <section className={`${styles.proseBand} ${styles.aiBand}`} aria-labelledby="ai-limits-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>Current limits</p>
        <h2 id="ai-limits-title">No live AI host</h2>
      </div>
      <div className={styles.prose}>
        <p>
          Today, AI is not speaking on stream, posting as me, moderating viewers, or controlling what
          viewers see. The current homepage workspace image was generated and is temporary. Other
          visual and audio assets have not all been inventoried yet.
        </p>
      </div>
    </section>

    <section className={styles.aiClosing} aria-label="Personal choice">
      <p>
        Some people do not want to use AI or watch AI-assisted work. I respect that choice. I ask for
        the same respect for mine.
      </p>
      <a className={styles.textLink} href="/about/health">Read the medical context -&gt;</a>
    </section>
  </main>
);

export default AiPage;
