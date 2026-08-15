"use client";

import Link from "next/link";

import styles from "./shared-state-pages.module.css";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const GlobalErrorPage = (props: GlobalErrorPageProps): React.ReactNode => {
  void props.error;

  const { reset } = props;

  return (
    <html>
      <body>
        <main className={styles.pageShell} aria-live="polite">
          <section className={styles.stateCard}>
            <p className={styles.eyebrow}>Site error</p>
            <h1 className={styles.stateTitle}>Something stopped this whole page load.</h1>
            <p>
              This looks like a temporary runtime issue. You can retry once, then move back to the
              pages that are available now.
            </p>
            <nav className={styles.stateActions} aria-label="Global error actions">
              <button
                className={`${styles.stateButton} ${styles.primaryAction}`}
                onClick={() => reset()}
                type="button"
              >
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
      </body>
    </html>
  );
};

export default GlobalErrorPage;
