"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PublicUpdateAdminPreview,
  PublicUpdateSource
} from "@maiks-yt/domain/updates";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  canEditUpdate,
  canPreviewSavedUpdate,
  canPublishUpdate,
  countWords,
  createPreviewAcknowledgement,
  defaultUpdateForm,
  filterUpdates,
  filterEditorInventoryUpdates,
  getFailureMessage,
  getLoadStateForFailure,
  getLocalUpdateFormIssue,
  isPublishedUpdate,
  isUpdateFormDirty,
  previewMatchesSavedRevision,
  toUpdateForm,
  toPublishPayload,
  toUpdatePayload,
  type LoadState,
  type PreviewAcknowledgement,
  type UpdateFilter,
  type UpdateFormState
} from "./public-update-admin.rules";

type AdminUpdatesResponse =
  | { ok: true; updates: readonly PublicUpdateSource[] }
  | { ok: false; reason: string };

type AdminUpdateMutationResponse =
  | { ok: true; update: PublicUpdateSource }
  | { ok: false; reason: string };

type AdminUpdatePreviewResponse =
  | { ok: true; revision: string; update: PublicUpdateAdminPreview }
  | { ok: false; reason: string };

export type PublicUpdateAdminWorkspaceController = {
  busyAction: string | null;
  discardChanges: () => void;
  draftCount: number;
  editorIsReadOnly: boolean;
  filter: UpdateFilter;
  form: UpdateFormState;
  formIsDirty: boolean;
  formIssue: string | null;
  interactionIsLocked: boolean;
  lineCount: number;
  loadPreview: () => Promise<void>;
  loadState: LoadState;
  message: string;
  preview: PublicUpdateAdminPreview | null;
  previewIsAvailable: boolean;
  previewIsCurrent: boolean;
  publishIsAvailable: boolean;
  publishedCount: number;
  publishUpdate: () => Promise<void>;
  refreshUpdates: () => void;
  saveDraft: () => Promise<void>;
  searchQuery: string;
  selectRow: (update: PublicUpdateSource) => void;
  selectedId: string;
  selectedIsPublished: boolean;
  selectedUpdate: PublicUpdateSource | null;
  setFilter: (filter: UpdateFilter) => void;
  setSearchQuery: (query: string) => void;
  startNewUpdate: () => void;
  unpublishUpdate: () => Promise<void>;
  updateForm: (updater: (current: UpdateFormState) => UpdateFormState) => void;
  updates: readonly PublicUpdateSource[];
  visibleUpdates: readonly PublicUpdateSource[];
  wordCount: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};

