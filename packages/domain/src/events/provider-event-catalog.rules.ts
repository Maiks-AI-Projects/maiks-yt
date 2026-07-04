import type {
  ProviderEventCatalogEntry,
  ProviderEventCatalogSummary,
  ProviderEventCategory,
  ProviderEventMechanism,
  ProviderEventPlatform,
  ProviderEventSafety
} from "./provider-event-catalog.types.js";

const defaultSafety = {
  authOrTokenShaped: false,
  highVolume: false,
  internalOnly: true,
  moderationShaped: false,
  moneyShaped: false,
  overlayEligibleByDefault: false,
  providerWriteRequired: false
} satisfies ProviderEventSafety;

const chatSafety = {
  ...defaultSafety,
  highVolume: true,
  internalOnly: false
} satisfies ProviderEventSafety;

const moneySafety = {
  ...defaultSafety,
  moneyShaped: true
} satisfies ProviderEventSafety;

const moderationSafety = {
  ...defaultSafety,
  moderationShaped: true
} satisfies ProviderEventSafety;

const authSafety = {
  ...defaultSafety,
  authOrTokenShaped: true
} satisfies ProviderEventSafety;

const entry = (
  platform: ProviderEventPlatform,
  mechanism: ProviderEventMechanism,
  category: ProviderEventCategory,
  providerEventName: string,
  label: string,
  description: string,
  safety: ProviderEventSafety = defaultSafety
): ProviderEventCatalogEntry => ({
  category,
  description,
  internalTrigger: `provider.${platform}.${mechanism.replace(`${platform}-`, "").replaceAll("-", ".")}.${providerEventName.toLowerCase().replaceAll("_", "-").replaceAll(".", "-")}`,
  label,
  mechanism,
  platform,
  providerEventName,
  safety
});

const twitchEventSub = (
  category: ProviderEventCategory,
  providerEventName: string,
  label: string,
  description: string,
  safety: ProviderEventSafety = defaultSafety
): ProviderEventCatalogEntry => entry("twitch", "twitch-eventsub", category, providerEventName, label, description, safety);

const youtubeLiveChat = (
  category: ProviderEventCategory,
  providerEventName: string,
  label: string,
  description: string,
  safety: ProviderEventSafety = defaultSafety
): ProviderEventCatalogEntry => entry("youtube", "youtube-live-chat", category, providerEventName, label, description, safety);

const youtubeActivity = (providerEventName: string, label: string): ProviderEventCatalogEntry =>
  entry("youtube", "youtube-activity", "content", providerEventName, label, "A YouTube channel activity event.");

const discordGateway = (
  category: ProviderEventCategory,
  providerEventName: string,
  label: string,
  description: string,
  safety: ProviderEventSafety = defaultSafety
): ProviderEventCatalogEntry => entry("discord", "discord-gateway", category, providerEventName, label, description, safety);

const discordWebhook = (
  category: ProviderEventCategory,
  providerEventName: string,
  label: string,
  description: string,
  safety: ProviderEventSafety = defaultSafety
): ProviderEventCatalogEntry => entry("discord", "discord-webhook", category, providerEventName, label, description, safety);

