"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreatorLinkAvailability, CreatorLinkIcon, CreatorLinkPurpose, CreatorLinkSource } from "@maiks-yt/domain";
import type { IconType } from "react-icons";
import { FiArrowDown, FiArrowUp, FiCheckCircle, FiExternalLink, FiEye, FiEyeOff, FiMenu, FiPlus } from "react-icons/fi";
import { FaClockRotateLeft, FaCompass, FaHeart, FaListCheck, FaMoneyBillTransfer, FaRss, FaUser, FaUserGroup } from "react-icons/fa6";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import { creatorLinkPurposeLabels } from "../../../content/public-creator-links-data";
import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import styles from "./creator-link-admin.module.css";

type AdminLinksResponse = { ok: true; links: readonly CreatorLinkSource[] } | { ok: false; reason: string };
type AdminLinkMutationResponse = { ok: true; link: CreatorLinkSource } | { ok: false; reason: string };
type AdminLinkReorderResponse = { ok: true; links: readonly CreatorLinkSource[] } | { ok: false; reason: string };
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
  isPublished: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const protectedFundingAvailabilityNote = "Funding launches later";
const purposes = ["account", "accountability", "affiliate", "community", "context", "feed", "project", "social", "stream", "support", "tool"] satisfies CreatorLinkPurpose[];
const iconNames = ["account", "accountability", "affiliate", "community", "context", "discord", "feed", "project", "social", "stream", "support", "twitch", "tool", "youtube"] satisfies CreatorLinkIcon[];
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
const emptyForm: LinkFormState = {
  key: "",
  title: "",
  description: "",
  purpose: "social",
  icon: "social",
  availability: "unavailable",
  href: "",
  availabilityNote: "Destination not available yet.",
  isPrimary: false,
  isPublished: false
};

const label = (value: string): string => value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const sortLinks = (links: readonly CreatorLinkSource[]): CreatorLinkSource[] => links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
const toForm = (link: CreatorLinkSource): LinkFormState => ({
  key: link.key,
  title: link.title,
  description: link.description,
  purpose: link.purpose,
  icon: link.icon,
  availability: link.availability,
  href: link.href ?? "",
  availabilityNote: link.availabilityNote ?? "",
  isPrimary: link.isPrimary,
  isPublished: link.isPublished
});
const isSupport = (form: LinkFormState): boolean => form.key.trim() === "support" || form.purpose === "support";
const toPayload = (form: LinkFormState): Record<string, unknown> => {
  const support = isSupport(form);
  const availability = support ? "unavailable" : form.availability;
  return {
    ...form,
    key: form.key.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    availability,
    href: availability === "available" ? form.href.trim() : null,
    availabilityNote: availability === "unavailable" ? support ? protectedFundingAvailabilityNote : form.availabilityNote.trim() : null
  };
};
const formsMatch = (left: LinkFormState, right: LinkFormState): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const parseJson = async <T,>(response: Response): Promise<T | null> => {
  try { return await response.json() as T; } catch { return null; }
};
const failureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") return "Sign in before managing Creator Hub links.";
  if (response.status === 403 || reason?.includes("forbidden")) return "Your account does not have Creator Hub link admin permission.";
  if (reason === "creator_link_key_conflict") return "That link key is already in use.";
  if (reason === "creator_link_admin_invalid_input") return "The link request has invalid or missing fields.";
  if (reason === "creator_link_not_found") return "That link could not be found.";
  return `Creator Hub link request failed with ${response.status}.`;
};
const failureState = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") return "signed-out";
  if (response.status === 403 || reason?.includes("forbidden") || reason === "creator_link_admin_user_unlinked") return "forbidden";
  return "failed";
};
const move = (links: readonly CreatorLinkSource[], from: number, to: number): CreatorLinkSource[] => {
  if (from < 0 || to < 0 || from >= links.length || to >= links.length || from === to) return links.slice();
  const next = links.slice();
  const [item] = next.splice(from, 1);
  if (!item) return links.slice();
  next.splice(to, 0, item);
  return next.map((link, index) => ({ ...link, sortOrder: index + 1 }));
};

