# Provider Event Intake Inventory and Internal Triggers

## Goal

Log every provider event we can reasonably receive from Twitch, YouTube, and Discord, then map each row to an internal event trigger even when we do not display it or act on it yet.

The first implementation should be intake-first:

- store raw provider event metadata safely
- normalize provider/source/channel/event identity
- map to a stable internal trigger key
- default to internal audit unless routing explicitly allows display
- keep provider writes, moderation enforcement, overlay playback, and money processing separate

This avoids losing offline subs, memberships, paid messages, boosts, moderation events, role changes, channel updates, and provider-token lifecycle events while still keeping public behavior conservative.

## Source Documents

- Twitch EventSub subscription types: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- YouTube LiveChatMessages resource and message types: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
- YouTube LiveChatMessages streamList: https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList
- YouTube Data API activities resource: https://developers.google.com/youtube/v3/docs/activities
- YouTube PubSubHubbub push notifications: https://developers.google.com/youtube/v3/guides/push_notifications
- Discord Gateway events: https://discord.com/developers/docs/events/gateway-events
- Discord Webhook events: https://discord.com/developers/docs/events/webhook-events

## Core Model

Add a provider-event catalog that is broader than the existing overlay/event-routing registry.

Suggested layers:

- `provider_event_catalog`: compile-time or seeded metadata for known provider event names, provider, source mechanism, category, default safety, and whether it can contain money/personal/moderation data.
- `provider_event_intake_log`: append-only raw intake ledger with provider, provider event type, provider event id/hash, channel/guild/broadcast/user references, observed timestamp, provider timestamp, redacted payload, raw-payload storage pointer if later approved, processing status, and normalized internal event kind.
- `event_history`: existing routing/audit table can receive a normalized internal event row after intake validation.
- `event_routing_rules`: display/routing stays explicit and should not decide whether intake rows are stored.

Important distinction:

- Provider event type: exact external event such as `channel.subscription.gift`, `superChatEvent`, or `MESSAGE_DELETE`.
- Internal event trigger: Maiks.yt event key such as `provider.twitch.subscription.gift`, `provider.youtube.live-chat.super-chat`, or `provider.discord.message.delete`.
- Routed display event: optional output to control panel, overlay, moderation queue, approval queue, or reports.

## Twitch EventSub Inventory

Official EventSub currently exposes these subscription types. We should catalog all of them, even if first runtime support only subscribes to a safe subset.

### Twitch Automod and Chat Safety

- `automod.message.hold` v1/v2
- `automod.message.update` v1/v2
- `automod.settings.update`
- `automod.terms.update`
- `channel.chat.clear`
- `channel.chat.clear_user_messages`
- `channel.chat.message`
- `channel.chat.message_delete`
- `channel.chat.notification`
- `channel.chat_settings.update`
- `channel.chat.user_message_hold`
- `channel.chat.user_message_update`
- `channel.suspicious_user.message`
- `channel.suspicious_user.update`
- `channel.warning.acknowledge`
- `channel.warning.send`

Default: internal audit plus moderation feed. Chat messages may enter private streamer chat. Public overlay requires explicit routing.

### Twitch Community and Monetization

- `channel.bits.use`
- `channel.cheer`
- `channel.follow`
- `channel.subscribe`
- `channel.subscription.end`
- `channel.subscription.gift`
- `channel.subscription.message`
- `channel.raid`
- `channel.channel_points_automatic_reward_redemption.add` v1/v2
- `channel.channel_points_custom_reward.add`
- `channel.channel_points_custom_reward.update`
- `channel.channel_points_custom_reward.remove`
- `channel.channel_points_custom_reward_redemption.add`
- `channel.channel_points_custom_reward_redemption.update`
- `channel.custom_power_up_redemption.add`
- `extension.bits_transaction.create`
- `channel.charity_campaign.donate`
- `channel.charity_campaign.start`
- `channel.charity_campaign.progress`
- `channel.charity_campaign.stop`

Default: store always, including offline. Bits, cheers, extension transactions, subscriptions, gifts, and charity donations are money-shaped and should be available to future accounting/reporting without public display by default.

### Twitch Channel State, Stream State, Goals, Polls, Predictions

