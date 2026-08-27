import type { PublicUpdateDetail } from "@maiks-yt/domain/updates";

import { PageMarkdown } from "../../page-markdown";
import {
  formatDateTime,
  formatUpdateKind
} from "./public-update-admin.rules";
import styles from "./public-update-admin.module.css";

type PublicUpdateAdminPreviewProps = {
  preview: PublicUpdateDetail;
  previewIsCurrent: boolean;
};

const PublicUpdateAdminPreview = ({
  preview,
  previewIsCurrent
}: PublicUpdateAdminPreviewProps): React.ReactNode => (
  <section className={styles.previewPanel} aria-labelledby="saved-update-preview-heading">
    <div className={styles.previewHeading}>
      <div>
        <h3 id="saved-update-preview-heading">Saved public preview</h3>
        <p>This is how the saved revision will appear publicly.</p>
      </div>
      <span data-current={previewIsCurrent}>
        {previewIsCurrent ? "Current" : "Not checked"}
      </span>
    </div>
    <article className={styles.previewArticle}>
      <header>
        <span className={styles.previewKind}>{formatUpdateKind(preview.kind)}</span>
        <h3>{preview.title}</h3>
        <p>{preview.summary}</p>
        <div className={styles.previewMeta}>
          <time dateTime={preview.publishedAt}>{formatDateTime(preview.publishedAt)}</time>
          {preview.isPinned ? <span>Pinned</span> : null}
        </div>
      </header>
      <PageMarkdown body={preview.body} />
    </article>
  </section>
);

export default PublicUpdateAdminPreview;
