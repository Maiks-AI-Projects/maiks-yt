export const eventActionCategories = [
  "approval",
  "internal",
  "moderation",
  "money",
  "notification",
  "overlay",
  "provider-write",
  "streamer",
  "tts"
] as const;

export type EventActionCategory = typeof eventActionCategories[number];

export const eventActionKeys = [
  "internal.log",
  "control-panel.show",
  "system-notification.create",
  "approval.queue",
  "overlay.top-notification",
  "overlay.center-notification",
  "streamer-chat.show",
  "streamer-feed.show",
  "moderation.review",
  "moderation.hide-local-message",
  "moderation.ban-from-stream-surfaces",
  "money.review",
  "provider.warn-in-origin-chat",
  "provider.delete-origin-message",
  "provider.timeout-origin-user",
  "provider.ban-origin-user",
  "tts.play-approved"
] as const;

export type EventActionKey = typeof eventActionKeys[number];

export type EventActionSafety = {
  readonly enabledInCurrentPhase: boolean;
  readonly moneyGated: boolean;
  readonly moderationGated: boolean;
  readonly publicOutput: boolean;
  readonly providerWriteRequired: boolean;
  readonly requiresApprovalSupport: boolean;
};

export type EventActionCatalogEntry = {
  readonly category: EventActionCategory;
  readonly description: string;
  readonly key: EventActionKey;
  readonly label: string;
  readonly safety: EventActionSafety;
};
