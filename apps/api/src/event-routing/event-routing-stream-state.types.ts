import type { ProviderEventPlatform } from "@maiks-yt/domain/events";

export type EventRoutingKnownStreamState = "live" | "offline";

export type EventRoutingStreamStateResolution =
  | { state: EventRoutingKnownStreamState }
  | { state: "unknown" };

export type EventRoutingStreamStateResolveInput = {
  occurredAt: Date | null;
  provider: ProviderEventPlatform;
  providerChannelId: string | null;
  providerChannelIdentityId: string | null;
  receivedAt: Date;
};

export type EventRoutingStreamStateResolver = {
  resolve(input: EventRoutingStreamStateResolveInput):
    | EventRoutingStreamStateResolution
    | Promise<EventRoutingStreamStateResolution>;
};
