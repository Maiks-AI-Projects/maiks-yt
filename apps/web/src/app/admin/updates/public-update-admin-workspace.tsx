import {
  FiCheck,
  FiExternalLink,
  FiEye
} from "react-icons/fi";

import PublicUpdateAdminEditorForm from "./public-update-admin-editor-form";
import PublicUpdateAdminPreview from "./public-update-admin-preview";
import { getPublicUpdateHref } from "./public-update-admin.rules";
import type { PublicUpdateAdminWorkspaceController } from "./public-update-admin-workspace.service";
import styles from "./public-update-admin.module.css";

type PublicUpdateAdminWorkspaceProps = {
  controller: PublicUpdateAdminWorkspaceController;
};

const PublicUpdateAdminWorkspace = ({
  controller
}: PublicUpdateAdminWorkspaceProps): React.ReactNode => {
  const {
    busyAction,
    discardChanges,
    editorIsReadOnly,
    form,
    formIsDirty,
    formIssue,
    lineCount,
    loadPreview,
    message,
    preview,
    previewIsAvailable,
    previewIsCurrent,
    publishIsAvailable,
    publishUpdate,
    saveDraft,
    selectedIsPublished,
    selectedUpdate,
    unpublishUpdate,
    updateForm,
    wordCount
  } = controller;

  return (
    <section className={styles.workspace} aria-label="Public update editor">
      <div className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderTop}>
          <div className={styles.workspaceTitle}>
            <div className={styles.titleLine}>
              <h2>{selectedUpdate?.title || form.title || "New public update"}</h2>
              <span
                className={styles.statusPill}
                data-example={Boolean(selectedUpdate?.isExample)}
                data-published={selectedIsPublished}
              >
                {selectedUpdate?.isExample
                  ? "Example · Protected"
                  : selectedIsPublished
                    ? "Published · Public"
                    : "Draft · Hidden"}
              </span>
              {formIsDirty ? <span className={styles.dirtyPill}>Unsaved</span> : null}
            </div>
          </div>
          <div className={styles.workspaceActions}>
            <button
              className="secondary-action"
              disabled={busyAction !== null || !previewIsAvailable}
              onClick={() => void loadPreview()}
              type="button"
            >
              <FiEye aria-hidden="true" />
              <span>Preview</span>
            </button>
            {selectedIsPublished ? (
              <>
                {selectedUpdate ? (
                  <a className="button-link secondary-action" href={getPublicUpdateHref(selectedUpdate)}>
                    <FiExternalLink aria-hidden="true" />
                    <span>Public update</span>
                  </a>
                ) : null}
                <button
                  disabled={busyAction !== null}
                  onClick={() => void unpublishUpdate()}
                  type="button"
                >
                  Unpublish
                </button>
              </>
            ) : (
              <button
                disabled={busyAction !== null || !publishIsAvailable}
                onClick={() => void publishUpdate()}
                type="button"
              >
                Publish
              </button>
            )}
          </div>
        </div>
        <div className={styles.workflowArea}>
          <div className={styles.workflow} aria-label="Publishing workflow">
            <div className={styles.workflowStep} data-complete={Boolean(selectedUpdate) && !formIsDirty} data-current={!selectedUpdate || formIsDirty}>
              <span className={styles.workflowMarker} aria-hidden="true">
                {selectedUpdate && !formIsDirty ? <FiCheck /> : "1"}
              </span>
              <span className={styles.workflowCopy}>
                <strong>Saved draft</strong>
                <small>{selectedUpdate && !formIsDirty ? "All changes saved" : "Save latest changes"}</small>
              </span>
            </div>
            <div className={styles.workflowStep} data-complete={previewIsCurrent || selectedIsPublished} data-current={Boolean(selectedUpdate) && !previewIsCurrent && !selectedIsPublished}>
              <span className={styles.workflowMarker} aria-hidden="true">
                {previewIsCurrent || selectedIsPublished ? <FiCheck /> : "2"}
              </span>
              <span className={styles.workflowCopy}>
                <strong>Preview checked</strong>
                <small>{previewIsCurrent || selectedIsPublished ? "Current revision reviewed" : "Review before publish"}</small>
              </span>
            </div>
            <div className={styles.workflowStep} data-complete={selectedIsPublished} data-current={publishIsAvailable}>
              <span className={styles.workflowMarker} aria-hidden="true">
                {selectedIsPublished ? <FiCheck /> : "3"}
              </span>
              <span className={styles.workflowCopy}>
                <strong>Ready to publish</strong>
                <small>{selectedIsPublished ? "Update is public" : "Make update live"}</small>
              </span>
            </div>
          </div>
          <span className={styles.workflowHint}>
            {selectedUpdate?.isExample
              ? "Example records are protected and cannot be republished."
              : selectedIsPublished
                ? "Published updates must be unpublished before editing."
                : previewIsCurrent
                  ? "The saved preview is current. Publishing is unlocked."
                  : "Publish unlocks after the latest saved draft is previewed."}
          </span>
        </div>
      </div>

      <div className={styles.editorBody}>
        <PublicUpdateAdminEditorForm
          editorIsReadOnly={editorIsReadOnly}
          form={form}
          formIssue={formIssue}
          lineCount={lineCount}
          onSaveDraft={saveDraft}
          onUpdateForm={updateForm}
          selectedUpdate={selectedUpdate}
          wordCount={wordCount}
        />
        {preview ? (
          <PublicUpdateAdminPreview preview={preview} previewIsCurrent={previewIsCurrent} />
        ) : null}
      </div>

      <footer className={styles.workspaceFooter}>
        <div className={styles.footerStart}>
          <button
            className="secondary-action"
            disabled={busyAction !== null || !formIsDirty}
            onClick={discardChanges}
            type="button"
          >
            Discard
          </button>
          <p aria-live="polite" className={styles.message}>{message}</p>
        </div>
        <div className={styles.footerActions}>
          <button
            className="secondary-action"
            disabled={busyAction !== null || editorIsReadOnly || Boolean(formIssue)}
            form="public-update-editor-form"
            type="submit"
          >
            {busyAction ? "Working..." : "Save draft"}
          </button>
        </div>
      </footer>
    </section>
  );
};

export default PublicUpdateAdminWorkspace;
