# Game Library and Play Schedule

## Idea

Create a website/admin feature for managing games Michael wants to play, games already owned, games suggested by viewers, and a future play schedule.

This should help answer:

- what games are on Michael's radar
- what games are already owned
- what games are planned for a stream
- what viewers have suggested
- what games are not a fit right now
- whether gifted games are possible later

## Why It Matters

Streams need a practical planning surface. A game library gives Michael one place to track possible future content, connect games to stream schedules, and let the community suggest ideas without turning every suggestion into an obligation.

It can also support transparency. If a game is suggested, rejected, queued, paused, or planned, the reason can be visible enough to reduce repeated questions.

## First Version Scope

Start with a manual owner/admin game library:

- game title
- platform or store, such as Steam, Epic, Xbox, PlayStation, Switch, itch.io, or other
- ownership status: owned, not owned, borrowed, subscription access, gifted, unknown
- interest status: interested, maybe later, currently playing, completed, paused, not a fit
- stream fit notes
- content warnings or stream-safety notes
- preferred stream category or theme
- link to a scheduled stream when planned
- public visibility toggle

Public pages can show a curated list, such as:

- currently playing
- planned soon
- maybe later
- completed on stream
- viewer-suggested highlights

## Game Suggestions

Viewer suggestions should be separate from owner-approved game records.

Suggested fields:

- suggested game title
- optional store/platform link
- suggested by website user or anonymous visitor
- short reason
- optional tags, such as cozy, survival, automation, community, horror, story, multiplayer
- review status: pending, accepted, maybe later, rejected, duplicate, already played
- owner/moderator note

Suggestions should not automatically appear publicly unless reviewed.

## Play Schedule

Game scheduling should connect to the existing stream schedule instead of becoming a second schedule system.

Possible links:

- scheduled stream points to a selected game record
- game record shows upcoming planned stream dates
- overlay/control panel can later know the active game/theme
- game pages can show last played and next planned stream

The first version should not sync to Twitch/YouTube categories automatically. Provider category sync is a later provider-integration gate.

## Gifted Games

Gifted games are a later phase and need careful boundaries.

Possible future workflow:

- public wishlist of games Michael is open to receive
- clear "gift does not guarantee a stream" wording
- owner approval before a gifted game appears publicly
- track who gifted it only if the giver chooses to be public
- private audit trail for gifted-game claims
- ability to decline or mark as unsuitable

Gifted games may involve money/value, refunds, platform terms, public expectations, and privacy. Do not implement gifts until the money/support/provider gates are reviewed.

## Data Needed

- game records
- platforms/stores
- ownership/access status
- stream fit and content-warning notes
- suggestion records
- review status and reviewer notes
- optional linked website user
- optional linked schedule entries
- optional project/theme/category links
- future gift records and audit trail

## Build Requirements

- owner/admin game library page
- public curated game list page
- suggestion form with review queue
- duplicate detection by title/platform
- manual link from stream schedule to game record
- safe public wording for suggestions and ownership state
- moderation/review path for offensive suggestions
- future provider/store integration only after separate review

## Safety Boundaries

- Suggestions are not public by default.
- Game gifts are not money-free just because the platform calls them gifts.
- No automatic provider/store purchasing, claiming, or wishlist sync in the first version.
- No public promise that suggested or gifted games will be played.
- No real money, credits, refunds, support perks, or sponsor behavior in the first version.
- No provider account linking beyond existing approved account-linking phases.
- Content warnings and stream-safety notes are owner-controlled.

## Related Cards

- [Stream scheduling and cancellations](./stream-scheduling-and-cancellations.md)
- [Gaming platform account linking](./gaming-platform-account-linking.md)
- [User profiles and verified game names](./user-profiles-verified-game-names.md)
- [Channel and hobby backlog](./channel-and-hobby-backlog.md)
- [Wishlist integrations](./wishlist-integrations.md)
- [Payment provider and money reality check](./payment-provider-and-money-reality-check.md)

## Open Questions

- Should public viewers be able to suggest games without signing in?
- Should suggestions require moderation before Michael sees them?
- Which game platforms matter first?
- Should game records be linked to projects, stream themes, or both?
- Should completed games get public notes or ratings?
- What wording is needed before accepting gifted games?
- Should gifted games be tracked privately even if the giver stays anonymous publicly?