- `channel.update`
- `channel.ad_break.begin`
- `channel.shared_chat.begin`
- `channel.shared_chat.update`
- `channel.shared_chat.end`
- `channel.poll.begin`
- `channel.poll.progress`
- `channel.poll.end`
- `channel.prediction.begin`
- `channel.prediction.progress`
- `channel.prediction.lock`
- `channel.prediction.end`
- `channel.goal.begin`
- `channel.goal.progress`
- `channel.goal.end`
- `channel.hype_train.begin`
- `channel.hype_train.progress`
- `channel.hype_train.end`
- `stream.online`
- `stream.offline`

Default: internal audit/control panel. Some may later become overlay-eligible, but never by default.

### Twitch Moderation, Roles, Account, Operations

- `channel.ban`
- `channel.unban`
- `channel.unban_request.create`
- `channel.unban_request.resolve`
- `channel.moderate` v1/v2
- `channel.moderator.add`
- `channel.moderator.remove`
- `channel.vip.add`
- `channel.vip.remove`
- `channel.shield_mode.begin`
- `channel.shield_mode.end`
- `channel.shoutout.create`
- `channel.shoutout.receive`
- `user.authorization.grant`
- `user.authorization.revoke`
- `user.update`
- `user.whisper.message`
- `conduit.shard.disabled`
- `drop.entitlement.grant`

Default: internal audit. Auth/token events must never route to overlay. Moderator/VIP/ban/unban events should feed moderation/admin views, not public display unless explicitly approved.

### Twitch Beta Guest Star

- `channel.guest_star_session.begin`
- `channel.guest_star_session.end`
- `channel.guest_star_guest.update`
- `channel.guest_star_settings.update`

Default: catalog only until beta status and runtime value are reviewed.

## YouTube Inventory

YouTube does not expose a Twitch-style EventSub catalog. We need combine Live Streaming chat resources, server-streaming/polling, channel activity resources, and PubSubHubbub feed notifications.

### YouTube Live Chat Message Types

Catalog every `liveChatMessage.snippet.type`:

- `textMessageEvent`
- `superChatEvent`
- `superStickerEvent`
- `newSponsorEvent`
- `memberMilestoneChatEvent`
- `membershipGiftingEvent`
- `giftMembershipReceivedEvent`
- `giftEvent`
- `pollDetails`
- `userBannedEvent`
- `tombstone`
- `chatEndedEvent`
- `sponsorOnlyModeStartedEvent`
- `sponsorOnlyModeEndedEvent`

Default:

- text messages go to private streamer chat
- Super Chat, Super Sticker, membership gifting, gift received, and gift events are money/support-shaped and must be logged for future reports
- user bans/tombstones/poll/sponsor-only/chat-ended events are internal audit/control-panel events
- overlay display requires explicit routing

Implementation note: YouTube recommends `liveChatMessages.streamList` for low-latency live-chat reads, while `list` includes `pollingIntervalMillis`. Current implementation uses polling; future upgrade can swap to streamList while keeping the same normalized trigger keys.

### YouTube Channel Activity Types

Catalog every documented `activity.snippet.type`:

- `channelItem`
- `comment` (documented as not currently returned)
- `favorite`
- `like`
- `playlistItem`
- `promotedItem`
- `recommendation`
- `social`
- `subscription`
- `upload`

Default: internal audit/content feed. Do not treat likes/subscriptions as reliable supporter events without checking privacy/API limits.

### YouTube Push Feed Notifications

PubSubHubbub channel feed notifications can indicate:

- video upload
- video title update
- video description update

Default: content update audit. Potential later use: schedule/project updates, channel feed, public site cards, Discord announcements.

## Discord Inventory

Discord has two relevant event surfaces:

- Gateway receive events for real-time guild/channel/community state.
- Webhook events for app authorization, entitlements, Social SDK, and app-level events.

### Discord Gateway Receive Events

Catalog these Gateway receive groups:

