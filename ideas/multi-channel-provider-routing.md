# Multi-Channel Provider Routing

## Idea

Maiks.yt should treat external streaming destinations as separate channel identities, not as a single provider login.

Michael may stream different topics to different YouTube channels or Brand Accounts, and may later keep one Twitch channel for all gaming or split Twitch channels by topic. Discord may also have guild/channel-specific intake and routing later.

## Why It Matters

People who follow Minecraft content may not want notifications for Satisfactory, dev work, AI experiments, or other topics. The platform should support topic-specific audiences without forcing Michael to hardcode one permanent channel setup.

This also matches the real account structure:

- A Google login can have access to multiple YouTube channels or Brand Accounts.
- YouTube channel ownership/access can move between Google accounts.
- Twitch may eventually be one merged gaming channel or multiple channels.
- Provider access and channel routing should be changeable without rewriting feature code.

## Core Concepts

- **Provider account**: OAuth/bot credential or API connection, such as Google, Twitch, or Discord.
- **Channel identity**: A destination/source such as a YouTube channel, Twitch channel, Discord guild, or Discord text channel.
- **Content lane**: A topic/audience grouping such as Minecraft, Satisfactory, dev, AI, IRL, MaiksMC, or main.
- **Routing rule**: A mapping from content lane or scheduled stream to one or more provider channel identities.

## First Safe Scope

Start with YouTube because the first owner credential already exists.

- Use the stored Google/YouTube credential to call a read-only channel discovery endpoint.
- List every YouTube channel/Brand Account accessible through that credential.
- Store channel identity separately from the OAuth credential.
- Let owner mark one or more discovered YouTube channels as available destinations.
- Let owner add local labels such as Minecraft, Satisfactory, Dev, Main, or MaiksMC.
- Show channel id, title, handle/custom URL if available, thumbnail if useful, and last verified time.
- Do not start live-chat polling in this slice.
- Do not route public notifications, overlay output, money, provider writes, or moderation actions in this slice.

## Later Scope

- Connect stream schedule entries to a content lane.
- Let a scheduled stream choose one or more destination channels.
- Scope chat intake to the active stream's selected channel identities.
- Support multiple YouTube channels under one Google credential.
- Support multiple Google credentials if needed for channels not visible from the first credential.
- Support Twitch channel identities, even if Michael later chooses one merged gaming channel.
- Support Discord guild/channel identities for chat, announcements, and moderator surfaces.
- Add per-lane overlay theme defaults, notification routing, and public page links.

## Safety Rules

- Do not assume one provider login equals one stream destination.
- Do not hardcode a main YouTube channel.
- Keep provider credentials separate from channel identities.
- Store raw provider tokens only in credential storage, never in channel records.
- Channel discovery is read-only.
- Channel selection should be owner-gated.
- Live/offline flags should control display/routing, not whether provider events are registered.
- Provider writes, moderation enforcement, money, and production behavior remain separate explicit phases.

## Open Questions

- Which local content lanes should be seeded first?
- Should a stream schedule entry select exactly one content lane, or allow multiple lanes?
- Should a YouTube channel be allowed in multiple lanes?
- Do we need per-lane public pages, or should this stay internal routing at first?
- Should primary/secondary destination ordering matter for overlays and public schedule display?
