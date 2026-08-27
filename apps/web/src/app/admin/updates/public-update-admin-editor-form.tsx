import {
  publicUpdateBodyMaxLength,
  publicUpdateSummaryMaxLength,
  publicUpdateTitleMaxLength
} from "@maiks-yt/domain/updates";
import type { PublicUpdateSource } from "@maiks-yt/domain/updates";

import {
  formatDateTime,
  formatUpdateKind,
  updateKindOptions,
  type UpdateFormState
} from "./public-update-admin.rules";
import styles from "./public-update-admin.module.css";

type PublicUpdateAdminEditorFormProps = {
  editorIsReadOnly: boolean;
  form: UpdateFormState;
  formIssue: string | null;
  lineCount: number;
  onSaveDraft: () => Promise<void>;
  onUpdateForm: (updater: (current: UpdateFormState) => UpdateFormState) => void;
  selectedUpdate: PublicUpdateSource | null;
  wordCount: number;
};

const slugMaxLength = 191;

const PublicUpdateAdminEditorForm = ({
  editorIsReadOnly,
  form,
  formIssue,
  lineCount,
  onSaveDraft,
  onUpdateForm,
  selectedUpdate,
  wordCount
}: PublicUpdateAdminEditorFormProps): React.ReactNode => (
  <form
    className={styles.form}
    id="public-update-editor-form"
    onSubmit={(event) => {
      event.preventDefault();
      void onSaveDraft();
    }}
  >
    <label className={styles.field}>
      Type
      <select
        disabled={editorIsReadOnly}
        onChange={(event) => onUpdateForm((current) => ({
          ...current,
          kind: event.target.value as UpdateFormState["kind"]
        }))}
        value={form.kind}
      >
        {updateKindOptions.map((kind) => (
          <option key={kind} value={kind}>{formatUpdateKind(kind)}</option>
        ))}
      </select>
    </label>

    <label className={styles.field}>
      Title
      <input
        disabled={editorIsReadOnly}
        maxLength={publicUpdateTitleMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, title: event.target.value }))}
        placeholder="Public update title"
        required
        value={form.title}
      />
    </label>

    <label className={styles.field}>
      Slug
      <input
        disabled={editorIsReadOnly}
        maxLength={slugMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, slug: event.target.value }))}
        placeholder="lowercase-update-slug"
        required
        value={form.slug}
      />
      <span className={styles.fieldHint}>Used in the public update URL.</span>
    </label>

    <label className={styles.field}>
      Summary
      <textarea
        disabled={editorIsReadOnly}
        maxLength={publicUpdateSummaryMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, summary: event.target.value }))}
        placeholder="Short public summary"
        required
        rows={3}
        value={form.summary}
      />
      <span className={styles.fieldHint}>{form.summary.trim().length} / {publicUpdateSummaryMaxLength} characters</span>
    </label>

    <label className={styles.bodyField}>
      Body
      <textarea
        disabled={editorIsReadOnly}
        maxLength={publicUpdateBodyMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, body: event.target.value }))}
        placeholder="Write the public Markdown body."
        required
        rows={12}
        value={form.body}
      />
      <span className={styles.wordCount}>
        <span>{wordCount} {wordCount === 1 ? "word" : "words"} · {lineCount} {lineCount === 1 ? "line" : "lines"}</span>
        <span>{publicUpdateBodyMaxLength.toLocaleString()} character limit</span>
      </span>
    </label>

    <label className={styles.field}>
      Published date
      <input readOnly value={formatDateTime(selectedUpdate?.publishedAt ?? null)} />
      <span className={styles.fieldHint}>Set automatically when published.</span>
    </label>

    <div className={styles.publishControls}>
      <label className={styles.switchField}>
        <input
          checked={form.isPinned}
          disabled={editorIsReadOnly}
          onChange={(event) => onUpdateForm((current) => ({ ...current, isPinned: event.target.checked }))}
          role="switch"
          type="checkbox"
        />
        <span>
          <strong>Pin this update</strong>
          <small>Show at the top of the public updates list.</small>
        </span>
      </label>
      {formIssue ? <span className={styles.formIssue} role="status">{formIssue}</span> : null}
    </div>
  </form>
);

export default PublicUpdateAdminEditorForm;