- connection/session: `HELLO`, `READY`, `RESUMED`, `RECONNECT`, `INVALID_SESSION`
- application commands: `APPLICATION_COMMAND_PERMISSIONS_UPDATE`
- auto moderation: `AUTO_MODERATION_RULE_CREATE`, `AUTO_MODERATION_RULE_UPDATE`, `AUTO_MODERATION_RULE_DELETE`, `AUTO_MODERATION_ACTION_EXECUTION`
- channels/threads/pins: `CHANNEL_CREATE`, `CHANNEL_UPDATE`, `CHANNEL_DELETE`, `CHANNEL_PINS_UPDATE`, `THREAD_CREATE`, `THREAD_UPDATE`, `THREAD_DELETE`, `THREAD_LIST_SYNC`, `THREAD_MEMBER_UPDATE`, `THREAD_MEMBERS_UPDATE`
- voice channel state: `VOICE_CHANNEL_STATUS_UPDATE`, `VOICE_CHANNEL_START_TIME_UPDATE`
- entitlements: `ENTITLEMENT_CREATE`, `ENTITLEMENT_UPDATE`, `ENTITLEMENT_DELETE`
- guild lifecycle/audit/moderation: `GUILD_CREATE`, `GUILD_UPDATE`, `GUILD_DELETE`, `GUILD_AUDIT_LOG_ENTRY_CREATE`, `GUILD_BAN_ADD`, `GUILD_BAN_REMOVE`
- guild assets/integrations: `GUILD_EMOJIS_UPDATE`, `GUILD_STICKERS_UPDATE`, `GUILD_INTEGRATIONS_UPDATE`
- members/roles/scheduled events: `GUILD_MEMBER_ADD`, `GUILD_MEMBER_REMOVE`, `GUILD_MEMBER_UPDATE`, `GUILD_MEMBERS_CHUNK`, `GUILD_ROLE_CREATE`, `GUILD_ROLE_UPDATE`, `GUILD_ROLE_DELETE`, `GUILD_SCHEDULED_EVENT_CREATE`, `GUILD_SCHEDULED_EVENT_UPDATE`, `GUILD_SCHEDULED_EVENT_DELETE`, `GUILD_SCHEDULED_EVENT_USER_ADD`, `GUILD_SCHEDULED_EVENT_USER_REMOVE`
- soundboard: `GUILD_SOUNDBOARD_SOUND_CREATE`, `GUILD_SOUNDBOARD_SOUND_UPDATE`, `GUILD_SOUNDBOARD_SOUND_DELETE`, `GUILD_SOUNDBOARD_SOUNDS_UPDATE`, `SOUNDBOARD_SOUNDS`
- integrations/invites: `INTEGRATION_CREATE`, `INTEGRATION_UPDATE`, `INTEGRATION_DELETE`, `INVITE_CREATE`, `INVITE_DELETE`
- messages/reactions: `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`, `MESSAGE_DELETE_BULK`, `MESSAGE_REACTION_ADD`, `MESSAGE_REACTION_REMOVE`, `MESSAGE_REACTION_REMOVE_ALL`, `MESSAGE_REACTION_REMOVE_EMOJI`
- presence/typing/user: `PRESENCE_UPDATE`, `TYPING_START`, `USER_UPDATE`
- voice: `VOICE_CHANNEL_EFFECT_SEND`, `VOICE_STATE_UPDATE`, `VOICE_SERVER_UPDATE`
- webhooks/interactions/stage/subscriptions/polls/rate limits: `WEBHOOKS_UPDATE`, `INTERACTION_CREATE`, `STAGE_INSTANCE_CREATE`, `STAGE_INSTANCE_UPDATE`, `STAGE_INSTANCE_DELETE`, `SUBSCRIPTION_CREATE`, `SUBSCRIPTION_UPDATE`, `SUBSCRIPTION_DELETE`, `MESSAGE_POLL_VOTE_ADD`, `MESSAGE_POLL_VOTE_REMOVE`, `RATE_LIMITED`

Default:

- message create/update/delete can feed private/moderator chat and audit
- member/role/ban/moderation events feed community/moderation/admin history
- entitlements/subscriptions are money/support-shaped and must be gated before financial behavior
- presence/typing/voice state are high-volume and should be disabled unless a concrete use exists
- application/auth/session/rate-limit events are internal-only

### Discord Webhook Events

Catalog these outgoing webhook event types:

- `APPLICATION_AUTHORIZED`
- `APPLICATION_DEAUTHORIZED`
- `ENTITLEMENT_CREATE`
- `ENTITLEMENT_UPDATE`
- `ENTITLEMENT_DELETE`
- `QUEST_USER_ENROLLMENT` (documented but currently unavailable)
- `LOBBY_MESSAGE_CREATE`
- `LOBBY_MESSAGE_UPDATE`
- `LOBBY_MESSAGE_DELETE`
- `GAME_DIRECT_MESSAGE_CREATE`
- `GAME_DIRECT_MESSAGE_UPDATE`
- `GAME_DIRECT_MESSAGE_DELETE`

