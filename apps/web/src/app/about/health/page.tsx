import type { Metadata } from "next";
import Image from "next/image";

import { AboutNavigation } from "../about-navigation";
import styles from "../about.module.css";
import { HealthTimeline } from "../health-timeline";

export const metadata: Metadata = {
  title: "Health context",
  description: "Michael's current health context and how it can affect streaming and collaboration."
};

const HealthPage = (): React.ReactNode => (
  <main className={styles.page}>
    <AboutNavigation current="health" />

    <header className={styles.intro}>
      <p className={styles.eyebrow}>Medical context</p>
      <h1>Context that may help you understand me.</h1>
      <p className={styles.lead}>
        I have a brain tumor, brain damage, and ADHD. This page is here because knowing
        that can make irregular streams, changed plans, and uneven communication easier to place.
      </p>
    </header>

    <section className={styles.proseBand} aria-labelledby="health-streaming-title">
      <div className={styles.sectionLabel}>
        <p className={styles.eyebrow}>Current effects</p>
        <h2 id="health-streaming-title">What you may notice</h2>
      </div>
      <div className={styles.prose}>
        <p>
          My memory, focus, energy, and communication can be inconsistent. I may forget details,
          reply slowly, lose the thread of a plan, need more recovery time than expected, or cancel
          something that looked realistic when it was scheduled.
        </p>
        <p>
          An inconsistent reply or changed plan is not a reliable signal of my interest in a stream,
          collaboration, or conversation. The tumor, brain damage, treatment, or ADHD may be
          affecting the amount I can hold at once. Streaming can therefore be irregular, shorter
          than planned, delayed, changed, or cancelled.
        </p>
        <p>
          Clear written details help. So do reminders, repeated information when something matters,
          and room for plans to change.
        </p>
      </div>
    </section>

    <section className={`${styles.imageBand} ${styles.alternateBand}`} aria-labelledby="health-image-title">
      <div className={styles.imageIntroduction}>
        <p className={styles.eyebrow}>Current record</p>
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
        <h2 id="health-boundaries-title">Useful context, not every detail</h2>
      </div>
      <div className={styles.prose}>
        <p>
          This page provides practical context for streams, collaboration, and ordinary interaction
          with me. It is a selected account of the current situation, not a complete medical record
          or an argument.
        </p>
        <p>
          The timeline keeps selected verified events and broad yearly summaries. It does not list
          every appointment, every private detail, or old medical history that does not help explain
          the current situation. It is also not medical advice.
        </p>
      </div>
    </section>
  </main>
);

export default HealthPage;