export const providerEventCatalog = [
  twitchEventSub("moderation", "automod.message.hold", "Automod Message Hold", "A Twitch message was held by Automod.", moderationSafety),
  twitchEventSub("moderation", "automod.message.hold.v2", "Automod Message Hold V2", "A Twitch message was held by Automod V2.", moderationSafety),
  twitchEventSub("moderation", "automod.message.update", "Automod Message Update", "A Twitch Automod queue message changed status.", moderationSafety),
  twitchEventSub("moderation", "automod.message.update.v2", "Automod Message Update V2", "A Twitch Automod queue message changed status in V2.", moderationSafety),
  twitchEventSub("moderation", "automod.settings.update", "Automod Settings Update", "Twitch Automod settings changed.", moderationSafety),
  twitchEventSub("moderation", "automod.terms.update", "Automod Terms Update", "Twitch Automod terms changed.", moderationSafety),
  twitchEventSub("money", "channel.bits.use", "Bits Use", "Bits were used on a Twitch channel.", moneySafety),
  twitchEventSub("channel", "channel.update", "Channel Update", "Twitch channel title, category, language, or classification changed."),
  twitchEventSub("community", "channel.follow", "Follow", "A Twitch channel received a follow."),
  twitchEventSub("money", "channel.ad_break.begin", "Ad Break Begin", "A Twitch midroll ad break started.", moneySafety),
  twitchEventSub("moderation", "channel.chat.clear", "Chat Clear", "Twitch chat was cleared.", moderationSafety),
  twitchEventSub("moderation", "channel.chat.clear_user_messages", "User Messages Cleared", "A user's Twitch chat messages were cleared.", moderationSafety),
  twitchEventSub("chat", "channel.chat.message", "Chat Message", "A Twitch chat message was sent.", chatSafety),
  twitchEventSub("moderation", "channel.chat.message_delete", "Chat Message Delete", "A Twitch chat message was deleted.", moderationSafety),
  twitchEventSub("interaction", "channel.chat.notification", "Chat Notification", "A Twitch chat-visible event occurred."),
  twitchEventSub("moderation", "channel.chat_settings.update", "Chat Settings Update", "Twitch chat settings changed.", moderationSafety),
  twitchEventSub("moderation", "channel.chat.user_message_hold", "User Message Hold", "A user's Twitch message was held by Automod.", moderationSafety),
  twitchEventSub("moderation", "channel.chat.user_message_update", "User Message Update", "A held Twitch message changed Automod status.", moderationSafety),
  twitchEventSub("chat", "channel.shared_chat.begin", "Shared Chat Begin", "A Twitch shared chat session began.", chatSafety),
  twitchEventSub("chat", "channel.shared_chat.update", "Shared Chat Update", "A Twitch shared chat session changed.", chatSafety),
  twitchEventSub("chat", "channel.shared_chat.end", "Shared Chat End", "A Twitch shared chat session ended.", chatSafety),
  twitchEventSub("money", "channel.subscribe", "Subscribe", "A Twitch subscription started.", moneySafety),
  twitchEventSub("money", "channel.subscription.end", "Subscription End", "A Twitch subscription ended.", moneySafety),
  twitchEventSub("money", "channel.subscription.gift", "Gift Subscription", "A Twitch gift subscription occurred.", moneySafety),
  twitchEventSub("money", "channel.subscription.message", "Resubscription Message", "A Twitch resubscription chat message was sent.", moneySafety),
  twitchEventSub("money", "channel.cheer", "Cheer", "A Twitch cheer occurred.", moneySafety),
  twitchEventSub("community", "channel.raid", "Raid", "A Twitch raid occurred."),
  twitchEventSub("moderation", "channel.ban", "Ban", "A Twitch viewer was banned.", moderationSafety),
  twitchEventSub("moderation", "channel.unban", "Unban", "A Twitch viewer was unbanned.", moderationSafety),
  twitchEventSub("moderation", "channel.unban_request.create", "Unban Request Create", "A Twitch unban request was created.", moderationSafety),
  twitchEventSub("moderation", "channel.unban_request.resolve", "Unban Request Resolve", "A Twitch unban request was resolved.", moderationSafety),
  twitchEventSub("moderation", "channel.moderate", "Moderate", "A Twitch moderation action occurred.", moderationSafety),
  twitchEventSub("moderation", "channel.moderate.v2", "Moderate V2", "A Twitch moderation action occurred with warning support.", moderationSafety),
  twitchEventSub("roles", "channel.moderator.add", "Moderator Add", "A Twitch moderator was added.", moderationSafety),
  twitchEventSub("roles", "channel.moderator.remove", "Moderator Remove", "A Twitch moderator was removed.", moderationSafety),
  twitchEventSub("system", "channel.guest_star_session.begin", "Guest Star Session Begin", "A Twitch Guest Star session began."),
  twitchEventSub("system", "channel.guest_star_session.end", "Guest Star Session End", "A Twitch Guest Star session ended."),
  twitchEventSub("system", "channel.guest_star_guest.update", "Guest Star Guest Update", "A Twitch Guest Star guest or slot changed."),
  twitchEventSub("system", "channel.guest_star_settings.update", "Guest Star Settings Update", "Twitch Guest Star settings changed."),
  twitchEventSub("interaction", "channel.channel_points_automatic_reward_redemption.add", "Automatic Reward Redemption", "A Twitch automatic channel-points reward was redeemed."),
  twitchEventSub("interaction", "channel.channel_points_automatic_reward_redemption.add.v2", "Automatic Reward Redemption V2", "A Twitch automatic channel-points reward was redeemed in V2."),
  twitchEventSub("interaction", "channel.channel_points_custom_reward.add", "Custom Reward Add", "A Twitch custom channel-points reward was created."),
  twitchEventSub("interaction", "channel.channel_points_custom_reward.update", "Custom Reward Update", "A Twitch custom channel-points reward changed."),
  twitchEventSub("interaction", "channel.channel_points_custom_reward.remove", "Custom Reward Remove", "A Twitch custom channel-points reward was removed."),
  twitchEventSub("interaction", "channel.channel_points_custom_reward_redemption.add", "Custom Reward Redemption", "A Twitch custom channel-points reward was redeemed."),
  twitchEventSub("interaction", "channel.channel_points_custom_reward_redemption.update", "Custom Reward Redemption Update", "A Twitch custom channel-points redemption changed."),
  twitchEventSub("interaction", "channel.custom_power_up_redemption.add", "Custom Power-Up Redemption", "A Twitch custom Power-up was redeemed."),
  twitchEventSub("interaction", "channel.poll.begin", "Poll Begin", "A Twitch poll began."),
  twitchEventSub("interaction", "channel.poll.progress", "Poll Progress", "A Twitch poll changed."),
  twitchEventSub("interaction", "channel.poll.end", "Poll End", "A Twitch poll ended."),
  twitchEventSub("interaction", "channel.prediction.begin", "Prediction Begin", "A Twitch prediction began."),
  twitchEventSub("interaction", "channel.prediction.progress", "Prediction Progress", "A Twitch prediction changed."),
  twitchEventSub("interaction", "channel.prediction.lock", "Prediction Lock", "A Twitch prediction locked."),
  twitchEventSub("interaction", "channel.prediction.end", "Prediction End", "A Twitch prediction ended."),
  twitchEventSub("moderation", "channel.suspicious_user.message", "Suspicious User Message", "A suspicious Twitch user sent a message.", moderationSafety),
  twitchEventSub("moderation", "channel.suspicious_user.update", "Suspicious User Update", "A suspicious Twitch user state changed.", moderationSafety),
  twitchEventSub("roles", "channel.vip.add", "VIP Add", "A Twitch VIP was added."),
  twitchEventSub("roles", "channel.vip.remove", "VIP Remove", "A Twitch VIP was removed."),
  twitchEventSub("moderation", "channel.warning.acknowledge", "Warning Acknowledgement", "A Twitch warning was acknowledged.", moderationSafety),
  twitchEventSub("moderation", "channel.warning.send", "Warning Send", "A Twitch warning was sent.", moderationSafety),
  twitchEventSub("money", "channel.charity_campaign.donate", "Charity Donation", "A Twitch charity donation occurred.", moneySafety),
  twitchEventSub("money", "channel.charity_campaign.start", "Charity Campaign Start", "A Twitch charity campaign started.", moneySafety),
  twitchEventSub("money", "channel.charity_campaign.progress", "Charity Campaign Progress", "A Twitch charity campaign changed.", moneySafety),
  twitchEventSub("money", "channel.charity_campaign.stop", "Charity Campaign Stop", "A Twitch charity campaign stopped.", moneySafety),
  twitchEventSub("operations", "conduit.shard.disabled", "Conduit Shard Disabled", "A Twitch EventSub conduit shard was disabled."),
  twitchEventSub("community", "drop.entitlement.grant", "Drop Entitlement Grant", "A Twitch drop entitlement was granted."),
  twitchEventSub("money", "extension.bits_transaction.create", "Extension Bits Transaction", "A Twitch extension Bits transaction occurred.", moneySafety),
  twitchEventSub("interaction", "channel.goal.begin", "Goal Begin", "A Twitch goal began."),
  twitchEventSub("interaction", "channel.goal.progress", "Goal Progress", "A Twitch goal changed."),
  twitchEventSub("interaction", "channel.goal.end", "Goal End", "A Twitch goal ended."),
  twitchEventSub("interaction", "channel.hype_train.begin", "Hype Train Begin", "A Twitch Hype Train began."),
  twitchEventSub("interaction", "channel.hype_train.progress", "Hype Train Progress", "A Twitch Hype Train changed."),
  twitchEventSub("interaction", "channel.hype_train.end", "Hype Train End", "A Twitch Hype Train ended."),
  twitchEventSub("moderation", "channel.shield_mode.begin", "Shield Mode Begin", "Twitch Shield Mode was activated.", moderationSafety),
  twitchEventSub("moderation", "channel.shield_mode.end", "Shield Mode End", "Twitch Shield Mode was deactivated.", moderationSafety),
  twitchEventSub("community", "channel.shoutout.create", "Shoutout Create", "A Twitch shoutout was sent."),
  twitchEventSub("community", "channel.shoutout.receive", "Shoutout Received", "A Twitch shoutout was received."),
  twitchEventSub("stream", "stream.online", "Stream Online", "A Twitch stream started."),
  twitchEventSub("stream", "stream.offline", "Stream Offline", "A Twitch stream stopped."),
  twitchEventSub("auth", "user.authorization.grant", "Authorization Grant", "A Twitch authorization was granted.", authSafety),
  twitchEventSub("auth", "user.authorization.revoke", "Authorization Revoke", "A Twitch authorization was revoked.", authSafety),
  twitchEventSub("auth", "user.update", "User Update", "A Twitch user account changed.", authSafety),
  twitchEventSub("chat", "user.whisper.message", "Whisper Message", "A Twitch whisper was received.", chatSafety),
  entry("twitch", "twitch-irc", "chat", "PRIVMSG", "IRC Chat Message", "A Twitch IRC chat message was received.", chatSafety),

  youtubeLiveChat("chat", "textMessageEvent", "Text Message", "A YouTube live chat text message was sent.", chatSafety),
  youtubeLiveChat("money", "superChatEvent", "Super Chat", "A YouTube Super Chat was purchased.", moneySafety),
  youtubeLiveChat("money", "superStickerEvent", "Super Sticker", "A YouTube Super Sticker was purchased.", moneySafety),
  youtubeLiveChat("money", "newSponsorEvent", "New Member", "A YouTube channel membership started.", moneySafety),
  youtubeLiveChat("money", "memberMilestoneChatEvent", "Member Milestone Chat", "A YouTube member milestone chat was sent.", moneySafety),
  youtubeLiveChat("money", "membershipGiftingEvent", "Membership Gifting", "YouTube memberships were gifted.", moneySafety),
  youtubeLiveChat("money", "giftMembershipReceivedEvent", "Gift Membership Received", "A YouTube gift membership was received.", moneySafety),
  youtubeLiveChat("money", "giftEvent", "Gift Event", "A YouTube Jewels gift event occurred.", moneySafety),
  youtubeLiveChat("interaction", "pollDetails", "Poll Event", "A YouTube live poll event occurred."),
  youtubeLiveChat("moderation", "userBannedEvent", "User Banned", "A YouTube live chat user was banned.", moderationSafety),
  youtubeLiveChat("moderation", "tombstone", "Tombstone", "A deleted YouTube live chat message placeholder was returned.", moderationSafety),
  youtubeLiveChat("stream", "chatEndedEvent", "Chat Ended", "A YouTube live chat ended."),
  youtubeLiveChat("moderation", "sponsorOnlyModeStartedEvent", "Sponsor-Only Mode Started", "YouTube sponsor-only chat mode started.", moderationSafety),
  youtubeLiveChat("moderation", "sponsorOnlyModeEndedEvent", "Sponsor-Only Mode Ended", "YouTube sponsor-only chat mode ended.", moderationSafety),
  youtubeActivity("channelItem", "Channel Item"),
  youtubeActivity("comment", "Comment"),
  youtubeActivity("favorite", "Favorite"),
  youtubeActivity("like", "Like"),
  youtubeActivity("playlistItem", "Playlist Item"),
  youtubeActivity("promotedItem", "Promoted Item"),
  youtubeActivity("recommendation", "Recommendation"),
  youtubeActivity("social", "Social Post"),
  youtubeActivity("subscription", "Subscription"),
  youtubeActivity("upload", "Upload"),
  entry("youtube", "youtube-pubsub", "content", "video.upload", "Video Upload", "A YouTube PubSubHubbub feed reported a video upload."),
  entry("youtube", "youtube-pubsub", "content", "video.title.update", "Video Title Update", "A YouTube PubSubHubbub feed reported a title update."),
  entry("youtube", "youtube-pubsub", "content", "video.description.update", "Video Description Update", "A YouTube PubSubHubbub feed reported a description update."),

  discordGateway("system", "HELLO", "Hello", "Discord Gateway hello."),
  discordGateway("system", "READY", "Ready", "Discord Gateway ready."),
  discordGateway("system", "RESUMED", "Resumed", "Discord Gateway resumed."),
  discordGateway("system", "RECONNECT", "Reconnect", "Discord Gateway reconnect requested."),
  discordGateway("system", "INVALID_SESSION", "Invalid Session", "Discord Gateway session became invalid."),
  discordGateway("roles", "APPLICATION_COMMAND_PERMISSIONS_UPDATE", "Application Command Permissions Update", "Discord command permissions changed."),
  discordGateway("moderation", "AUTO_MODERATION_RULE_CREATE", "Auto Moderation Rule Create", "A Discord automod rule was created.", moderationSafety),
  discordGateway("moderation", "AUTO_MODERATION_RULE_UPDATE", "Auto Moderation Rule Update", "A Discord automod rule was updated.", moderationSafety),
  discordGateway("moderation", "AUTO_MODERATION_RULE_DELETE", "Auto Moderation Rule Delete", "A Discord automod rule was deleted.", moderationSafety),
  discordGateway("moderation", "AUTO_MODERATION_ACTION_EXECUTION", "Auto Moderation Action Execution", "Discord automod executed an action.", moderationSafety),
  discordGateway("channel", "CHANNEL_CREATE", "Channel Create", "A Discord channel was created."),
  discordGateway("channel", "CHANNEL_UPDATE", "Channel Update", "A Discord channel changed."),
  discordGateway("channel", "CHANNEL_DELETE", "Channel Delete", "A Discord channel was deleted."),
  discordGateway("channel", "CHANNEL_PINS_UPDATE", "Channel Pins Update", "Discord channel pins changed."),
  discordGateway("channel", "THREAD_CREATE", "Thread Create", "A Discord thread was created."),
  discordGateway("channel", "THREAD_UPDATE", "Thread Update", "A Discord thread changed."),
  discordGateway("channel", "THREAD_DELETE", "Thread Delete", "A Discord thread was deleted."),
  discordGateway("channel", "THREAD_LIST_SYNC", "Thread List Sync", "Discord thread list sync occurred."),
  discordGateway("channel", "THREAD_MEMBER_UPDATE", "Thread Member Update", "A Discord thread member changed."),
  discordGateway("channel", "THREAD_MEMBERS_UPDATE", "Thread Members Update", "Discord thread members changed."),
  discordGateway("channel", "VOICE_CHANNEL_STATUS_UPDATE", "Voice Channel Status Update", "A Discord voice channel status changed."),
  discordGateway("channel", "VOICE_CHANNEL_START_TIME_UPDATE", "Voice Channel Start Time Update", "A Discord voice channel start time changed."),
  discordGateway("money", "ENTITLEMENT_CREATE", "Entitlement Create", "A Discord entitlement was created.", moneySafety),
  discordGateway("money", "ENTITLEMENT_UPDATE", "Entitlement Update", "A Discord entitlement changed.", moneySafety),
  discordGateway("money", "ENTITLEMENT_DELETE", "Entitlement Delete", "A Discord entitlement was deleted.", moneySafety),
  discordGateway("community", "GUILD_CREATE", "Guild Create", "Discord guild became available."),
  discordGateway("community", "GUILD_UPDATE", "Guild Update", "Discord guild changed."),
  discordGateway("community", "GUILD_DELETE", "Guild Delete", "Discord guild became unavailable or was removed."),
  discordGateway("moderation", "GUILD_AUDIT_LOG_ENTRY_CREATE", "Audit Log Entry Create", "A Discord audit log entry was created.", moderationSafety),
  discordGateway("moderation", "GUILD_BAN_ADD", "Guild Ban Add", "A Discord guild ban was added.", moderationSafety),
  discordGateway("moderation", "GUILD_BAN_REMOVE", "Guild Ban Remove", "A Discord guild ban was removed.", moderationSafety),
  discordGateway("community", "GUILD_EMOJIS_UPDATE", "Guild Emojis Update", "Discord guild emojis changed."),
  discordGateway("community", "GUILD_STICKERS_UPDATE", "Guild Stickers Update", "Discord guild stickers changed."),
  discordGateway("community", "GUILD_INTEGRATIONS_UPDATE", "Guild Integrations Update", "Discord guild integrations changed."),
  discordGateway("community", "GUILD_MEMBER_ADD", "Guild Member Add", "A Discord guild member joined."),
  discordGateway("community", "GUILD_MEMBER_REMOVE", "Guild Member Remove", "A Discord guild member left."),
  discordGateway("roles", "GUILD_MEMBER_UPDATE", "Guild Member Update", "A Discord guild member changed."),
  discordGateway("roles", "GUILD_MEMBERS_CHUNK", "Guild Members Chunk", "A Discord guild members chunk was received.", { ...defaultSafety, highVolume: true }),
  discordGateway("roles", "GUILD_ROLE_CREATE", "Guild Role Create", "A Discord role was created."),
  discordGateway("roles", "GUILD_ROLE_UPDATE", "Guild Role Update", "A Discord role changed."),
  discordGateway("roles", "GUILD_ROLE_DELETE", "Guild Role Delete", "A Discord role was deleted."),
  discordGateway("community", "GUILD_SCHEDULED_EVENT_CREATE", "Scheduled Event Create", "A Discord scheduled event was created."),
  discordGateway("community", "GUILD_SCHEDULED_EVENT_UPDATE", "Scheduled Event Update", "A Discord scheduled event changed."),
  discordGateway("community", "GUILD_SCHEDULED_EVENT_DELETE", "Scheduled Event Delete", "A Discord scheduled event was deleted."),
  discordGateway("community", "GUILD_SCHEDULED_EVENT_USER_ADD", "Scheduled Event User Add", "A user subscribed to a Discord scheduled event."),
  discordGateway("community", "GUILD_SCHEDULED_EVENT_USER_REMOVE", "Scheduled Event User Remove", "A user unsubscribed from a Discord scheduled event."),
  discordGateway("community", "GUILD_SOUNDBOARD_SOUND_CREATE", "Soundboard Sound Create", "A Discord soundboard sound was created."),
  discordGateway("community", "GUILD_SOUNDBOARD_SOUND_UPDATE", "Soundboard Sound Update", "A Discord soundboard sound changed."),
  discordGateway("community", "GUILD_SOUNDBOARD_SOUND_DELETE", "Soundboard Sound Delete", "A Discord soundboard sound was deleted."),
  discordGateway("community", "GUILD_SOUNDBOARD_SOUNDS_UPDATE", "Soundboard Sounds Update", "Discord soundboard sounds changed."),
  discordGateway("community", "SOUNDBOARD_SOUNDS", "Soundboard Sounds", "Discord soundboard sounds were received."),
  discordGateway("community", "INTEGRATION_CREATE", "Integration Create", "A Discord integration was created."),
  discordGateway("community", "INTEGRATION_UPDATE", "Integration Update", "A Discord integration changed."),
  discordGateway("community", "INTEGRATION_DELETE", "Integration Delete", "A Discord integration was deleted."),
  discordGateway("community", "INVITE_CREATE", "Invite Create", "A Discord invite was created."),
  discordGateway("community", "INVITE_DELETE", "Invite Delete", "A Discord invite was deleted."),
  discordGateway("chat", "MESSAGE_CREATE", "Message Create", "A Discord message was created.", chatSafety),
  discordGateway("chat", "MESSAGE_UPDATE", "Message Update", "A Discord message changed.", chatSafety),
  discordGateway("moderation", "MESSAGE_DELETE", "Message Delete", "A Discord message was deleted.", moderationSafety),
  discordGateway("moderation", "MESSAGE_DELETE_BULK", "Message Delete Bulk", "Discord messages were deleted in bulk.", moderationSafety),
  discordGateway("interaction", "MESSAGE_REACTION_ADD", "Message Reaction Add", "A Discord message reaction was added.", { ...defaultSafety, highVolume: true }),
  discordGateway("interaction", "MESSAGE_REACTION_REMOVE", "Message Reaction Remove", "A Discord message reaction was removed.", { ...defaultSafety, highVolume: true }),
  discordGateway("interaction", "MESSAGE_REACTION_REMOVE_ALL", "Message Reaction Remove All", "All Discord message reactions were removed."),
  discordGateway("interaction", "MESSAGE_REACTION_REMOVE_EMOJI", "Message Reaction Remove Emoji", "Discord message reactions for an emoji were removed."),
  discordGateway("community", "PRESENCE_UPDATE", "Presence Update", "A Discord presence changed.", { ...defaultSafety, highVolume: true }),
  discordGateway("interaction", "TYPING_START", "Typing Start", "A Discord typing indicator started.", { ...defaultSafety, highVolume: true }),
  discordGateway("auth", "USER_UPDATE", "User Update", "The connected Discord user changed.", authSafety),
  discordGateway("community", "VOICE_CHANNEL_EFFECT_SEND", "Voice Channel Effect Send", "A Discord voice channel effect was sent."),
  discordGateway("community", "VOICE_STATE_UPDATE", "Voice State Update", "A Discord voice state changed.", { ...defaultSafety, highVolume: true }),
  discordGateway("system", "VOICE_SERVER_UPDATE", "Voice Server Update", "Discord voice server information changed."),
  discordGateway("system", "WEBHOOKS_UPDATE", "Webhooks Update", "Discord channel webhooks changed."),
  discordGateway("interaction", "INTERACTION_CREATE", "Interaction Create", "A Discord interaction was created."),
  discordGateway("community", "STAGE_INSTANCE_CREATE", "Stage Instance Create", "A Discord stage instance was created."),
  discordGateway("community", "STAGE_INSTANCE_UPDATE", "Stage Instance Update", "A Discord stage instance changed."),
  discordGateway("community", "STAGE_INSTANCE_DELETE", "Stage Instance Delete", "A Discord stage instance was deleted."),
  discordGateway("money", "SUBSCRIPTION_CREATE", "Subscription Create", "A Discord subscription was created.", moneySafety),
  discordGateway("money", "SUBSCRIPTION_UPDATE", "Subscription Update", "A Discord subscription changed.", moneySafety),
  discordGateway("money", "SUBSCRIPTION_DELETE", "Subscription Delete", "A Discord subscription was deleted.", moneySafety),
  discordGateway("interaction", "MESSAGE_POLL_VOTE_ADD", "Poll Vote Add", "A Discord poll vote was added."),
  discordGateway("interaction", "MESSAGE_POLL_VOTE_REMOVE", "Poll Vote Remove", "A Discord poll vote was removed."),
  discordGateway("operations", "RATE_LIMITED", "Rate Limited", "The Discord client was rate limited."),
  discordWebhook("auth", "APPLICATION_AUTHORIZED", "Application Authorized", "The Discord app was authorized.", authSafety),
  discordWebhook("auth", "APPLICATION_DEAUTHORIZED", "Application Deauthorized", "The Discord app was deauthorized.", authSafety),
  discordWebhook("money", "ENTITLEMENT_CREATE", "Webhook Entitlement Create", "A Discord webhook entitlement was created.", moneySafety),
  discordWebhook("money", "ENTITLEMENT_UPDATE", "Webhook Entitlement Update", "A Discord webhook entitlement changed.", moneySafety),
  discordWebhook("money", "ENTITLEMENT_DELETE", "Webhook Entitlement Delete", "A Discord webhook entitlement was deleted.", moneySafety),
  discordWebhook("community", "QUEST_USER_ENROLLMENT", "Quest User Enrollment", "A Discord quest enrollment event was reported."),
  discordWebhook("chat", "LOBBY_MESSAGE_CREATE", "Lobby Message Create", "A Discord lobby message was created.", chatSafety),
  discordWebhook("chat", "LOBBY_MESSAGE_UPDATE", "Lobby Message Update", "A Discord lobby message changed.", chatSafety),
  discordWebhook("moderation", "LOBBY_MESSAGE_DELETE", "Lobby Message Delete", "A Discord lobby message was deleted.", moderationSafety),
  discordWebhook("chat", "GAME_DIRECT_MESSAGE_CREATE", "Game Direct Message Create", "A Discord game direct message was created.", chatSafety),
  discordWebhook("chat", "GAME_DIRECT_MESSAGE_UPDATE", "Game Direct Message Update", "A Discord game direct message changed.", chatSafety),
  discordWebhook("moderation", "GAME_DIRECT_MESSAGE_DELETE", "Game Direct Message Delete", "A Discord game direct message was deleted.", moderationSafety)
] as const satisfies readonly ProviderEventCatalogEntry[];

