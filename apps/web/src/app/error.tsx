"use client";

import Link from "next/link";

import styles from "./shared-state-pages.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = (props: ErrorPageProps): React.ReactNode => {
  void props.error;
  const { reset } = props;

  return (
    <main className={styles.pageShell} aria-live="polite">
      <section className={styles.stateCard}>
        <p className={styles.eyebrow}>Recoverable issue</p>
        <h1 className={styles.stateTitle}>I hit a small bump.</h1>
        <p>
          The page couldn&apos;t finish loading right now. Try again first, then take a lighter route
          if this keeps happening.
        </p>
        <nav className={styles.stateActions} aria-label="Error actions">
          <button className={`${styles.stateButton} ${styles.primaryAction}`} onClick={() => reset()} type="button">
            Try again
          </button>
          <Link className={styles.stateAction} href="/progress">
            Build progress
          </Link>
          <Link className={styles.stateAction} href="/">
            Home
          </Link>
        </nav>
      </section>
    </main>
  );
};

export default ErrorPage;
