"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreatorLinkIcon, CreatorLinkSource } from "@maiks-yt/domain";
import type { IconType } from "react-icons";
import { FiArrowDown, FiArrowUp, FiCheckCircle, FiExternalLink, FiEye, FiEyeOff, FiLock, FiMenu, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import { FaClockRotateLeft, FaCompass, FaHeart, FaListCheck, FaMoneyBillTransfer, FaRss, FaUser, FaUserGroup } from "react-icons/fa6";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import { creatorLinkPurposeLabels } from "../../../content/public-creator-links-data";
import { CreatorLinkRow } from "../../links/creator-link-row";
import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  buildLocalDraftCreatorLinkPreview,
  buildSavedPublicCreatorLinkPreview,
  creatorLinkIconNames,
  creatorLinkPurposes,
  destinationLooksValid,
  emptyCreatorLinkForm,
  formatCreatorLinkLabel,
  getCreatorLinkDeleteEligibility,
  getCreatorLinkDeleteUnavailableMessage,
  getCreatorLinkFailureMessage,
  getCreatorLinkLoadStateForFailure,
  getEffectiveAvailability,
  getPublishDirtyGuardMessage,
  isCreatorLinkFormDirty,
  isExactDeleteConfirmation,
  isFundingCreatorLinkForm,
  moveCreatorLink,
  protectedFundingAvailabilityNote,
  requiresUnsavedEditGuard,
  sortCreatorLinks,
  toCreatorLinkForm,
  toCreatorLinkPayload,
  type LinkFormState,
  type LoadState
} from "./creator-link-admin.rules";
import styles from "./creator-link-admin.module.css";

