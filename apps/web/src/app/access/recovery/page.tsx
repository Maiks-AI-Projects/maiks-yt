import Image from "next/image";
import type { Metadata } from "next";

import AccessRecoveryClient from "./access-recovery-client";
import { resolveAccessRecoveryReturnTarget } from "./access-recovery.rules";
import styles from "./access-recovery.module.css";

export const metadata: Metadata = {
  title: "PWA Access Recovery",
  description: "Renew Maiks.yt sign-in for an installed stream tool window."
};

type AccessRecoveryPageProps = {
  readonly searchParams?: Promise<{
    readonly returnTo?: string | string[];
  }>;
};

const firstSearchParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const AccessRecoveryPage = async ({
  searchParams
}: AccessRecoveryPageProps): Promise<React.ReactNode> => {
  const params = await searchParams;
  const returnTarget = resolveAccessRecoveryReturnTarget(firstSearchParam(params?.returnTo));

  return (
    <main className={styles.recoveryPage}>
      <section className={styles.hero} aria-labelledby="access-recovery-title">
        <div className={styles.brandRow}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.logo}
            height={64}
            priority
            src="/brand/icon-64.png"
            unoptimized
            width={64}
          />
          <p className={styles.eyebrow}>Maiks.yt access recovery</p>
        </div>
        <h1 className={styles.title} id="access-recovery-title">Get back into your PWA.</h1>
        <p className={styles.copy}>
          This page only renews your main Maiks.yt account sign-in. It does not copy the installed
          window&apos;s launch token into this site, the OAuth request, page text, or browser storage.
        </p>
        <ul className={styles.boundaryList}>
          <li>The return target must be a known Maiks.yt PWA path.</li>
          <li>The installed window checks its saved launch token again after you return.</li>
          <li>Access can still expire or be revoked independently of this sign-in.</li>
        </ul>
      </section>
      <AccessRecoveryClient initialReturnTo={returnTarget} />
    </main>
  );
};

export default AccessRecoveryPage;
