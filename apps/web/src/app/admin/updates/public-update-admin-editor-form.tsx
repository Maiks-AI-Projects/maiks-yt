import {
  publicUpdateBodyMaxLength,
  publicUpdateSummaryMaxLength,
  publicUpdateTitleMaxLength
} from "@maiks-yt/domain/updates";
import type { PublicUpdateSource } from "@maiks-yt/domain/updates";
import { FiCalendar } from "react-icons/fi";

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
  interactionIsLocked: boolean;
  onSaveDraft: () => Promise<void>;
  onUpdateForm: (updater: (current: UpdateFormState) => UpdateFormState) => void;
  selectedUpdate: PublicUpdateSource | null;
};

const slugMaxLength = 191;

const PublicUpdateAdminEditorForm = ({
  editorIsReadOnly,
  form,
  formIssue,
  interactionIsLocked,
  onSaveDraft,
  onUpdateForm,
  selectedUpdate
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
      <span className={styles.fieldLabel}>Type</span>
      <select
        disabled={editorIsReadOnly || interactionIsLocked}
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
      <span className={styles.fieldLabel}>Title</span>
      <input
        disabled={editorIsReadOnly || interactionIsLocked}
        maxLength={publicUpdateTitleMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, title: event.target.value }))}
        placeholder="Public update title"
        required
        value={form.title}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.fieldLabel}>Slug</span>
      <input
        disabled={editorIsReadOnly || interactionIsLocked}
        maxLength={slugMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, slug: event.target.value }))}
        placeholder="lowercase-update-slug"
        required
        value={form.slug}
      />
      <span className={styles.fieldHint}>
        Used in the URL: <span className={styles.fieldHintValue}>maiks.yt/updates/{form.slug || "new-update"}</span>
      </span>
    </label>

    <label className={styles.field}>
      <span className={styles.fieldLabel}>Summary</span>
      <textarea
        disabled={editorIsReadOnly || interactionIsLocked}
        maxLength={publicUpdateSummaryMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, summary: event.target.value }))}
        placeholder="Short public summary"
        required
        rows={3}
        value={form.summary}
      />
      <span className={styles.fieldHint}>{form.summary.trim().length} characters</span>
    </label>

    <label className={styles.bodyField}>
      <span className={styles.fieldLabel}>Body (Markdown)</span>
      <textarea
        disabled={editorIsReadOnly || interactionIsLocked}
        maxLength={publicUpdateBodyMaxLength}
        onChange={(event) => onUpdateForm((current) => ({ ...current, body: event.target.value }))}
        placeholder="Write the public Markdown body."
        required
        rows={12}
        value={form.body}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.fieldLabel}>Published date</span>
      <span className={styles.readOnlyField}>
        <FiCalendar aria-hidden="true" />
        <input readOnly value={formatDateTime(selectedUpdate?.publishedAt ?? null)} />
      </span>
      <span className={styles.fieldHint}>Set automatically when published.</span>
    </label>

    <div className={styles.pinField}>
      <span className={styles.fieldLabel}>Pin this update</span>
      <span className={styles.pinHint}>Show at the top of the updates list</span>
      <label className={styles.switchField}>
        <span className={styles.visuallyHidden}>Pin this update</span>
        <input
          checked={form.isPinned}
          disabled={editorIsReadOnly || interactionIsLocked}
          onChange={(event) => onUpdateForm((current) => ({ ...current, isPinned: event.target.checked }))}
          role="switch"
          type="checkbox"
        />
      </label>
    </div>
    {formIssue ? <span className={styles.formIssue} role="status">{formIssue}</span> : null}
  </form>
);

export default PublicUpdateAdminEditorForm;