type AdminLinksResponse = { ok: true; links: readonly CreatorLinkSource[] } | { ok: false; reason: string };
type AdminLinkMutationResponse = { ok: true; link: CreatorLinkSource } | { ok: false; reason: string };
type AdminLinkReorderResponse = { ok: true; links: readonly CreatorLinkSource[] } | { ok: false; reason: string };
type AdminLinkDeleteResponse = { ok: true; deletedKey: string } | { ok: false; reason: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";
const icons = {
  account: FaUser,
  accountability: FaClockRotateLeft,
  affiliate: FaMoneyBillTransfer,
  community: SiDiscord,
  context: FaUserGroup,
  discord: SiDiscord,
  feed: FaRss,
  project: FaListCheck,
  social: SiTwitch,
  stream: SiYoutube,
  support: FaHeart,
  twitch: SiTwitch,
  tool: FaCompass,
  youtube: SiYoutube
} satisfies Record<CreatorLinkIcon, IconType>;
const parseJson = async <T,>(response: Response): Promise<T | null> => {
  try { return await response.json() as T; } catch { return null; }
};

const CreatorLinkAdminClient = (): React.ReactNode => {
  const [links, setLinks] = useState<readonly CreatorLinkSource[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<LinkFormState>(emptyCreatorLinkForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading Creator Hub link admin...");
  const [busy, setBusy] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const selected = useMemo(() => links.find((link) => link.key === selectedKey) ?? null, [links, selectedKey]);
  const isDirty = isCreatorLinkFormDirty(selected, form);
  const draftPreview = useMemo(() => buildLocalDraftCreatorLinkPreview(form, selected), [form, selected]);
  const savedPublicLinks = useMemo(() => buildSavedPublicCreatorLinkPreview(links), [links]);
  const deleteEligibility = getCreatorLinkDeleteEligibility(selected);
  const deleteUnavailableMessage = getCreatorLinkDeleteUnavailableMessage(deleteEligibility);
  const deleteConfirmationMatches = isExactDeleteConfirmation(selected, deleteConfirmation);

  const loadLinks = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/links`, { headers: createApiHeaders(), credentials: "include" });
      const payload = await parseJson<AdminLinksResponse>(response);
      if (response.ok && payload?.ok) {
        const ordered = sortCreatorLinks(payload.links);
        const first = ordered[0] ?? null;
        setLinks(ordered);
        setSelectedKey(first?.key ?? "");
        setForm(first ? toCreatorLinkForm(first) : emptyCreatorLinkForm);
        setLoadState("ready");
        setOrderDirty(false);
        setDeleteDialogOpen(false);
        setDeleteConfirmation("");
        setMessage(ordered.length ? `${ordered.length} links loaded.` : "No Creator Hub links exist yet.");
        return;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getCreatorLinkLoadStateForFailure(response, reason));
      setMessage(getCreatorLinkFailureMessage(response, reason));
    } catch {
      setLoadState("failed");
      setMessage(getCreatorLinkFailureMessage({ status: 503 }));
    }
  }, []);

  useEffect(() => { captureDevAuthTokenFromUrl(); void loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (!requiresUnsavedEditGuard(isDirty)) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const replaceLink = (link: CreatorLinkSource, oldKey?: string): void => {
    const replacedKey = oldKey ?? link.key;
    setLinks((current) => sortCreatorLinks(current.some((item) => item.key === replacedKey)
      ? current.map((item) => item.key === replacedKey ? link : item)
      : [link, ...current]));
    if (!selectedKey || selectedKey === replacedKey) {
      setSelectedKey(link.key);
      setForm(toCreatorLinkForm(link));
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
    }
  };

  const mutate = async (action: string, path: string, body: Record<string, unknown>, oldKey?: string): Promise<void> => {
    setBusy(action);
    setMessage(`${action}...`);
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: path === "/admin/links" ? "POST" : "PATCH",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body)
      });
      const payload = await parseJson<AdminLinkMutationResponse>(response);
      if (response.ok && payload?.ok) {
        replaceLink(payload.link, oldKey);
        setMessage(`${action} saved.`);
      } else {
        setMessage(getCreatorLinkFailureMessage(response, payload?.ok === false ? payload.reason : undefined));
      }
    } catch {
      setMessage(getCreatorLinkFailureMessage({ status: 503 }));
    } finally { setBusy(null); }
  };

  const confirmDiscardIfDirty = (): boolean =>
    !requiresUnsavedEditGuard(isDirty) || window.confirm("Discard unsaved changes and open another link?");
  const select = (key: string): void => {
    if (key === selectedKey || !confirmDiscardIfDirty()) return;
    const link = links.find((item) => item.key === key);
    if (link) {
      setSelectedKey(key);
      setForm(toCreatorLinkForm(link));
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
    }
  };
  const startNew = (): void => {
    if (!confirmDiscardIfDirty()) return;
    setSelectedKey("");
    setForm(emptyCreatorLinkForm);
    setDeleteDialogOpen(false);
    setDeleteConfirmation("");
    setMessage("New link draft ready.");
  };
  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (orderDirty) {
      setMessage("Save the link order before saving link details.");
      return;
    }

    if (selected) await mutate("Saving link", `/admin/links/${encodeURIComponent(selected.key)}`, toCreatorLinkPayload(form), selected.key);
    else await mutate("Creating link", "/admin/links", toCreatorLinkPayload(form));
  };
  const togglePublished = async (link: CreatorLinkSource): Promise<void> => {
    if (orderDirty) {
      setMessage("Save the link order before changing publish state.");
      return;
    }

    const nextPublished = !link.isPublished;
    const action = nextPublished ? "Publishing link" : "Unpublishing link";
    if (isDirty) {
      if (!window.confirm(getPublishDirtyGuardMessage(nextPublished))) return;
      await mutate(action, `/admin/links/${encodeURIComponent(link.key)}`, toCreatorLinkPayload({ ...form, isPublished: nextPublished }), link.key);
      return;
    }
    await mutate(action, `/admin/links/${encodeURIComponent(link.key)}`, { isPublished: nextPublished }, link.key);
  };
  const reorder = (sourceKey: string, targetKey: string): void => {
    const next = moveCreatorLink(links, links.findIndex((item) => item.key === sourceKey), links.findIndex((item) => item.key === targetKey));
    setLinks(next);
    setOrderDirty(true);
  };
  const moveOne = (key: string, direction: -1 | 1): void => {
    const from = links.findIndex((item) => item.key === key);
    const target = links[from + direction];
    if (target) reorder(key, target.key);
  };
  const saveOrder = async (): Promise<void> => {
    setBusy("Saving order");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/links/reorder`, {
        method: "PATCH",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ orderedKeys: links.map((link) => link.key) })
      });
      const payload = await parseJson<AdminLinkReorderResponse>(response);
      if (response.ok && payload?.ok) {
        const ordered = sortCreatorLinks(payload.links);
        setLinks(ordered);
        setOrderDirty(false);
        setMessage("Order saved.");
      } else setMessage(getCreatorLinkFailureMessage(response, payload?.ok === false ? payload.reason : undefined));
    } catch {
      setMessage(getCreatorLinkFailureMessage({ status: 503 }));
    } finally { setBusy(null); }
  };
  const deleteDraft = async (): Promise<void> => {
    if (!selected || !deleteEligibility.ok || !deleteConfirmationMatches) {
      setMessage("Type the exact saved title before deleting this draft.");
      return;
    }

    setBusy("Deleting draft");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/links/${encodeURIComponent(selected.key)}`, {
        method: "DELETE",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ confirmationTitle: deleteConfirmation })
      });
      const payload = await parseJson<AdminLinkDeleteResponse>(response);

      if (response.ok && payload?.ok) {
        const currentIndex = links.findIndex((link) => link.key === selected.key);
        const remaining = links.filter((link) => link.key !== selected.key);
        const nextSelected = remaining[Math.min(Math.max(currentIndex, 0), Math.max(remaining.length - 1, 0))] ?? null;

        setLinks(remaining);
        setSelectedKey(nextSelected?.key ?? "");
        setForm(nextSelected ? toCreatorLinkForm(nextSelected) : emptyCreatorLinkForm);
        setDeleteDialogOpen(false);
        setDeleteConfirmation("");
        setMessage("Draft link deleted.");
      } else {
        setMessage(getCreatorLinkFailureMessage(response, payload?.ok === false ? payload.reason : undefined));
      }
    } catch {
      setMessage(getCreatorLinkFailureMessage({ status: 503 }));
    } finally {
      setBusy(null);
    }
  };

  const support = isFundingCreatorLinkForm(form);
  const availability = getEffectiveAvailability(form);
  const validDestination = destinationLooksValid(form);
  const FormIcon = icons[form.icon];

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.heading}><div><h1>Creator Hub Links</h1><strong>{links.length} links</strong><p aria-live="polite">{message}</p></div></div>
      <div className={styles.headerActions}>
        <a href="/links" target="_blank" rel="noreferrer">Open /links <FiExternalLink aria-hidden="true" /></a>
        <span><i aria-hidden="true" />Current</span>
        <span><b aria-hidden="true" />Next</span>
        <button type="button" className={styles.primaryButton} onClick={startNew}><FiPlus aria-hidden="true" />New link</button>
      </div>
    </header>

    {loadState !== "ready" ? <section className={styles.state} data-state={loadState}>
      <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign in required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
      <p>{message}</p>{loadState !== "loading" ? <button type="button" onClick={() => void loadLinks()}>Retry</button> : null}
    </section> : <div className={styles.workspace}>
      <section className={styles.orderPanel} aria-labelledby="links-order-heading">
        <div className={styles.panelHeading}><h2 id="links-order-heading">Links &amp; order</h2><button type="button" disabled={busy !== null || !orderDirty} onClick={() => void saveOrder()}><FiSave aria-hidden="true" />Save order</button></div>
        <div className={styles.linkList}>
          {links.length === 0 ? <p className={styles.empty}>No links yet.</p> : null}
          {links.map((link, index) => {
            return <div className={styles.linkRow} data-selected={selectedKey === link.key ? "true" : undefined} data-dragging={draggedKey === link.key ? "true" : undefined}
              draggable key={link.key} onDragStart={() => setDraggedKey(link.key)} onDragEnd={() => setDraggedKey(null)} onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedKey) reorder(draggedKey, link.key); setDraggedKey(null); }}>
              <span className={styles.dragHandle} title="Drag to reorder"><FiMenu aria-hidden="true" /></span>
              <button type="button" className={styles.linkIdentity} onClick={() => select(link.key)}>
                <span><strong>{link.title}</strong><small>{(link.availability === "available" ? link.href : link.availabilityNote) || "No destination"}</small></span>
                <span className={styles.linkBadges}>
                  <em data-tone={link.isPublished ? "published" : "draft"}>{link.isPublished ? "Published" : "Draft"}</em>
                  <em data-tone={link.availability}>{formatCreatorLinkLabel(link.availability)}</em>
                  {link.isPrimary ? <em data-tone="primary">Highlighted</em> : null}
                  {link.key === "support" || link.purpose === "support" ? <em data-tone="protected">Protected</em> : null}
                </span>
              </button>
              <div className={styles.rowActions}>
                <button type="button" aria-label={`Move ${link.title} up`} disabled={busy !== null || index === 0} onClick={() => moveOne(link.key, -1)}><FiArrowUp /></button>
                <button type="button" aria-label={`Move ${link.title} down`} disabled={busy !== null || index === links.length - 1} onClick={() => moveOne(link.key, 1)}><FiArrowDown /></button>
                <span
                  className={styles.visibilityState}
                  aria-label={`${link.title} is ${link.isPublished ? "published" : "a draft"}`}
                  role="img"
                  title={link.isPublished ? "Published" : "Draft"}
                >
                  {link.isPublished ? <FiEye /> : <FiEyeOff />}
                </span>
                {link.key === "support" || link.purpose === "support" ? <span className={styles.visibilityState} aria-label="Funding is protected" role="img" title="Protected"><FiLock /></span> : null}
              </div>
            </div>;
          })}
        </div>
        <footer className={styles.orderFooter}><span>{orderDirty ? "Order changes are not saved yet" : "Order is saved"}</span></footer>
      </section>

      <section className={styles.editorPanel} aria-labelledby="link-editor-heading">
        <div className={styles.panelHeading}><h2 id="link-editor-heading">{selected ? form.title || "Untitled link" : "New link"}</h2><span>{selected ? selected.isPublished ? "Published" : "Draft" : "Unsaved"}</span>{isDirty ? <span data-tone="dirty">Unsaved</span> : null}</div>
        <form className={styles.form} onSubmit={(event) => void save(event)}>
          <label>Title<input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} required maxLength={191} /></label>
          {availability === "available" ? <label>Destination URL<input value={form.href} onChange={(event) => setForm((value) => ({ ...value, href: event.target.value }))} required maxLength={1024} />{validDestination ? <span className={styles.validation}><FiCheckCircle />Destination looks valid</span> : null}</label>
            : <label>Unavailable message<input value={support ? protectedFundingAvailabilityNote : form.availabilityNote} onChange={(event) => setForm((value) => ({ ...value, availabilityNote: event.target.value }))} required maxLength={191} disabled={support} /></label>}
          <label>Description<textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} required maxLength={2000} rows={4} /></label>
          <div className={styles.formGrid}>
            <label>Purpose<select value={form.purpose} onChange={(event) => { const purpose = event.target.value as LinkFormState["purpose"]; setForm((value) => ({ ...value, purpose, ...(purpose === "support" ? { availability: "unavailable", href: "", availabilityNote: protectedFundingAvailabilityNote } : {}) })); }}>{creatorLinkPurposes.map((purpose) => <option key={purpose} value={purpose}>{creatorLinkPurposeLabels[purpose]}</option>)}</select></label>
            <label>Icon<select value={form.icon} onChange={(event) => setForm((value) => ({ ...value, icon: event.target.value as CreatorLinkIcon }))}>{creatorLinkIconNames.map((icon) => <option key={icon} value={icon}>{formatCreatorLinkLabel(icon)}</option>)}</select></label>
          </div>
          <div className={styles.presentationFeedback} aria-live="polite">
            <span className={styles.feedbackIcon} data-icon={form.icon}><FormIcon aria-hidden="true" /></span>
            <span><strong>Public presentation</strong><small>{creatorLinkPurposeLabels[form.purpose]} purpose - {formatCreatorLinkLabel(form.icon)} icon - Highlight {form.isPrimary ? "on" : "off"}</small></span>
          </div>
          <fieldset className={styles.availability} disabled={support}><legend>Availability</legend>{(["available", "unavailable"] as const).map((item) => <label key={item} data-active={availability === item ? "true" : undefined}><input type="radio" name="availability" checked={availability === item} onChange={() => setForm((value) => ({ ...value, availability: item }))} />{formatCreatorLinkLabel(item)}</label>)}</fieldset>
          <div className={styles.checkboxGrid}>
            <label><input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm((value) => ({ ...value, isPrimary: event.target.checked }))} />Highlight on public links page</label>
            <label><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))} />Published after save</label>
          </div>
          <details className={styles.advanced} open={!selected}><summary>Link identity</summary><label>Key<input value={form.key} onChange={(event) => setForm((value) => ({ ...value, key: event.target.value }))} required pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} /></label></details>
          {support ? <p className={styles.supportWarning}>Support remains unavailable until Michael approves the destination URL and public wording.</p> : null}
          <footer className={styles.editorFooter}><div className={styles.editorStatus}><span>{isDirty ? "Unsaved changes" : "No unsaved changes"}</span>{selected ? <button type="button" disabled={busy !== null} onClick={() => void togglePublished(selected)}>{selected.isPublished ? "Unpublish" : "Publish now"}</button> : null}{selected ? <button type="button" className={styles.dangerButton} disabled={busy !== null || !deleteEligibility.ok} title={deleteUnavailableMessage ?? undefined} onClick={() => { setDeleteConfirmation(""); setDeleteDialogOpen(true); }}><FiTrash2 aria-hidden="true" />Delete draft</button> : null}</div>
            <div><button type="button" disabled={busy !== null} onClick={() => { if (selected) { setForm(toCreatorLinkForm(selected)); setMessage("Unsaved edits discarded."); } else { setForm(emptyCreatorLinkForm); setMessage("Unsaved edits discarded."); } }}>Discard edits</button><button type="submit" className={styles.primaryButton} disabled={busy !== null || orderDirty} title={orderDirty ? "Save the link order first" : undefined}>{busy ?? (selected ? "Save link" : "Create link")}</button></div>
          </footer>
        </form>
      </section>

      <section className={styles.previewPanel} aria-labelledby="public-preview-heading">
        <div className={styles.previewBlock}>
          <div className={styles.previewHeading}><div><h2 id="public-preview-heading">Draft preview</h2><p>Local unsaved form state</p></div><span data-tone="dirty">Unsaved</span><span>Not public</span></div>
          <div className={styles.draftPreviewList}>
            {draftPreview ? <CreatorLinkRow link={draftPreview} /> : <p className={styles.empty}>Complete the required fields to preview the public row.</p>}
          </div>
        </div>
        <div className={styles.previewBlock}>
          <div className={styles.previewHeading}><div><h2>Saved public page</h2><p>Current published /links view</p></div><span data-tone="authoritative">Authoritative</span><a href="/links" target="_blank" rel="noreferrer">Open exact page <FiExternalLink /></a></div>
          <div className={styles.savedPreviewList}>
            {savedPublicLinks.length > 0 ? savedPublicLinks.map((link) => <CreatorLinkRow key={link.key} link={link} />) : <p className={styles.empty}>No published links are visible on /links yet.</p>}
          </div>
        </div>
        {deleteDialogOpen && selected ? <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="delete-link-heading">
            <button type="button" className={styles.closeButton} aria-label="Close delete confirmation" onClick={() => setDeleteDialogOpen(false)}>x</button>
            <h2 id="delete-link-heading">Delete draft link?</h2>
            <p>Unsaved edits and the saved draft "{selected.title}" will be permanently deleted.</p>
            <p>Type <strong>{selected.title}</strong> to confirm.</p>
            <label>Link title<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
            <footer>
              <button type="button" onClick={() => setDeleteDialogOpen(false)}>Cancel</button>
              <button type="button" className={styles.dangerButton} disabled={busy !== null || !deleteEligibility.ok || !deleteConfirmationMatches} onClick={() => void deleteDraft()}>Delete draft</button>
            </footer>
          </section>
        </div> : null}
      </section>
    </div>}
  </div>;
};

export default CreatorLinkAdminClient;