export const usePublicUpdateAdminWorkspace = (): PublicUpdateAdminWorkspaceController => {
  const [updates, setUpdates] = useState<readonly PublicUpdateSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<UpdateFormState>(defaultUpdateForm);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filter, setFilter] = useState<UpdateFilter>("all");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading updates...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [previewAcknowledgement, setPreviewAcknowledgement] = useState<PreviewAcknowledgement | null>(null);
  const selectedIdRef = useRef<string>("");

  const selectedUpdate = useMemo(
    () => updates.find((update) => update.id === selectedId) ?? null,
    [selectedId, updates]
  );
  const formIsDirty = isUpdateFormDirty(selectedUpdate, form);
  const formIssue = getLocalUpdateFormIssue(form);
  const interactionIsLocked = busyAction !== null;
  const previewIsCurrent = previewMatchesSavedRevision(selectedUpdate, previewAcknowledgement);
  const selectedIsPublished = isPublishedUpdate(selectedUpdate);
  const editorIsReadOnly = !canEditUpdate(selectedUpdate);
  const publishIsAvailable = canPublishUpdate({
    selectedUpdate,
    form,
    formIsDirty,
    previewAcknowledgement
  });
  const previewIsAvailable = canPreviewSavedUpdate(selectedUpdate, formIsDirty);
  const wordCount = countWords(form.body);
  const lineCount = Math.max(1, form.body.split("\n").length);

  const visibleUpdates = useMemo(
    () => filterUpdates(updates, filter, searchQuery),
    [filter, searchQuery, updates]
  );
  const draftCount = updates.filter((update) => update.status === "draft").length;
  const publishedCount = updates.filter((update) => update.status === "published").length;

  const selectUpdate = useCallback((update: PublicUpdateSource | null): void => {
    selectedIdRef.current = update?.id ?? "";
    setSelectedId(update?.id ?? "");
    setForm(update ? toUpdateForm(update) : defaultUpdateForm);
    setPreviewAcknowledgement(null);
  }, []);

  const replaceUpdate = useCallback((update: PublicUpdateSource): void => {
    setUpdates((current) => {
      const exists = current.some((candidate) => candidate.id === update.id);
      return exists
        ? current.map((candidate) => candidate.id === update.id ? update : candidate)
        : [update, ...current];
    });
    selectedIdRef.current = update.id;
    setSelectedId(update.id);
    setForm(toUpdateForm(update));
    setPreviewAcknowledgement(null);
    setFilter((current) => current === "all" || current === update.status ? current : "all");
  }, []);

  const loadUpdates = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading updates...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/updates`, {
        cache: "no-store",
        credentials: "include",
        headers: createApiHeaders()
      });
      const payload = await parseJson<AdminUpdatesResponse>(response);

      if (response.ok && payload?.ok) {
        const orderedUpdates = filterEditorInventoryUpdates(payload.updates);
        const previousSelectedId = selectedIdRef.current;
        const nextSelected = previousSelectedId
          ? orderedUpdates.find((update) => update.id === previousSelectedId) ?? orderedUpdates[0] ?? null
          : orderedUpdates[0] ?? null;

        setUpdates(orderedUpdates);
        selectUpdate(nextSelected);
        setLoadState("ready");
        setMessage(orderedUpdates.length === 0 ? "No public updates have been saved yet." : "Updates loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setUpdates([]);
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setUpdates([]);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Updates request failed.");
    }
  }, [selectUpdate]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadUpdates();
  }, [loadUpdates]);

  useEffect(() => {
    if (!formIsDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formIsDirty]);

  const updateForm = (updater: (current: UpdateFormState) => UpdateFormState): void => {
    if (interactionIsLocked) {
      return;
    }

    setForm(updater);
    setPreviewAcknowledgement(null);
  };

  const confirmDiscardDirty = (targetLabel: string): boolean => {
    if (!formIsDirty) {
      return true;
    }

    const accepted = window.confirm(`Discard unsaved changes and open ${targetLabel}?`);

    if (!accepted) {
      setMessage("Unsaved changes kept.");
    }

    return accepted;
  };

  const startNewUpdate = (): void => {
    if (interactionIsLocked) {
      return;
    }

    if (!confirmDiscardDirty("a new draft")) {
      return;
    }

    selectUpdate(null);
    setFilter("all");
    setMessage("New unsaved draft. Save draft before previewing or publishing.");
  };

  const refreshUpdates = (): void => {
    if (!confirmDiscardDirty("the refreshed list")) {
      return;
    }

    void loadUpdates();
  };

  const selectRow = (update: PublicUpdateSource): void => {
    if (interactionIsLocked) {
      return;
    }

    if (!confirmDiscardDirty(update.title)) {
      return;
    }

    selectUpdate(update);
    setMessage(update.isExample
      ? "Example record selected. It is protected from edits and publishing."
      : "Update selected.");
  };

  const discardChanges = (): void => {
    if (interactionIsLocked) {
      return;
    }

    setForm(selectedUpdate ? toUpdateForm(selectedUpdate) : defaultUpdateForm);
    setPreviewAcknowledgement(null);
    setMessage(selectedUpdate ? "Unsaved changes discarded." : "Unsaved draft cleared.");
  };

  const runMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body?: Record<string, unknown>;
    }
  ): Promise<PublicUpdateSource | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        cache: "no-store",
        credentials: "include",
        headers: createApiHeaders(options.body ? { "Content-Type": "application/json" } : undefined),
        method: options.method,
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
      const payload = await parseJson<AdminUpdateMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceUpdate(payload.update);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return payload.update;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      if (reason === "public_update_preview_stale") {
        setPreviewAcknowledgement(null);
      }
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
      return null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const saveDraft = async (): Promise<void> => {
    if (editorIsReadOnly) {
      setMessage("Published and example records are read-only here. Unpublish a live update before editing it.");
      return;
    }

    const issue = getLocalUpdateFormIssue(form);

    if (issue) {
      setMessage(issue);
      return;
    }

    await runMutation(selectedUpdate ? "Saving draft" : "Creating draft", selectedUpdate
      ? `/admin/updates/${encodeURIComponent(selectedUpdate.id)}`
      : "/admin/updates", {
        method: selectedUpdate ? "PATCH" : "POST",
        body: toUpdatePayload(form)
      });
  };

  const loadPreview = async (): Promise<void> => {
    if (!selectedUpdate) {
      setMessage("Save this draft before loading a preview.");
      return;
    }

    if (formIsDirty) {
      setMessage("Save or discard changes before loading the saved preview.");
      return;
    }

    if (selectedUpdate.isExample) {
      setMessage("Example records are not previewed for production publishing.");
      return;
    }

    setBusyAction("Loading preview");
    setMessage("Loading saved preview...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/updates/${encodeURIComponent(selectedUpdate.id)}/preview`, {
        cache: "no-store",
        credentials: "include",
        headers: createApiHeaders()
      });
      const payload = await parseJson<AdminUpdatePreviewResponse>(response);

      if (response.ok && payload?.ok) {
        setPreviewAcknowledgement(createPreviewAcknowledgement(selectedUpdate.id, payload));
        setMessage("Saved preview checked. Publishing is available while this saved revision stays unchanged.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview request failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const publishUpdate = async (): Promise<void> => {
    if (formIsDirty) {
      setMessage("Save or discard changes before publishing.");
      return;
    }

    if (!publishIsAvailable || !selectedUpdate) {
      setMessage("Load the saved preview before publishing this draft.");
      return;
    }

    const expectedRevision = previewAcknowledgement?.revision;

    if (!expectedRevision) {
      setMessage("Load the saved preview before publishing this draft.");
      return;
    }

    await runMutation("Publishing update", `/admin/updates/${encodeURIComponent(selectedUpdate.id)}/publish`, {
      method: "POST",
      body: toPublishPayload(previewAcknowledgement)
    });
  };

  const unpublishUpdate = async (): Promise<void> => {
    if (!selectedUpdate) {
      setMessage("Choose a saved update before unpublishing.");
      return;
    }

    if (formIsDirty) {
      setMessage("Save or discard changes before unpublishing.");
      return;
    }

    await runMutation("Unpublishing update", `/admin/updates/${encodeURIComponent(selectedUpdate.id)}/unpublish`, {
      method: "POST"
    });
  };

  return {
    busyAction,
    discardChanges,
    draftCount,
    editorIsReadOnly,
    filter,
    form,
    formIsDirty,
    formIssue,
    interactionIsLocked,
    lineCount,
    loadPreview,
    loadState,
    message,
    preview: previewAcknowledgement?.preview ?? null,
    previewIsAvailable,
    previewIsCurrent,
    publishIsAvailable,
    publishedCount,
    publishUpdate,
    refreshUpdates,
    saveDraft,
    searchQuery,
    selectRow,
    selectedId,
    selectedIsPublished,
    selectedUpdate,
    setFilter,
    setSearchQuery,
    startNewUpdate,
    unpublishUpdate,
    updateForm,
    updates,
    visibleUpdates,
    wordCount
  };
};
