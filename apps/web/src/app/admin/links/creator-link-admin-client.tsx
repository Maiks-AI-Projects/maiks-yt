"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreatorLinkAvailability,
  CreatorLinkIcon,
  CreatorLinkPurpose,
  CreatorLinkSource
} from "@maiks-yt/domain";

import { creatorLinkPurposeLabels } from "../../../content/public-creator-links-data";
import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type AdminLinksResponse =
  | {
    ok: true;
    links: readonly CreatorLinkSource[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminLinkMutationResponse =
  | {
    ok: true;
    link: CreatorLinkSource;
  }
  | {
    ok: false;
    reason: string;
  };

type AdminLinkReorderResponse =
  | {
    ok: true;
    links: readonly CreatorLinkSource[];
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type LinkFormState = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  availability: CreatorLinkAvailability;
  href: string;
  availabilityNote: string;
  isPrimary: boolean;
  sortOrder: number;
  isPublished: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const creatorLinkPurposes = [
  "account",
  "accountability",
  "affiliate",
  "community",
  "context",
  "feed",
  "project",
  "social",
  "stream",
  "support",
  "tool"
] satisfies CreatorLinkPurpose[];

const creatorLinkIcons = [
  "account",
  "accountability",
  "affiliate",
  "community",
  "context",
  "discord",
  "feed",
  "project",
  "social",
  "stream",
  "support",
  "twitch",
  "tool",
  "youtube"
] satisfies CreatorLinkIcon[];

const defaultLinkForm: LinkFormState = {
  key: "",
  title: "",
  description: "",
  purpose: "social",
  icon: "social",
  availability: "unavailable",
  href: "",
  availabilityNote: "Destination not available yet.",
  isPrimary: false,
  sortOrder: 1,
  isPublished: false
};

const formatLabel = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toLinkForm = (link: CreatorLinkSource): LinkFormState => ({
  key: link.key,
  title: link.title,
  description: link.description,
  purpose: link.purpose,
  icon: link.icon,
  availability: link.availability,
  href: link.href ?? "",
  availabilityNote: link.availabilityNote ?? "",
  isPrimary: link.isPrimary,
  sortOrder: link.sortOrder,
  isPublished: link.isPublished
});

const toPayload = (form: LinkFormState): Record<string, unknown> => {
  const isSupportLink = form.key.trim() === "support" || form.purpose === "support";
  const availability = isSupportLink ? "unavailable" : form.availability;

  return {
    key: form.key.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    purpose: form.purpose,
    icon: form.icon,
    availability,
    href: availability === "available" ? form.href.trim() : null,
    availabilityNote: availability === "unavailable"
      ? isSupportLink
        ? "Support link not available"
        : form.availabilityNote.trim()
      : null,
    isPrimary: form.isPrimary,
    sortOrder: form.sortOrder,
    isPublished: form.isPublished
  };
};

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing Creator Hub links.";
  }

  if (response.status === 403 || reason === "creator_link_admin_forbidden") {
    return "Your account does not have Creator Hub link admin permission.";
  }

  if (reason === "creator_link_key_conflict") {
    return "That link key is already in use.";
  }

  if (reason === "creator_link_admin_invalid_input") {
    return "The link request has invalid or missing fields.";
  }

  if (reason === "creator_link_not_found") {
    return "That link could not be found.";
  }

  return `Creator Hub link request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "creator_link_admin_forbidden" || reason === "creator_link_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const sortLinks = (links: readonly CreatorLinkSource[]): readonly CreatorLinkSource[] =>
  links
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title) || left.key.localeCompare(right.key));

const CreatorLinkAdminClient = (): React.ReactNode => {
  const [links, setLinks] = useState<readonly CreatorLinkSource[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [linkForm, setLinkForm] = useState<LinkFormState>(defaultLinkForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading Creator Hub link admin...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedLink = useMemo(
    () => links.find((link) => link.key === selectedKey) ?? null,
    [links, selectedKey]
  );

  const replaceLink = useCallback((link: CreatorLinkSource): void => {
    setLinks((current) => {
      const exists = current.some((candidate) => candidate.key === selectedKey || candidate.key === link.key);
      const next = exists
        ? current.map((candidate) => candidate.key === selectedKey || candidate.key === link.key ? link : candidate)
        : [link, ...current];

      return sortLinks(next);
    });
    setSelectedKey(link.key);
    setLinkForm(toLinkForm(link));
  }, [selectedKey]);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadLinks = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading Creator Hub link admin...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/links`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminLinksResponse>(response);

      if (response.ok && payload?.ok) {
        const orderedLinks = sortLinks(payload.links);
        const firstLink = orderedLinks[0] ?? null;

        setLinks(orderedLinks);
        setSelectedKey(firstLink?.key ?? "");
        setLinkForm(firstLink ? toLinkForm(firstLink) : {
          ...defaultLinkForm,
          sortOrder: 1
        });
        setLoadState("ready");
        setMessage(orderedLinks.length === 0 ? "No Creator Hub links exist yet." : "Creator Hub link admin loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Creator Hub link admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadLinks();
  }, [loadLinks]);

  const runLinkMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body: Record<string, unknown>;
    }
  ): Promise<CreatorLinkSource | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(options.body)
      });
      const payload = await parseJson<AdminLinkMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceLink(payload.link);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return payload.link;
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

  const selectLink = (key: string): void => {
    const link = links.find((candidate) => candidate.key === key);

    setSelectedKey(key);
    if (link) {
      setLinkForm(toLinkForm(link));
    }
  };

  const startNewLink = (): void => {
    setSelectedKey("");
    setLinkForm({
      ...defaultLinkForm,
      sortOrder: links.length + 1
    });
  };

  const createLink = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await runLinkMutation("Creating link", "/admin/links", {
      method: "POST",
      body: toPayload(linkForm)
    });
  };

  const updateLink = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedLink) {
      setMessage("Choose a link before saving changes.");
      return;
    }

    await runLinkMutation("Saving link", `/admin/links/${encodeURIComponent(selectedLink.key)}`, {
      method: "PATCH",
      body: toPayload(linkForm)
    });
  };

  const savePublishedState = async (isPublished: boolean): Promise<void> => {
    if (!selectedLink) {
      setMessage("Choose a link before changing publish state.");
      return;
    }

    await runLinkMutation(isPublished ? "Publishing link" : "Unpublishing link", `/admin/links/${encodeURIComponent(selectedLink.key)}`, {
      method: "PATCH",
      body: {
        isPublished
      }
    });
  };

  const saveCurrentOrder = async (): Promise<void> => {
    const orderedKeys = sortLinks(links).map((link) => link.key);

    setBusyAction("Saving order");
    setMessage("Saving order...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/links/reorder`, {
        method: "PATCH",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          orderedKeys
        })
      });
      const payload = await parseJson<AdminLinkReorderResponse>(response);

      if (response.ok && payload?.ok) {
        setLinks(sortLinks(payload.links));
        setMessage("Order saved.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving order failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const isSupportLink = linkForm.key === "support" || linkForm.purpose === "support";
  const effectiveAvailability = isSupportLink ? "unavailable" : linkForm.availability;
  const visibleLinks = sortLinks(links);

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Creator Hub Links</h1>
        <p aria-live="polite">{message}</p>
      </header>

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadLinks()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Creator Hub links">
            <div className="project-admin-sidebar-heading">
              <h2>Links</h2>
              <button type="button" className="secondary-action" onClick={startNewLink}>
                New
              </button>
            </div>
            {visibleLinks.length === 0 ? (
              <p>No links yet.</p>
            ) : (
              <div className="project-admin-selector">
                {visibleLinks.map((link) => (
                  <button
                    key={link.key}
                    type="button"
                    className={link.key === selectedKey ? "selected" : ""}
                    onClick={() => selectLink(link.key)}
                  >
                    <strong>{link.title}</strong>
                    <span>{link.isPublished ? "Published" : "Draft"} / {formatLabel(link.availability)} / Order {link.sortOrder}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Creator Hub link editor">
            <section className="project-admin-panel visibility-panel">
              <div>
                <h2>Publish State</h2>
                <p>
                  {selectedLink
                    ? selectedLink.isPublished
                      ? "This link can appear on the public Creator Hub if its availability fields are valid."
                      : "This link is saved as a draft and hidden from the public Creator Hub."
                    : "New links can be saved as drafts before publishing."}
                </p>
              </div>
              {selectedLink ? (
                <div className="project-admin-actions">
                  <a className="button-link secondary-action" href="/links">
                    Preview
                  </a>
                  <button type="button" className="secondary-action" onClick={() => void savePublishedState(false)} disabled={busyAction !== null || !selectedLink.isPublished}>
                    Unpublish
                  </button>
                  <button type="button" onClick={() => void savePublishedState(true)} disabled={busyAction !== null || selectedLink.isPublished}>
                    Publish
                  </button>
                </div>
              ) : null}
            </section>

            <form className="project-admin-panel project-admin-form link-admin-form" onSubmit={(event) => selectedLink ? void updateLink(event) : void createLink(event)}>
              <div className="project-admin-panel-heading">
                <h2>{selectedLink ? "Link Details" : "Create Link"}</h2>
                <button type="submit" disabled={busyAction !== null}>
                  {busyAction ? "Saving..." : selectedLink ? "Save Link" : "Create Link"}
                </button>
              </div>
              <label>
                Key
                <input value={linkForm.key} onChange={(event) => setLinkForm((current) => ({ ...current, key: event.target.value }))} required pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} />
              </label>
              <label>
                Title
                <input value={linkForm.title} onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
              </label>
              <label>
                Description
                <textarea value={linkForm.description} onChange={(event) => setLinkForm((current) => ({ ...current, description: event.target.value }))} required maxLength={2000} rows={4} />
              </label>
              <div className="project-admin-form-grid">
                <label>
                  Purpose
                  <select value={linkForm.purpose} onChange={(event) => {
                    const purpose = event.target.value as CreatorLinkPurpose;
                    setLinkForm((current) => ({
                      ...current,
                      purpose,
                      ...(purpose === "support"
                        ? {
                          availability: "unavailable",
                          href: "",
                          availabilityNote: "Support link not available"
                        }
                        : {})
                    }));
                  }}>
                    {creatorLinkPurposes.map((purpose) => <option key={purpose} value={purpose}>{creatorLinkPurposeLabels[purpose]}</option>)}
                  </select>
                </label>
                <label>
                  Icon
                  <select value={linkForm.icon} onChange={(event) => setLinkForm((current) => ({ ...current, icon: event.target.value as CreatorLinkIcon }))}>
                    {creatorLinkIcons.map((icon) => <option key={icon} value={icon}>{formatLabel(icon)}</option>)}
                  </select>
                </label>
                <label>
                  Availability
                  <select value={effectiveAvailability} onChange={(event) => setLinkForm((current) => ({ ...current, availability: event.target.value as CreatorLinkAvailability }))} disabled={isSupportLink}>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>
                <label>
                  Order
                  <input type="number" min={0} value={linkForm.sortOrder} onChange={(event) => setLinkForm((current) => ({ ...current, sortOrder: event.target.valueAsNumber || 0 }))} />
                </label>
                <label className="project-admin-checkbox">
                  <input type="checkbox" checked={linkForm.isPrimary} onChange={(event) => setLinkForm((current) => ({ ...current, isPrimary: event.target.checked }))} />
                  Primary link
                </label>
                <label className="project-admin-checkbox">
                  <input type="checkbox" checked={linkForm.isPublished} onChange={(event) => setLinkForm((current) => ({ ...current, isPublished: event.target.checked }))} />
                  Published after save
                </label>
              </div>
              {effectiveAvailability === "available" ? (
                <label>
                  Destination URL
                  <input value={linkForm.href} onChange={(event) => setLinkForm((current) => ({ ...current, href: event.target.value }))} required maxLength={1024} />
                </label>
              ) : (
                <label>
                  Unavailable Message
                  <input value={isSupportLink ? "Support link not available" : linkForm.availabilityNote} onChange={(event) => setLinkForm((current) => ({ ...current, availabilityNote: event.target.value }))} required maxLength={191} disabled={isSupportLink} />
                </label>
              )}
              {isSupportLink ? (
                <p className="link-admin-warning">Support remains unavailable until Michael approves the destination URL and public wording.</p>
              ) : null}
            </form>

            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <h2>Order</h2>
                <button type="button" className="secondary-action" onClick={() => void saveCurrentOrder()} disabled={busyAction !== null || links.length === 0}>
                  Save Current Order
                </button>
              </div>
              <ol className="project-admin-record-list">
                {visibleLinks.map((link) => (
                  <li key={link.key}>
                    <div>
                      <strong>{link.title}</strong>
                      <span>{creatorLinkPurposeLabels[link.purpose]} / {formatLabel(link.availability)} / Order {link.sortOrder}</span>
                      <p>{link.availability === "available" ? link.href : link.availabilityNote}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={link.sortOrder}
                      aria-label={`${link.title} sort order`}
                      onChange={(event) => {
                        const sortOrder = event.target.valueAsNumber || 0;
                        setLinks((current) => sortLinks(current.map((candidate) => candidate.key === link.key ? {
                          ...candidate,
                          sortOrder
                        } : candidate)));
                        if (selectedKey === link.key) {
                          setLinkForm((current) => ({
                            ...current,
                            sortOrder
                          }));
                        }
                      }}
                    />
                  </li>
                ))}
              </ol>
            </section>

            <section className="project-admin-panel project-admin-note">
              <h2>Deferred</h2>
              <p>Affiliate tracking, sponsor telemetry, support/payment behavior, AI publishing, and click analytics stay outside this manual link admin slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default CreatorLinkAdminClient;
