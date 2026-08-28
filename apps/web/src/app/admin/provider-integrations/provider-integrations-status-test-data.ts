export const createValidProviderIntegrationsStatusPayload = () => ({
  ok: true,
  generatedAt: "2026-08-28T08:00:00.000Z",
  providers: [
    {
      id: "twitch",
      label: "Twitch",
      readiness: "ready",
      capabilities: [
        { key: "twitch_api_access", label: "Twitch API access", state: "available" },
        { key: "twitch_chat_intake", label: "Twitch chat intake", state: "available" },
        { key: "twitch_eventsub_intake", label: "Twitch event intake", state: "needs_setup" }
      ],
      runtime: {
        state: "connected",
        accountSummary: "maiksmc",
        connectedAt: "2026-08-28T07:00:00.000Z",
        lastActivityAt: "2026-08-28T07:59:00.000Z",
        nextRetryAt: null
      },
      guidance: null
    },
    {
      id: "youtube",
      label: "YouTube",
      readiness: "ready",
      capabilities: [
        { key: "youtube_data_access", label: "YouTube data access", state: "available" },
        { key: "youtube_owner_consent", label: "YouTube owner consent", state: "available" },
        { key: "youtube_live_chat_intake", label: "YouTube live chat intake", state: "available" }
      ],
      runtime: {
        state: "waiting",
        accountSummary: "MaiksMC",
        connectedAt: null,
        lastActivityAt: null,
        nextRetryAt: null
      },
      guidance: null
    },
    {
      id: "discord",
      label: "Discord",
      readiness: "ready",
      capabilities: [
        { key: "discord_bot_access", label: "Discord bot access", state: "available" },
        { key: "discord_guild_target", label: "Discord guild target", state: "available" },
        { key: "discord_webhook_intake", label: "Discord webhook intake", state: "needs_setup" },
        { key: "discord_chat_intake", label: "Discord chat intake", state: "available" }
      ],
      runtime: {
        state: "stopped",
        accountSummary: "2 configured channels",
        connectedAt: null,
        lastActivityAt: null,
        nextRetryAt: null
      },
      guidance: "Start intake when this provider should capture live activity."
    }
  ]
});
