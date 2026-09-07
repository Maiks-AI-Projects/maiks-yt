import { createDateFormatter, defaultLocale } from "@maiks-yt/config";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageMarkdown } from "../../page-markdown";
import {
  formatPublicUpdateKind,
  getPublicUpdate
} from "../public-update-data";
import styles from "../updates.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = createDateFormatter(defaultLocale);

type UpdatePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const UpdatePage = async ({ params }: UpdatePageProps): Promise<React.ReactNode> => {
  const { slug } = await params;
  const result = await getPublicUpdate(slug);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.stateBand}>
          <p className={styles.eyebrow}>Updates</p>
          <h1>This update is temporarily unavailable.</h1>
          <p>The website could not reach the updates service. Please try again later.</p>
          <Link className={styles.backLink} href="/updates">Back to all updates</Link>
        </section>
      </main>
    );
  }

  const { update } = result;

  return (
    <main className={styles.page}>
      <article>
        <header className={styles.detailHeader}>
          <Link className={styles.backLink} href="/updates">Back to all updates</Link>
          <p className={styles.eyebrow}>{formatPublicUpdateKind(update.kind)}</p>
          <h1>{update.title}</h1>
          <p className={styles.detailSummary}>{update.summary}</p>
          <div className={styles.detailMeta}>
            <time dateTime={update.publishedAt}>
              {dateFormatter.format(new Date(update.publishedAt))}
            </time>
            {update.isPinned ? <span className={styles.pinned}>Pinned</span> : null}
          </div>
        </header>

        <div className={styles.detailBody}>
          <aside className={styles.bodyLabel} aria-label="Publication note">
            <p className={styles.sectionLabel}>The update</p>
            <p>Published as part of the permanent Maiks.yt update archive.</p>
          </aside>
          <div className={styles.articleBody}>
            <PageMarkdown body={update.body} />
          </div>
        </div>
      </article>
    </main>
  );
};

export default UpdatePage;