export const getProviderEventCatalogEntry = (
  platform: ProviderEventPlatform,
  providerEventName: string
): ProviderEventCatalogEntry | null =>
  providerEventCatalog.find((catalogEntry) =>
    catalogEntry.platform === platform
    && catalogEntry.providerEventName === providerEventName
  ) ?? null;

export const listProviderEventCatalogEntries = (
  platform?: ProviderEventPlatform
): ProviderEventCatalogEntry[] =>
  providerEventCatalog
    .filter((catalogEntry) => !platform || catalogEntry.platform === platform)
    .map((catalogEntry) => ({ ...catalogEntry, safety: { ...catalogEntry.safety } }));

export const summarizeProviderEventCatalog = (): ProviderEventCatalogSummary => {
  const byPlatform = {
    discord: 0,
    twitch: 0,
    youtube: 0
  } satisfies Record<ProviderEventPlatform, number>;
  const actions = {
    authOrTokenShaped: 0,
    highVolume: 0,
    internalOnly: 0,
    moderationShaped: 0,
    moneyShaped: 0,
    overlayEligibleByDefault: 0
  };

  for (const catalogEntry of providerEventCatalog) {
    byPlatform[catalogEntry.platform] += 1;
    actions.authOrTokenShaped += catalogEntry.safety.authOrTokenShaped ? 1 : 0;
    actions.highVolume += catalogEntry.safety.highVolume ? 1 : 0;
    actions.internalOnly += catalogEntry.safety.internalOnly ? 1 : 0;
    actions.moderationShaped += catalogEntry.safety.moderationShaped ? 1 : 0;
    actions.moneyShaped += catalogEntry.safety.moneyShaped ? 1 : 0;
    actions.overlayEligibleByDefault += catalogEntry.safety.overlayEligibleByDefault ? 1 : 0;
  }

  return {
    actions,
    byPlatform,
    total: providerEventCatalog.length
  };
};
