import {
  eventActionKeys,
  type EventActionCatalogEntry,
  type EventActionCategory,
  type EventActionKey,
  type EventActionSafety
} from "./event-action-catalog.types.js";

const defaultSafety = {
  enabledInCurrentPhase: true,
  moderationGated: false,
  moneyGated: false,
  providerWriteRequired: false,
  publicOutput: false,
  requiresApprovalSupport: false
} satisfies EventActionSafety;

const publicSafety = {
  ...defaultSafety,
  publicOutput: true,
  requiresApprovalSupport: true
} satisfies EventActionSafety;

const providerWriteSafety = {
  ...defaultSafety,
  enabledInCurrentPhase: false,
  moderationGated: true,
  providerWriteRequired: true
} satisfies EventActionSafety;

const action = (
  key: EventActionKey,
  label: string,
  category: EventActionCategory,
  description: string,
  safety: EventActionSafety = defaultSafety
): EventActionCatalogEntry => ({
  category,
  description,
  key,
  label,
  safety
});

export const eventActionCatalog = [
  action("internal.log", "Log Internally", "internal", "Append the event to internal audit/history."),
  action("control-panel.show", "Show In Control Panel", "streamer", "Show the event in private control surfaces."),
  action("system-notification.create", "Create System Notification", "notification", "Create a private notification for the owner/helper workflow."),
  action("approval.queue", "Send To Approval Queue", "approval", "Require owner or permitted helper approval before public playback."),
  action("overlay.top-notification", "Top Overlay Notification", "overlay", "Display an approved event in the top overlay notification zone.", publicSafety),
  action("overlay.center-notification", "Center Overlay Notification", "overlay", "Display an approved event in the center overlay notification zone.", publicSafety),
  action("streamer-chat.show", "Show In Streamer Chat", "streamer", "Show an event or message in private streamer chat."),
  action("streamer-feed.show", "Show In Streamer Feed", "streamer", "Show an event in a private chronological streamer/moderator feed."),
  action("moderation.review", "Open Moderation Review", "moderation", "Create or update a moderation review item.", {
    ...defaultSafety,
    moderationGated: true
  }),
  action("moderation.hide-local-message", "Hide From Local Stream Surfaces", "moderation", "Hide a message from Maiks.yt local chat/overlay surfaces only.", {
    ...defaultSafety,
    moderationGated: true
  }),
  action("moderation.ban-from-stream-surfaces", "Ban From Stream Surfaces", "moderation", "Block a user/author from Maiks.yt local stream surfaces only.", {
    ...defaultSafety,
    moderationGated: true
  }),
  action("money.review", "Create Money Review", "money", "Create a future money/accounting review row without treating it as settled ledger money.", {
    ...defaultSafety,
    enabledInCurrentPhase: false,
    moneyGated: true
  }),
  action("provider.warn-in-origin-chat", "Warn In Origin Chat", "provider-write", "Send a warning message back to the originating provider chat.", providerWriteSafety),
  action("provider.delete-origin-message", "Delete Origin Message", "provider-write", "Delete or hide the original provider message where supported.", providerWriteSafety),
  action("provider.timeout-origin-user", "Timeout Origin User", "provider-write", "Timeout the originating provider user where supported.", providerWriteSafety),
  action("provider.ban-origin-user", "Ban Origin User", "provider-write", "Ban the originating provider user where supported.", providerWriteSafety),
  action("tts.play-approved", "Play Approved TTS", "tts", "Play approved TTS through a stream-safe TTS output.", {
    ...publicSafety,
    enabledInCurrentPhase: false
  })
] as const satisfies readonly EventActionCatalogEntry[];

const eventActionKeySet = new Set<string>(eventActionKeys);

export const isEventActionKey = (value: unknown): value is EventActionKey =>
  typeof value === "string" && eventActionKeySet.has(value);

export const getEventActionCatalogEntry = (key: EventActionKey): EventActionCatalogEntry =>
  eventActionCatalog.find((catalogEntry) => catalogEntry.key === key) as EventActionCatalogEntry;

export const listEventActionCatalogEntries = (): EventActionCatalogEntry[] =>
  eventActionCatalog.map((catalogEntry) => ({
    ...catalogEntry,
    safety: { ...catalogEntry.safety }
  }));
