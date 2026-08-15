import Image from "next/image";

import styles from "./not-found.module.css";

const recoveryLinks = [
  {
    href: "/",
    label: "Home",
    description: "Start again from the main Maiks.yt page."
  },
  {
    href: "/progress",
    label: "Build progress",
    description: "See what exists, what is being built, and what comes later."
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Open the current public work, milestones, and updates."
  },
  {
    href: "/schedule",
    label: "Schedule",
    description: "Check the current stream plans and cancellations."
  }
] as const;

const NotFoundPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.errorHeader}>
      <p>Error 404</p>
      <strong>Page not found</strong>
    </header>

    <section className={styles.hero} aria-labelledby="not-found-heading">
      <div className={styles.message}>
        <p className={styles.eyebrow}>Unknown destination</p>
        <h1 id="not-found-heading">Did you break it, or did I?</h1>
        <p>
          It could be a typo, an old link, or a page I moved while building the site. Either way,
          you do not need to stay lost.
        </p>
      </div>
      <Image
        alt="A dark page torn open to reveal code reporting a missing route"
        className={styles.image}
        height={1051}
        priority
        sizes="(max-width: 760px) 100vw, 1080px"
        src="/images/system/not-found-torn-route.png"
        unoptimized
        width={1497}
      />
    </section>

    <section className={styles.diagnosis} aria-labelledby="diagnosis-heading">
      <div>
        <p className={styles.sectionLabel}>Quick diagnosis</p>
        <h2 id="diagnosis-heading">Let us split the blame fairly.</h2>
      </div>
      <div className={styles.diagnosisList}>
        <p>
          <strong>If you typed the address,</strong> check the spelling, spaces, and anything after
          the final slash.
        </p>
        <p>
          <strong>If a Maiks.yt link sent you here,</strong> I probably broke it. The build-progress
          page may show where that page is supposed to live now.
        </p>
      </div>
    </section>

    <nav className={styles.recovery} aria-label="Not-found recovery links">
      <p className={styles.sectionLabel}>Useful exits</p>
      <ul>
        {recoveryLinks.map((link, index) => (
          <li key={link.href}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <a href={link.href}>{link.label} &rarr;</a>
              <p>{link.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  </main>
);

export default NotFoundPage;
