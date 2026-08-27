import type { EventKind } from "./event-registry.types.js";
import type { ProviderEventPlatform } from "./provider-event-catalog.types.js";
import type {
  ProviderIntakeEventRoutingReviewInput,
  ProviderIntakeEventRoutingReviewResult
} from "./provider-intake-event-routing-review.types.js";

const triggerIncludesAny = (trigger: string, fragments: readonly string[]): boolean =>
  fragments.some((fragment) => trigger.includes(fragment));

const mapTwitchEventKind = (input: ProviderIntakeEventRoutingReviewInput): EventKind | null => {
  const trigger = input.internalTrigger.toLowerCase();
  const name = input.providerEventName.toLowerCase();

  if (input.category === "chat" && triggerIncludesAny(trigger, ["irc.privmsg", "chat-message"])) {
    return "chat";
  }

  if (name === "channel.follow") {
    return "twitch.follow";
  }

  if (name === "channel.subscription.end") {
    return null;
  }

  if (triggerIncludesAny(trigger, ["channel-subscribe", "channel-subscription", "subscription-message"])) {
    return "twitch.sub";
  }

  if (triggerIncludesAny(trigger, ["channel-cheer", "channel-bits-use", "bits-transaction"])) {
    return "twitch.bits";
  }

  if (name === "channel.raid") {
    return "twitch.raid";
  }

  if (triggerIncludesAny(trigger, ["reward-redemption", "power-up-redemption"])) {
    return "twitch.redeem";
  }

  return null;
};

const mapYouTubeEventKind = (input: ProviderIntakeEventRoutingReviewInput): EventKind | null => {
  const name = input.providerEventName.toLowerCase();

  if (input.category === "chat" && name === "textmessageevent") {
    return "chat";
  }

  if (name === "subscription") {
    return "youtube.subscriber";
  }

  if (["newsponsorevent", "membermilestonechatevent", "membershipgiftingevent", "giftmembershipreceivedevent"].includes(name)) {
    return "youtube.member";
  }

  if (name === "superchatevent") {
    return "youtube.super-chat";
  }

  if (name === "superstickerevent") {
    return "youtube.super-sticker";
  }

  return null;
};

const mapDiscordEventKind = (input: ProviderIntakeEventRoutingReviewInput): EventKind | null => {
  const name = input.providerEventName.toUpperCase();

  if (input.category === "chat" && name.includes("MESSAGE_CREATE")) {
    return "discord.message";
  }

  if (name === "GUILD_MEMBER_ADD") {
    return "discord.join";
  }

  if (["GUILD_MEMBER_UPDATE", "GUILD_ROLE_CREATE", "GUILD_ROLE_UPDATE", "GUILD_ROLE_DELETE"].includes(name)) {
    return "discord.role";
  }

  if (input.internalTrigger.toLowerCase().includes("boost")) {
    return "discord.boost";
  }

  return null;
};

export const resolveProviderIntakeEventKind = (
  input: ProviderIntakeEventRoutingReviewInput
): EventKind | null => {
  const mappers = {
    discord: mapDiscordEventKind,
    twitch: mapTwitchEventKind,
    youtube: mapYouTubeEventKind
  } satisfies Record<ProviderEventPlatform, (value: ProviderIntakeEventRoutingReviewInput) => EventKind | null>;

  return mappers[input.provider](input);
};

export const reviewProviderIntakeForInternalEventRouting = (
  input: ProviderIntakeEventRoutingReviewInput
): ProviderIntakeEventRoutingReviewResult => {
  if (!input.catalogKnown) {
    return {
      ok: false,
      reason: "provider_intake_review_unknown_catalog_event"
    };
  }

  if (input.authOrTokenShaped) {
    return {
      ok: false,
      reason: "provider_intake_review_auth_or_token_shaped"
    };
  }

  if (input.highVolume && input.category !== "chat") {
    return {
      ok: false,
      reason: "provider_intake_review_high_volume"
    };
  }

  const eventKind = resolveProviderIntakeEventKind(input);

  if (!eventKind) {
    return {
      ok: false,
      reason: "provider_intake_review_no_event_kind_mapping"
    };
  }

  return {
    ok: true,
    candidate: {
      destination: "internal_audit",
      eventKind,
      publicRoutingAllowed: false,
      reason: "provider_intake_review_internal_only",
      routingOutcome: "stored_internal",
      sourcePlatform: input.provider
    }
  };
};
