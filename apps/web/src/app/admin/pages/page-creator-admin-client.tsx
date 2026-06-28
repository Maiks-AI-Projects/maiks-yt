"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentPageSource } from "@maiks-yt/domain/pages";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { PageMarkdown } from "../../page-markdown";

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

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type PageFormState = {
  title: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  body: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const defaultPageForm: PageFormState = {
  title: "",
  path: "/",
  seoTitle: "",
  seoDescription: "",
  body: "# New Page\n\nDraft the page body here."
};

const toPageForm = (page: ContentPageSource): PageFormState => ({
  title: page.title,
  path: page.normalizedPath,
  seoTitle: page.seoTitle ?? "",
  seoDescription: page.seoDescription ?? "",
  body: page.body
});

const toPayload = (form: PageFormState): Record<string, unknown> => ({
  title: form.title.trim(),
  path: form.path.trim(),
  seoTitle: form.seoTitle.trim() || null,
  seoDescription: form.seoDescription.trim() || null,
  body: form.body.trim()
});

const sortPages = (pages: readonly ContentPageSource[]): readonly ContentPageSource[] =>
  pages
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing pages.";
  }

  if (response.status === 403 || reason === "content_page_admin_forbidden") {
    return "Your account does not have page creator permission.";
  }

  if (reason === "content_page_reserved_path") {
    return "That path is reserved for code-owned, admin, tool, API, overlay, dev, auth, account, or static asset routes.";
  }

  if (reason === "content_page_path_conflict") {
    return "That path is already owned by another page record.";
  }

  if (reason === "content_page_invalid_input") {
    return "The page request has invalid or missing fields.";
  }

  if (reason === "content_page_not_found") {
    return "That page could not be found.";
  }

  return `Page creator request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "content_page_admin_forbidden" || reason === "content_page_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const ContentPageAdminClient = (): React.ReactNode => {
  const [pages, setPages] = useState<readonly ContentPageSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pageForm, setPageForm] = useState<PageFormState>(defaultPageForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading Page Creator...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savedPreview, setSavedPreview] = useState<ContentPageSource | null>(null);

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
  };

  const createPage = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
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

  const visiblePages = sortPages(pages);
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
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Page Creator</h1>
        <p aria-live="polite">{message}</p>
      </header>

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
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
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Manual pages">
            <div className="project-admin-sidebar-heading">
              <h2>Pages</h2>
              <button type="button" className="secondary-action" onClick={startNewPage}>
                New
              </button>
            </div>
            {visiblePages.length === 0 ? (
              <p>No manual pages yet.</p>
            ) : (
              <div className="project-admin-selector">
                {visiblePages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={page.id === selectedId ? "selected" : ""}
                    onClick={() => selectPage(page.id)}
                  >
                    <strong>{page.title}</strong>
                    <span>{page.normalizedPath} / {page.status} / {page.visibility}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Manual page editor">
            <section className="project-admin-panel visibility-panel">
              <div>
                <h2>Publish State</h2>
                <p>
                  {selectedPage
                    ? selectedPage.status === "published"
                      ? "This page is public when its exact path is not code-owned and the record stays visible."
                      : "This page is a hidden draft until the saved preview is loaded and published."
                    : "Create a draft, save it, preview the saved record, then publish."}
                </p>
              </div>
              {selectedPage ? (
                <div className="project-admin-actions">
                  <button type="button" className="secondary-action" onClick={() => void previewSavedPage()} disabled={busyAction !== null}>
                    Preview Saved
                  </button>
                  {selectedPage.status === "published" ? (
                    <a className="button-link secondary-action" href={selectedPage.normalizedPath}>
                      Public Page
                    </a>
                  ) : null}
                  <button type="button" className="secondary-action" onClick={() => void unpublishSelectedPage()} disabled={busyAction !== null || selectedPage.status === "draft"}>
                    Unpublish
                  </button>
                  <button type="button" onClick={() => void publishSelectedPage()} disabled={busyAction !== null || selectedPage.status === "published" || !previewIsCurrent}>
                    Publish
                  </button>
                </div>
              ) : null}
            </section>

            <form className="project-admin-panel project-admin-form page-creator-form" onSubmit={(event) => selectedPage ? void updatePage(event) : void createPage(event)}>
              <div className="project-admin-panel-heading">
                <h2>{selectedPage ? "Page Details" : "Create Draft"}</h2>
                <button type="submit" disabled={busyAction !== null}>
                  {busyAction ? "Saving..." : selectedPage ? "Save Page" : "Create Draft"}
                </button>
              </div>
              <label>
                Title
                <input value={pageForm.title} onChange={(event) => {
                  setSavedPreview(null);
                  setPageForm((current) => ({ ...current, title: event.target.value }));
                }} required maxLength={191} />
              </label>
              <label>
                Path
                <input value={pageForm.path} onChange={(event) => {
                  setSavedPreview(null);
                  setPageForm((current) => ({ ...current, path: event.target.value }));
                }} required maxLength={191} placeholder="/channel-rules" />
              </label>
              <div className="project-admin-form-grid">
                <label>
                  SEO Title
                  <input value={pageForm.seoTitle} onChange={(event) => {
                    setSavedPreview(null);
                    setPageForm((current) => ({ ...current, seoTitle: event.target.value }));
                  }} maxLength={191} />
                </label>
                <label>
                  SEO Description
                  <input value={pageForm.seoDescription} onChange={(event) => {
                    setSavedPreview(null);
                    setPageForm((current) => ({ ...current, seoDescription: event.target.value }));
                  }} maxLength={320} />
                </label>
              </div>
              <label>
                Markdown Body
                <textarea value={pageForm.body} onChange={(event) => {
                  setSavedPreview(null);
                  setPageForm((current) => ({ ...current, body: event.target.value }));
                }} required maxLength={50_000} rows={14} />
              </label>
            </form>

            <section className="project-admin-panel page-creator-preview-panel">
              <div className="project-admin-panel-heading">
                <h2>{savedPreview ? "Saved Preview" : "Editing Preview"}</h2>
                <span>{previewPage.status} / {previewPage.visibility} / {previewPage.normalizedPath}</span>
              </div>
              <article className="content-page-article preview">
                <header className="content-page-header">
                  <p className="eyebrow">Manual Page</p>
                  <h1>{previewPage.title}</h1>
                  {previewPage.seoDescription ? <p>{previewPage.seoDescription}</p> : null}
                </header>
                <PageMarkdown body={previewPage.body} />
              </article>
            </section>

            <section className="project-admin-panel project-admin-note">
              <h2>Reserved For Later</h2>
              <p>Host/subdomain routing, Cloudflare automation, redirects, aliases, AI publishing, reusable blocks, provider integrations, and money/legal final wording stay outside this runtime slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default ContentPageAdminClient;
