import type { Metadata } from "next";
import Image from "next/image";

import { AboutNavigation } from "../about-navigation";
import styles from "../about.module.css";
import { HealthTimeline } from "../health-timeline";

export const metadata: Metadata = {
  title: "Medical history",
  description: "Michael's general health context and how a brain tumor affected streaming."
};

const HealthPage = (): React.ReactNode => (
  <main className={styles.page}>
    <AboutNavigation current="health" />

    <header className={styles.intro}>
      <p className={styles.eyebrow}>Medical history</p>
      <h1>I have a serious brain tumor.</h1>
      <p className={styles.lead}>
        I stopped streaming while undergoing treatment and therapy. This page records that part of
        my life and the medical events around it.
      </p>
    </header>

    <section className={styles.proseBand} aria-labelledby="health-streaming-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>Daily life</p>
        <h2 id="health-streaming-title">Treatment changed my routine</h2>
      </div>
      <div className={styles.prose}>
        <p>
          My health can affect how much energy I have and whether a planned stream is realistic.
          Streams may therefore be irregular, shorter than expected, delayed, changed, or
          cancelled.
        </p>
        <p>
          I am building Maiks.yt while preparing to return. The scheduling, updates, and stream
          controls are practical tools for doing that work.
        </p>
      </div>
    </section>

    <section className={`${styles.imageBand} ${styles.alternateBand}`} aria-labelledby="health-image-title">
      <div className={styles.imageIntroduction}>
        <p className={styles.eyebrow}>A visible reality</p>
        <h2 id="health-image-title">My latest MRI, for now</h2>
        <p>
          The labels describe the areas as I understand them. This image is part of the record, not
          medical guidance or a diagnostic explanation.
        </p>
      </div>
      <figure className={styles.mriFigure}>
        <Image
          alt="Annotated MRI image with labels identifying removed tissue and Michael's tumor."
          height={1300}
          sizes="(max-width: 760px) 100vw, 1180px"
          src="/images/health/latest-mri-annotated.png"
          width={1500}
        />
        <figcaption>
          Temporary annotated photograph of a monitor. Michael plans to replace it with a clean
          exported image after a future hospital visit.
        </figcaption>
      </figure>
    </section>

    <HealthTimeline />

    <section className={styles.proseBand} aria-labelledby="health-boundaries-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>Scope</p>
        <h2 id="health-boundaries-title">A factual summary, not an argument</h2>
      </div>
      <div className={styles.prose}>
        <p>
          This page records the larger medical events that affect my life. It is not here to defend
          my choices or ask the reader to reach a particular conclusion.
        </p>
        <p>
          It will stay focused on verified events and broad yearly summaries. Routine visits and
          unnecessary private details do not need to become public entries.
        </p>
      </div>
    </section>
  </main>
);

export default HealthPage;