Default: internal audit. Authorization/deauthorization affects linked accounts and token validity. Entitlements are money/support-shaped. Lobby/game DM events are Social SDK-specific and should stay catalog-only until used.

## Safety Defaults

- Store provider intake rows even when offline.
- Do not route privacy, token, auth, role, moderation, ban, deletion, or account events to public overlay.
- Money-shaped events must be logged but not counted as platform money until the money ledger phase defines provider mappings, fee rules, split rules, corrections, and export reports.
- Chat messages can enter private chat surfaces, but overlay display must go through explicit Event Routing.
- High-volume events need sampling/backpressure configuration before broad enablement.
- Unknown provider event types should be stored as `provider.<platform>.unknown` with the exact provider event type preserved, not discarded.

## Proposed Internal Trigger Namespace

Use stable names that keep provider and source mechanism obvious:

- `provider.twitch.eventsub.<subscription-type>`
- `provider.twitch.irc.chat-message`
- `provider.youtube.live-chat.<snippet-type>`
- `provider.youtube.activity.<activity-type>`
- `provider.youtube.pubsub.video-upload`
- `provider.youtube.pubsub.video-title-update`
- `provider.youtube.pubsub.video-description-update`
- `provider.discord.gateway.<event-name-lowercase>`
- `provider.discord.webhook.<event-type-lowercase>`

Then add curated aliases only where useful for routing:

- `chat`
- `provider.subscription`
- `provider.paid-message`
- `provider.boost`
- `provider.raid`
- `provider.follow`
- `provider.channel-update`
- `provider.moderation-action`
- `provider.auth-change`

The raw provider-specific trigger should always remain available for audit and debugging.

## First Implementation Chunks

### Chunk A: Provider Event Catalog, No Runtime Intake

- Add typed provider-event catalog files under `@maiks-yt/domain/events` or a new provider-events domain area.
- Include Twitch EventSub, YouTube live-chat/activity/pubsub, Discord Gateway, and Discord webhook event names.
- Add safety metadata: category, default destination, money-shaped, moderation-shaped, auth/token-shaped, high-volume, overlay-eligible default false.
- Add tests proving current broad catalog includes the official event names listed here.
- No database changes and no runtime intake changes.

### Chunk B: Intake Ledger Migration

- Generate a migration for append-only provider event intake logs.
- Include provider, provider event type, normalized trigger key, provider event id/hash, channel/guild/user references, timestamps, redacted payload, processing status, and event-history link.
- Do not apply in worker scope unless coordinator explicitly does it.

### Chunk C: Unknown-Safe Normalization

- Add pure normalization rules that map provider event names to internal trigger keys.
- Unknown event names should normalize to `provider.<platform>.unknown` and preserve the provider event type.
- Add tests for Twitch, YouTube, and Discord examples plus unknowns.

### Chunk D: Runtime Intake Expansion

- Start with logging only for already connected runtimes:
  - Twitch chat/EventSub selected subset
  - YouTube live-chat message types from current polling
  - Discord Gateway message/member/moderation subset
- Every received event writes intake log first, then optionally writes normalized `event_history`.
- Keep overlay routing disabled unless existing Event Routing rules explicitly route a safe normalized event.

### Chunk E: Provider Event Admin

- Add read-only admin page for provider event catalog and recent intake.
- Show what is enabled, disabled, missing scope, high-volume, money-shaped, moderation-shaped, and routeable.
- Add filters by provider/channel/event type/status.

## Open Questions

- Should the provider event catalog live in `@maiks-yt/domain/events` or as a new `@maiks-yt/domain/provider-events` area to keep the current Event Routing registry smaller?
- Should high-volume Discord presence/typing/voice events be catalog-only by default, with an explicit enable switch?
- Should raw redacted payloads live inline in the intake table first, or behind a separate payload table/blob pointer to keep rows small?
- Should money-shaped provider events immediately create pending money-ledger review rows once the money phase opens, or remain event-history-only until manually reconciled?
