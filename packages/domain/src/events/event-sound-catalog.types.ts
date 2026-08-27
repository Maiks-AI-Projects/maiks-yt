import type { EventKind } from "./event-registry.types.js";

export type EventRoutingSoundRef =
  | "chat-radio-ping"
  | "redeem-digital-interference"
  | "follow-creaky-door"
  | "sub-key-in-lock"
  | "gift-sub-metal-door"
  | "bits-loot-unlock"
  | "mod-action-door-shut"
  | "error-electric-fence"
  | "poll-countdown"
  | "poll-result-radio-swell"
  | "raid-broken-radio"
  | "large-raid-zombie-growl";

export type EventRoutingSoundCatalogEntry = {
  ref: EventRoutingSoundRef;
  label: string;
  publicPath: `/event-sounds/${string}.wav`;
  sourcePath: `${string}.wav`;
  sourceTitle: string;
  recommendedFor: readonly EventKind[];
  catalogOnly?: boolean;
};