const CreatorLinkAdminClient = (): React.ReactNode => {
  const [links, setLinks] = useState<readonly CreatorLinkSource[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<LinkFormState>(emptyForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading Creator Hub link admin...");
  const [busy, setBusy] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const selected = useMemo(() => links.find((link) => link.key === selectedKey) ?? null, [links, selectedKey]);
  const isDirty = selected ? !formsMatch(toForm(selected), form) : !formsMatch(emptyForm, form);

  const loadLinks = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/links`, { headers: createApiHeaders(), credentials: "include" });
      const payload = await parseJson<AdminLinksResponse>(response);
      if (response.ok && payload?.ok) {
        const ordered = sortLinks(payload.links);
        const first = ordered[0] ?? null;
        setLinks(ordered);
        setSelectedKey(first?.key ?? "");
        setForm(first ? toForm(first) : emptyForm);
        setLoadState("ready");
        setOrderDirty(false);
        setMessage(ordered.length ? `${ordered.length} links loaded.` : "No Creator Hub links exist yet.");
        return;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(failureState(response, reason));
      setMessage(failureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Creator Hub link admin request failed.");
    }
  }, []);

  useEffect(() => { captureDevAuthTokenFromUrl(); void loadLinks(); }, [loadLinks]);

  const replaceLink = (link: CreatorLinkSource, oldKey?: string): void => {
    const replacedKey = oldKey ?? link.key;
    setLinks((current) => sortLinks(current.some((item) => item.key === replacedKey)
      ? current.map((item) => item.key === replacedKey ? link : item)
      : [link, ...current]));
    if (!selectedKey || selectedKey === replacedKey) {
      setSelectedKey(link.key);
      setForm(toForm(link));
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
        setPreviewRevision((value) => value + 1);
      } else {
        setMessage(failureMessage(response, payload?.ok === false ? payload.reason : undefined));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed.`);
    } finally { setBusy(null); }
  };

  const confirmDiscardIfDirty = (): boolean =>
    !isDirty || window.confirm("Discard unsaved changes and open another link?");
  const select = (key: string): void => {
    if (key === selectedKey || !confirmDiscardIfDirty()) return;
    const link = links.find((item) => item.key === key);
    if (link) { setSelectedKey(key); setForm(toForm(link)); }
  };
  const startNew = (): void => {
    if (!confirmDiscardIfDirty()) return;
    setSelectedKey("");
    setForm(emptyForm);
    setMessage("New link draft ready.");
  };
  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (orderDirty) {
      setMessage("Save the link order before saving link details.");
      return;
    }

    if (selected) await mutate("Saving link", `/admin/links/${encodeURIComponent(selected.key)}`, toPayload(form), selected.key);
    else await mutate("Creating link", "/admin/links", toPayload(form));
  };
  const togglePublished = async (link: CreatorLinkSource): Promise<void> => {
    if (orderDirty) {
      setMessage("Save the link order before changing publish state.");
      return;
    }

    const nextPublished = !link.isPublished;
    const action = nextPublished ? "Publishing link" : "Unpublishing link";
    if (isDirty) {
      if (!window.confirm(`${nextPublished ? "Publish" : "Save and unpublish"} these unsaved edits?`)) return;
      await mutate(action, `/admin/links/${encodeURIComponent(link.key)}`, toPayload({ ...form, isPublished: nextPublished }), link.key);
      return;
    }
    await mutate(action, `/admin/links/${encodeURIComponent(link.key)}`, { isPublished: nextPublished }, link.key);
  };
  const reorder = (sourceKey: string, targetKey: string): void => {
    const next = move(links, links.findIndex((item) => item.key === sourceKey), links.findIndex((item) => item.key === targetKey));
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
        const ordered = sortLinks(payload.links);
        setLinks(ordered);
        setOrderDirty(false);
        setMessage("Order saved.");
        setPreviewRevision((value) => value + 1);
      } else setMessage(failureMessage(response, payload?.ok === false ? payload.reason : undefined));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving order failed.");
    } finally { setBusy(null); }
  };

  const support = isSupport(form);
  const availability = support ? "unavailable" : form.availability;
  const validDestination = availability === "available" && (form.href.startsWith("/") || /^https?:\/\/[^\s]+$/u.test(form.href));
  const FormIcon = icons[form.icon];

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.heading}><span>Owner Admin</span><div><h1>Creator Hub Links</h1><p aria-live="polite">{message}</p></div></div>
      <div className={styles.headerActions}>
        <a href="/links" target="_blank" rel="noreferrer">Open /links <FiExternalLink aria-hidden="true" /></a>
        <button type="button" className={styles.primaryButton} onClick={startNew}><FiPlus aria-hidden="true" />New link</button>
      </div>
    </header>

    {loadState !== "ready" ? <section className={styles.state} data-state={loadState}>
      <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign in required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
      <p>{message}</p>{loadState !== "loading" ? <button type="button" onClick={() => void loadLinks()}>Retry</button> : null}
    </section> : <div className={styles.workspace}>
      <section className={styles.orderPanel} aria-labelledby="links-order-heading">
        <div className={styles.panelHeading}><h2 id="links-order-heading">Links &amp; order</h2></div>
        <div className={styles.linkList}>
          {links.length === 0 ? <p className={styles.empty}>No links yet.</p> : null}
          {links.map((link, index) => {
            const LinkIcon = icons[link.icon];
            return <div className={styles.linkRow} data-selected={selectedKey === link.key ? "true" : undefined} data-dragging={draggedKey === link.key ? "true" : undefined}
              draggable key={link.key} onDragStart={() => setDraggedKey(link.key)} onDragEnd={() => setDraggedKey(null)} onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedKey) reorder(draggedKey, link.key); setDraggedKey(null); }}>
              <span className={styles.dragHandle} title="Drag to reorder"><FiMenu aria-hidden="true" /></span>
              <button type="button" className={styles.linkIdentity} onClick={() => select(link.key)}>
                <span className={styles.linkIcon} data-icon={link.icon}><LinkIcon aria-hidden="true" /></span>
                <span><strong>{link.title}</strong><small>{(link.availability === "available" ? link.href : link.availabilityNote) || "No destination"}</small><em>{link.isPublished ? "Published" : "Draft"} · {label(link.availability)}</em></span>
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
              </div>
            </div>;
          })}
        </div>
        <footer className={styles.orderFooter}><button type="button" disabled={busy !== null || !orderDirty} onClick={() => void saveOrder()}>Save order</button><span>{orderDirty ? "Order changes are not saved yet" : "Order is saved"}</span></footer>
      </section>

      <section className={styles.editorPanel} aria-labelledby="link-editor-heading">
        <div className={styles.panelHeading}><h2 id="link-editor-heading">{selected ? "Edit link" : "New link"}</h2><span>{form.key || "unsaved"}</span></div>
        <form className={styles.form} onSubmit={(event) => void save(event)}>
          <label>Title<input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} required maxLength={191} /></label>
          {availability === "available" ? <label>Destination URL<input value={form.href} onChange={(event) => setForm((value) => ({ ...value, href: event.target.value }))} required maxLength={1024} />{validDestination ? <span className={styles.validation}><FiCheckCircle />Destination looks valid</span> : null}</label>
            : <label>Unavailable message<input value={support ? protectedFundingAvailabilityNote : form.availabilityNote} onChange={(event) => setForm((value) => ({ ...value, availabilityNote: event.target.value }))} required maxLength={191} disabled={support} /></label>}
          <label>Description<textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} required maxLength={2000} rows={4} /></label>
          <div className={styles.formGrid}>
            <label>Purpose<select value={form.purpose} onChange={(event) => { const purpose = event.target.value as CreatorLinkPurpose; setForm((value) => ({ ...value, purpose, ...(purpose === "support" ? { availability: "unavailable", href: "", availabilityNote: protectedFundingAvailabilityNote } : {}) })); }}>{purposes.map((purpose) => <option key={purpose} value={purpose}>{creatorLinkPurposeLabels[purpose]}</option>)}</select></label>
            <label>Icon<select value={form.icon} onChange={(event) => setForm((value) => ({ ...value, icon: event.target.value as CreatorLinkIcon }))}>{iconNames.map((icon) => <option key={icon} value={icon}>{label(icon)}</option>)}</select></label>
          </div>
          <div className={styles.presentationFeedback} aria-live="polite">
            <span className={styles.feedbackIcon} data-icon={form.icon}><FormIcon aria-hidden="true" /></span>
            <span><strong>Public presentation</strong><small>{creatorLinkPurposeLabels[form.purpose]} purpose · {label(form.icon)} icon</small></span>
          </div>
          <fieldset className={styles.availability} disabled={support}><legend>Availability</legend>{(["available", "unavailable"] as const).map((item) => <label key={item} data-active={availability === item ? "true" : undefined}><input type="radio" name="availability" checked={availability === item} onChange={() => setForm((value) => ({ ...value, availability: item }))} />{label(item)}</label>)}</fieldset>
          <div className={styles.checkboxGrid}>
            <label><input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm((value) => ({ ...value, isPrimary: event.target.checked }))} />Highlight on public links page</label>
            <label><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))} />Published after save</label>
          </div>
          <details className={styles.advanced} open={!selected}><summary>Link identity</summary><label>Key<input value={form.key} onChange={(event) => setForm((value) => ({ ...value, key: event.target.value }))} required pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} /></label></details>
          {support ? <p className={styles.supportWarning}>Support remains unavailable until Michael approves the destination URL and public wording.</p> : null}
          <footer className={styles.editorFooter}><div className={styles.editorStatus}><span>{isDirty ? "Unsaved changes" : "No unsaved changes"}</span>{selected ? <button type="button" disabled={busy !== null} onClick={() => void togglePublished(selected)}>{selected.isPublished ? "Unpublish" : "Publish now"}</button> : null}</div>
            <div><button type="button" disabled={busy !== null} onClick={() => { if (selected) { setForm(toForm(selected)); setMessage("Unsaved edits discarded."); } else { setForm(emptyForm); setMessage("Unsaved edits discarded."); } }}>Discard edits</button><button type="submit" className={styles.primaryButton} disabled={busy !== null || orderDirty} title={orderDirty ? "Save the link order first" : undefined}>{busy ?? (selected ? "Save link" : "Create link")}</button></div>
          </footer>
        </form>
      </section>

      <section className={styles.previewPanel} aria-labelledby="public-preview-heading">
        <div className={styles.previewHeading}><div><h2 id="public-preview-heading">Public preview</h2><p>Current published /links view</p></div><a href="/links" target="_blank" rel="noreferrer">Open exact page <FiExternalLink /></a></div>
        <div className={styles.previewFrame}><iframe key={previewRevision} src="/links" title="Current published Creator Links page" /></div>
      </section>
    </div>}
  </div>;
};

export default CreatorLinkAdminClient;
