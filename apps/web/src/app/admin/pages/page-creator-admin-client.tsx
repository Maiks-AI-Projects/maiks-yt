"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowRight,
  FiBold,
  FiCheck,
  FiEdit3,
  FiExternalLink,
  FiHash,
  FiItalic,
  FiLink,
  FiList,
  FiLock,
  FiPlus,
  FiShield
} from "react-icons/fi";
import {
  contentPageBodyMaxLength,
  contentPagePathMaxLength,
  contentPageSeoDescriptionMaxLength,
  contentPageSeoTitleMaxLength,
  contentPageTitleMaxLength,
  normalizeContentPagePath
} from "@maiks-yt/domain/pages";
import type { ContentPageSource } from "@maiks-yt/domain/pages";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { PageMarkdown } from "../../page-markdown";
import {
  countWords,
  defaultPageForm,
  getFailureMessage,
  getLoadStateForFailure,
  getLocalFormIssue,
  getSavedLabel,
  sortPages,
  toPageForm,
  toPayload,
  type LoadState,
  type PageFormState,
  type WorkspaceTab
} from "./page-creator-admin.rules";
import styles from "./page-creator-admin.module.css";
import PageCreatorInventory, { type PageFilter } from "./page-creator-inventory";

type AdminPagesResponse =
  | {
    ok: true;
    pages: readonly ContentPageSource[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminPageMutationResponse =
  | {
    ok: true;
    page: ContentPageSource;
  }
  | {
    ok: false;
    reason: string;
  };

type AdminPageDeleteResponse =
  | {
    ok: true;
    deletedPageId: string;
  }
  | {
    ok: false;
    reason: string;
  };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const ContentPageAdminClient = (): React.ReactNode => {
  const [pages, setPages] = useState<readonly ContentPageSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pageForm, setPageForm] = useState<PageFormState>(defaultPageForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading Page Creator...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savedPreview, setSavedPreview] = useState<ContentPageSource | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pageFilter, setPageFilter] = useState<PageFilter>("all");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("content");
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumberRef = useRef<HTMLDivElement | null>(null);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedId) ?? null,
    [pages, selectedId]
  );
  const previewIsCurrent = Boolean(
    selectedPage
    && savedPreview
    && savedPreview.id === selectedPage.id
    && savedPreview.updatedAt === selectedPage.updatedAt
  );
  const selectedPageIsPublished = selectedPage?.status === "published" && selectedPage.visibility === "public";
  const formPath = normalizeContentPagePath(pageForm.path);
  const formPathConflict = formPath.ok
    ? pages.find((page) => page.id !== selectedId && page.normalizedPath === formPath.path) ?? null
    : null;
  const pageFormIssue = getLocalFormIssue(pageForm);
  const wordCount = countWords(pageForm.body);
  const lineCount = Math.max(1, pageForm.body.split("\n").length);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const replacePage = useCallback((page: ContentPageSource): void => {
    setPages((current) => {
      const exists = current.some((candidate) => candidate.id === page.id);
      const next = exists
        ? current.map((candidate) => candidate.id === page.id ? page : candidate)
        : [page, ...current];

      return sortPages(next);
    });
    setSelectedId(page.id);
    setPageForm(toPageForm(page));
    setSavedPreview(null);
    setActiveTab("content");
    setPageFilter((current) => current === "all" || current === page.status ? current : "all");
  }, []);

  const loadPages = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading Page Creator...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/pages`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminPagesResponse>(response);

      if (response.ok && payload?.ok) {
        const orderedPages = sortPages(payload.pages);
        const firstPage = orderedPages[0] ?? null;

        setPages(orderedPages);
        setSelectedId(firstPage?.id ?? "");
        setPageForm(firstPage ? toPageForm(firstPage) : defaultPageForm);
        setSavedPreview(null);
        setActiveTab("content");
        setLoadState("ready");
        setMessage(orderedPages.length === 0 ? "No manual pages exist yet." : "Page Creator loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Page Creator request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadPages();
  }, [loadPages]);

  const runPageMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body?: Record<string, unknown>;
    }
  ): Promise<ContentPageSource | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders(options.body ? {
          "Content-Type": "application/json"
        } : undefined),
        credentials: "include",
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
      const payload = await parseJson<AdminPageMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replacePage(payload.page);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return payload.page;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
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

  const selectPage = (id: string): void => {
    const page = pages.find((candidate) => candidate.id === id);

    setSelectedId(id);
    setSavedPreview(null);
    setActiveTab("content");
    if (page) {
      setPageForm(toPageForm(page));
    }
  };

  const startNewPage = (): void => {
    setSelectedId("");
    setPageForm({
      ...defaultPageForm,
      path: `/manual-page-${pages.length + 1}`
    });
    setSavedPreview(null);
    setActiveTab("content");
    setPageFilter("all");
  };

  const createPage = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const issue = getLocalFormIssue(pageForm);

    if (issue) {
      setMessage(issue);
      return;
    }

    await runPageMutation("Creating page", "/admin/pages", {
      method: "POST",
      body: toPayload(pageForm)
    });
  };

  const updatePage = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedPage) {
      setMessage("Choose a page before saving changes.");
      return;
    }

    const issue = getLocalFormIssue(pageForm);

    if (issue) {
      setMessage(issue);
      return;
    }

    await runPageMutation("Saving page", `/admin/pages/${encodeURIComponent(selectedPage.id)}`, {
      method: "PATCH",
      body: toPayload(pageForm)
    });
  };

  const previewSavedPage = async (): Promise<void> => {
    if (!selectedPage) {
      setMessage("Choose a saved page before loading preview.");
      return;
    }

    setBusyAction("Loading preview");
    setMessage("Loading saved preview...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/pages/${encodeURIComponent(selectedPage.id)}/preview`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminPageMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setSavedPreview(payload.page);
        setActiveTab("preview");
        setMessage("Saved preview loaded. Publishing is available while this preview matches the saved page.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const publishSelectedPage = async (): Promise<void> => {
    if (!selectedPage) {
      setMessage("Choose a page before publishing.");
      return;
    }

    if (!previewIsCurrent) {
      setMessage("Load the saved preview before publishing this page.");
      return;
    }

    await runPageMutation("Publishing page", `/admin/pages/${encodeURIComponent(selectedPage.id)}/publish`, {
      method: "POST"
    });
  };

  const unpublishSelectedPage = async (): Promise<void> => {
    if (!selectedPage) {
      setMessage("Choose a page before unpublishing.");
      return;
    }

    await runPageMutation("Unpublishing page", `/admin/pages/${encodeURIComponent(selectedPage.id)}/unpublish`, {
      method: "POST"
    });
  };

  const deleteSelectedPage = async (): Promise<void> => {
    if (!selectedPage) {
      setMessage("Choose a page before deleting.");
      return;
    }

    if (selectedPage.status === "published" && selectedPage.visibility === "public") {
      setMessage("Unpublish this page before deleting it.");
      return;
    }

    setBusyAction("Deleting page");
    setMessage("Deleting page...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/pages/${encodeURIComponent(selectedPage.id)}`, {
        method: "DELETE",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminPageDeleteResponse>(response);

      if (response.ok && payload?.ok) {
        const nextPages = sortPages(pages.filter((page) => page.id !== payload.deletedPageId));
        const nextPage = nextPages[0] ?? null;

        setPages(nextPages);
        setSelectedId(nextPage?.id ?? "");
        setPageForm(nextPage ? toPageForm(nextPage) : defaultPageForm);
        setSavedPreview(null);
        setActiveTab("content");
        setPageFilter("all");
        setLoadState("ready");
        setMessage(nextPage ? "Page deleted." : "Page deleted. No manual pages exist yet.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deleting page failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const applyMarkdownFormat = (before: string, after: string, placeholder: string): void => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = pageForm.body.slice(selectionStart, selectionEnd) || placeholder;
    const nextBody = `${pageForm.body.slice(0, selectionStart)}${before}${selectedText}${after}${pageForm.body.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + before.length;
    const nextSelectionEnd = nextSelectionStart + selectedText.length;

    setSavedPreview(null);
    setPageForm((current) => ({ ...current, body: nextBody }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  const visiblePages = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return sortPages(pages).filter((page) => {
      const matchesFilter = pageFilter === "all" || page.status === pageFilter;
      const matchesQuery = query.length === 0
        || page.title.toLocaleLowerCase().includes(query)
        || page.normalizedPath.toLocaleLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [pageFilter, pages, searchQuery]);
  const draftCount = pages.filter((page) => page.status === "draft").length;
  const previewPage = savedPreview ?? {
    ...selectedPage,
    id: selectedPage?.id ?? "unsaved-preview",
    title: pageForm.title || "Untitled page",
    normalizedPath: pageForm.path || "/",
    body: pageForm.body,
    seoTitle: pageForm.seoTitle || null,
    seoDescription: pageForm.seoDescription || null,
    status: selectedPage?.status ?? "draft",
    visibility: selectedPage?.visibility ?? "hidden",
    publishedAt: selectedPage?.publishedAt ?? null,
    updatedAt: selectedPage?.updatedAt ?? new Date().toISOString()
  } as ContentPageSource;

  return (
    <div className={styles.pageCreator}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1>Pages</h1>
          <p>Create and publish manual website pages.</p>
        </div>
        <div className={styles.headerActions}>
          <button disabled={loadState !== "ready"} type="button" onClick={startNewPage}>
            <FiPlus aria-hidden="true" /> New draft
          </button>
        </div>
      </header>

      {loadState !== "ready" ? (
        <section className={styles.loadState}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadPages()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className={styles.layout}>
          <PageCreatorInventory
            draftCount={draftCount}
            filter={pageFilter}
            onFilterChange={setPageFilter}
            onSearchChange={setSearchQuery}
            onSelect={selectPage}
            pages={pages}
            searchQuery={searchQuery}
            selectedId={selectedId}
            visiblePages={visiblePages}
          />

          <section className={styles.workspace} aria-label="Manual page editor">
            <div className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderTop}>
                <div className={styles.workspaceTitle}>
                  <span className={styles.breadcrumb}>Pages / {selectedPage ? selectedPage.title : "New draft"}</span>
                  <div className={styles.titleLine}>
                    <h2>{selectedPage?.title ?? "New manual page"}</h2>
                    <span className={styles.statusPill} data-published={selectedPageIsPublished}>
                      {selectedPageIsPublished ? "Published · Public" : "Draft · Hidden"}
                    </span>
                  </div>
                  <span className={styles.routeLabel}>maiks.yt{selectedPage?.normalizedPath ?? pageForm.path}</span>
                  <span className={styles.savedTime}>{selectedPage ? getSavedLabel(selectedPage.updatedAt) : "Not saved yet"}</span>
                </div>
                <div className={styles.workspaceActions}>
                  <button
                    className="secondary-action"
                    disabled={busyAction !== null}
                    form="page-editor-form"
                    type="submit"
                  >
                    {busyAction ? "Working..." : selectedPage ? "Save changes" : "Create draft"}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={busyAction !== null || !selectedPage}
                    onClick={() => void previewSavedPage()}
                    type="button"
                  >
                    Preview saved <FiExternalLink aria-hidden="true" />
                  </button>
                  {selectedPageIsPublished ? (
                    <>
                      <a className="button-link secondary-action" href={selectedPage.normalizedPath}>
                        Public page
                      </a>
                      <button
                        disabled={busyAction !== null}
                        onClick={() => void unpublishSelectedPage()}
                        type="button"
                      >
                        Unpublish
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busyAction !== null || !selectedPage || !previewIsCurrent}
                      onClick={() => void publishSelectedPage()}
                      type="button"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.workflowArea}>
                <div className={styles.workflow} aria-label="Publishing workflow">
                  <span className={styles.workflowStep} data-complete={Boolean(selectedPage)} data-current={!selectedPage}>
                    {selectedPage ? <FiCheck aria-hidden="true" /> : <FiEdit3 aria-hidden="true" />}
                    Saved
                  </span>
                  <FiArrowRight className={styles.workflowArrow} aria-hidden="true" />
                  <span className={styles.workflowStep} data-complete={previewIsCurrent || selectedPageIsPublished} data-current={Boolean(selectedPage) && !previewIsCurrent && !selectedPageIsPublished}>
                    {previewIsCurrent || selectedPageIsPublished ? <FiCheck aria-hidden="true" /> : <FiExternalLink aria-hidden="true" />}
                    Preview saved version
                  </span>
                  <FiArrowRight className={styles.workflowArrow} aria-hidden="true" />
                  <span className={styles.workflowStep} data-complete={selectedPageIsPublished} data-current={previewIsCurrent && !selectedPageIsPublished}>
                    {selectedPageIsPublished ? <FiCheck aria-hidden="true" /> : <FiLock aria-hidden="true" />}
                    Publish
                  </span>
                </div>
                <span className={styles.workflowHint}>
                  {selectedPageIsPublished
                    ? "This page is live. Unpublish it before deleting."
                    : previewIsCurrent
                      ? "The saved preview is current. Publishing is unlocked."
                      : "Publish unlocks after the latest saved version is previewed."}
                </span>
              </div>
            </div>

            <nav className={styles.tabs} aria-label="Page editor sections">
              <div className={styles.tabList} role="tablist">
                {([
                  ["content", "Content"],
                  ["seo", "SEO"],
                  ...(savedPreview ? [["preview", "Saved preview"]] as const : [])
                ] as readonly (readonly [WorkspaceTab, string])[]).map(([tab, label]) => (
                  <button
                    aria-selected={activeTab === tab}
                    className={styles.tabButton}
                    data-active={activeTab === tab}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </nav>

            <div className={styles.editorBody}>
              <form
                className={styles.form}
                data-tab={activeTab}
                id="page-editor-form"
                onSubmit={(event) => selectedPage ? void updatePage(event) : void createPage(event)}
              >
                {activeTab === "content" ? (
                  <>
                    <div className={styles.fieldGrid}>
                      <label className={styles.field}>
                        Page title
                        <input
                          maxLength={contentPageTitleMaxLength}
                          onChange={(event) => {
                            setSavedPreview(null);
                            setPageForm((current) => ({ ...current, title: event.target.value }));
                          }}
                          required
                          value={pageForm.title}
                        />
                      </label>
                      <label className={styles.field}>
                        Public path
                        <span className={styles.pathInput}>
                          <span className={styles.pathPrefix}>maiks.yt</span>
                          <input
                            maxLength={contentPagePathMaxLength}
                            onChange={(event) => {
                              setSavedPreview(null);
                              setPageForm((current) => ({ ...current, path: event.target.value }));
                            }}
                            placeholder="/channel-rules"
                            required
                            value={pageForm.path}
                          />
                        </span>
                        <span className={styles.pathState} data-error={!formPath.ok || Boolean(formPathConflict)}>
                          {formPath.ok && !formPathConflict ? <FiCheck aria-hidden="true" /> : <FiShield aria-hidden="true" />}
                          {formPathConflict
                            ? `Already owned by ${formPathConflict.title}`
                            : formPath.ok
                              ? "Available · manual page route"
                              : formPath.reason === "reserved_path"
                                ? "Reserved · choose another path"
                                : "Use a valid path beginning with /"}
                        </span>
                      </label>
                    </div>
                    <div className={styles.bodyField}>
                      <label htmlFor="page-markdown-body">Markdown body</label>
                      <span className={styles.markdownFrame}>
                        <span className={styles.markdownToolbar} aria-label="Markdown formatting">
                          <button aria-label="Add heading" className={styles.toolButton} onClick={() => applyMarkdownFormat("## ", "", "Heading")} title="Heading" type="button">
                            <FiHash aria-hidden="true" />
                          </button>
                          <button aria-label="Bold selected text" className={styles.toolButton} onClick={() => applyMarkdownFormat("**", "**", "bold text")} title="Bold" type="button">
                            <FiBold aria-hidden="true" />
                          </button>
                          <button aria-label="Italicize selected text" className={styles.toolButton} onClick={() => applyMarkdownFormat("*", "*", "italic text")} title="Italic" type="button">
                            <FiItalic aria-hidden="true" />
                          </button>
                          <button aria-label="Add link" className={styles.toolButton} onClick={() => applyMarkdownFormat("[", "](https://)", "link text")} title="Link" type="button">
                            <FiLink aria-hidden="true" />
                          </button>
                          <button aria-label="Add bulleted list item" className={styles.toolButton} onClick={() => applyMarkdownFormat("- ", "", "List item")} title="Bulleted list" type="button">
                            <FiList aria-hidden="true" />
                          </button>
                        </span>
                        <span className={styles.markdownEditor}>
                          <span className={styles.lineNumbers} ref={lineNumberRef} aria-hidden="true">
                            {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}
                          </span>
                          <textarea
                            id="page-markdown-body"
                            maxLength={contentPageBodyMaxLength}
                            onChange={(event) => {
                              setSavedPreview(null);
                              setPageForm((current) => ({ ...current, body: event.target.value }));
                            }}
                            onScroll={(event) => {
                              if (lineNumberRef.current) {
                                lineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
                              }
                            }}
                            ref={bodyTextareaRef}
                            required
                            rows={16}
                            value={pageForm.body}
                          />
                        </span>
                        <span className={styles.wordCount}>
                          <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
                          <span>{contentPageBodyMaxLength.toLocaleString()} character limit</span>
                        </span>
                      </span>
                    </div>
                  </>
                ) : null}

                {activeTab === "seo" ? (
                  <div className={styles.seoPanel}>
                    <label className={styles.field}>
                      SEO title
                      <input
                        maxLength={contentPageSeoTitleMaxLength}
                        onChange={(event) => {
                          setSavedPreview(null);
                          setPageForm((current) => ({ ...current, seoTitle: event.target.value }));
                        }}
                        placeholder={pageForm.title || "Page title"}
                        value={pageForm.seoTitle}
                      />
                    </label>
                    <label className={styles.field}>
                      SEO description
                      <textarea
                        maxLength={contentPageSeoDescriptionMaxLength}
                        onChange={(event) => {
                          setSavedPreview(null);
                          setPageForm((current) => ({ ...current, seoDescription: event.target.value }));
                        }}
                        placeholder="Short description shown by search engines and link previews."
                        value={pageForm.seoDescription}
                      />
                    </label>
                  </div>
                ) : null}

                {activeTab === "preview" && savedPreview ? (
                  <section className={styles.previewPanel} aria-label="Saved page preview">
                    <div className={styles.previewMeta}>
                      <span>Saved preview · maiks.yt{savedPreview.normalizedPath}</span>
                      <span>No changes since this saved version.</span>
                    </div>
                    <article className={styles.previewArticle}>
                      <header>
                        <span className="eyebrow">Manual Page</span>
                        <h1>{previewPage.title}</h1>
                        {previewPage.seoDescription ? <p>{previewPage.seoDescription}</p> : null}
                      </header>
                      <PageMarkdown body={previewPage.body} />
                    </article>
                  </section>
                ) : null}
              </form>
            </div>

            <footer className={styles.workspaceFooter}>
              <div className={styles.footerStart}>
                {selectedPage && !selectedPageIsPublished ? (
                  <button
                    className={styles.deleteButton}
                    disabled={busyAction !== null}
                    onClick={() => void deleteSelectedPage()}
                    type="button"
                  >
                    Delete draft
                  </button>
                ) : null}
                <span className={styles.footerHint}>
                  {selectedPageIsPublished ? "Published pages must be unpublished before deletion." : "Drafts stay hidden until published."}
                </span>
                <p aria-live="polite" className={styles.message}>{message}</p>
              </div>
              <div className={styles.footerActions}>
                <button
                  className="secondary-action"
                  disabled={busyAction !== null}
                  form="page-editor-form"
                  type="submit"
                >
                  {busyAction ? "Working..." : selectedPage ? "Save changes" : "Create draft"}
                </button>
                {!selectedPageIsPublished ? (
                  <button
                    disabled={busyAction !== null || !selectedPage || !previewIsCurrent || Boolean(pageFormIssue)}
                    onClick={() => void publishSelectedPage()}
                    type="button"
                  >
                    Publish
                  </button>
                ) : null}
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default ContentPageAdminClient;
