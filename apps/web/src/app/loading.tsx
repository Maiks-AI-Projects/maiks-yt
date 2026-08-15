import Link from "next/link";

import styles from "./shared-state-pages.module.css";

const LoadingStatusActions = (): React.ReactNode => (
  <nav className={styles.stateActions} aria-label="Loading actions">
    <Link className={styles.stateAction} href="/">
      Home
    </Link>
    <Link className={styles.stateAction} href="/progress">
      Build progress
    </Link>
  </nav>
);

const LoadingPage = (): React.ReactNode => (
  <main className={styles.pageShell} aria-live="polite">
    <section className={styles.stateCard}>
      <p className={styles.eyebrow}>Loading</p>
      <h1 className={styles.stateTitle}>Getting the page ready.</h1>
      <p>
        I&apos;m loading the page content now. We keep it plain and fast, and this should pass
        quickly.
      </p>
      <p className={styles.spinnerWrap}>
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.statusText}>Fetching fresh live data.</span>
      </p>
      <LoadingStatusActions />
    </section>
  </main>
);

export default LoadingPage;
