# Stream Launch Automation Contract

## Status

Accepted direction. The durable binding/outbox and retry-safe local-create foundation are implemented in source; provider adapters, processing, deployment, and real-provider verification remain pending. This contract extends Maiks.yt's durable stream schedule; it does not claim a provider change merely because an admin form was saved.

## Owner intent

- One Maiks.yt schedule entry is the source of truth for title, description, start/end time, visibility, topic, game, and selected Twitch/YouTube channels.
- Saving a valid entry creates or updates a durable provider-publication plan.
- The control PWA shows the desired state, each provider's actual state, errors, and the exact recovery action.
- A Start Stream page performs a preflight and prepares provider metadata. Starting OBS/public output remains a separate explicit action.
- The existing translated Steam game records seed suggestions, but provider categories remain provider-specific identifiers that must be resolved and stored explicitly.

## Shared model

Each selected channel produces one delivery binding:

- `scheduleEntryId`
- `channelRef` and immutable provider/channel snapshots
- `provider`: `twitch` or `youtube`
- `desiredRevision`: monotonically increasing schedule revision
- `status`: `pending`, `syncing`, `ready`, `degraded`, `failed`, or `removed`
- `providerResourceId`: Twitch schedule segment ID or YouTube broadcast ID
- `providerStreamId`: YouTube liveStream ID; null for Twitch
- `providerCategoryId`
- `lastAttemptAt`, `lastSuccessAt`, `lastErrorCode`, and safe `lastErrorMessage`
- `idempotencyKey`: schedule entry, channel, operation, and desired revision

Provider calls run from a durable outbox. A schedule transaction writes the local schedule, channel targets, desired revision, and outbox intent together. Workers claim one intent, reconcile against provider state, and record the result. Retries never create a second provider event for the same desired revision.

## Twitch mapping

Twitch does not have a YouTube-style broadcast-to-ingest binding.

- Optional planning: `Create Channel Stream Schedule Segment` creates a Twitch schedule segment. Non-recurring segments are limited to partners and affiliates, so an unsupported account is a visible degraded state rather than a local save failure.
- Launch preparation: `Modify Channel Information` sets title and category immediately before the stream.
- Required user-token scopes are `channel:manage:schedule` for schedule segments and `channel:manage:broadcast` for channel metadata.
- The broadcaster ID must match the user represented by the access token. A bot token or another channel's token cannot publish for the selected broadcaster.

Official references:

- https://dev.twitch.tv/docs/api/reference#create-channel-stream-schedule-segment
- https://dev.twitch.tv/docs/api/reference#modify-channel-information
- https://dev.twitch.tv/docs/api/schedule/

## YouTube mapping

- `liveBroadcasts.insert` creates the scheduled public/unlisted/private event.
- A reusable compatible `liveStream` may be selected, or `liveStreams.insert` creates one when needed.
- `liveBroadcasts.bind` binds the broadcast to exactly one stream.
- Before a manual transition, Maiks.yt verifies the bound stream is active. Auto-start/auto-stop settings are explicit schedule policy, never inferred.
- Maiks.yt stores both the broadcast ID and stream ID. Reconciliation lists existing owned resources before creating replacements.

Official references:

- https://developers.google.com/youtube/v3/live/guides/implementation/broadcasts-and-streams
- https://developers.google.com/youtube/v3/live/life-of-a-broadcast
- https://developers.google.com/youtube/v3/live/docs/liveBroadcasts
- https://developers.google.com/youtube/v3/live/docs/liveStreams

## Category layers

The UI presents four distinct concepts without pretending they are interchangeable:

1. Maiks.yt stream subject: broad internal grouping such as Gaming, Development, or Just Chatting.
2. Maiks.yt game: the existing game-library row, often reconciled from Steam.
3. Twitch category: a Twitch game/category ID resolved from the selected game or an Owner override.
4. YouTube category: a YouTube video category ID; the specific game remains in Maiks.yt metadata, title, and description because YouTube's category taxonomy is broader.

Resolved provider category IDs are stored per schedule/channel binding. A title match alone is never treated as authoritative after reconciliation.

## Start Stream page

The control PWA page shows:

- schedule entry and selected destinations;
- title, description, 24-hour start/end, subject, and game;
- provider connection, required scopes, category resolution, and planned-event state;
- YouTube broadcast/stream binding state;
- Twitch schedule capability and current title/category readiness;
- OBS connection, selected profile/collection/scene, and output state;
- a dry-run preflight with blocking versus optional failures;
- an explicit Prepare Providers action;
- a separately confirmed Go Live action.

No countdown, social post, or OBS output starts merely from opening the page.

## Internal events

The authoritative countdown becomes a Maiks.yt runtime component, not an OpenDeck-only timer. Its state includes duration, startsAt, remaining, running/paused/completed, revision, and originating schedule entry. OpenDeck and OBS render/control the same state.

Lifecycle events can drive later automation:

- `stream.preflight-passed`
- `stream.providers-prepared`
- `stream.countdown-started`
- `stream.go-live-requested`
- `stream.provider-live`
- `stream.ended`

Automated social posts subscribe to these events only after an explicit per-channel policy and preview/approval rule exists.

## Error and recovery contract

- Local form data remains until the schedule transaction is accepted.
- Provider publication errors do not erase the accepted local schedule.
- Errors identify the provider, channel, failed operation, safe reason, retry state, and exact next action.
- Missing consent/scope is `degraded` and Owner-actionable; rate limits use server-directed backoff; invalid category mappings return to review; uncertain network results reconcile before retry.
- Removing a local channel target does not automatically delete a public provider event until the UI shows the consequence and the Owner confirms that deletion.

## Initial implementation sequence

1. Durable delivery-binding and outbox schema plus domain rules.
2. Read-only provider capability/preflight adapters.
3. Twitch schedule and metadata reconciliation with sandboxed/dry-run tests.
4. YouTube broadcast/stream/bind reconciliation after Owner consent.
5. Control PWA Start Stream page.
6. Authoritative Maiks.yt countdown runtime and OpenDeck/OBS clients.
7. Social-post subscribers behind explicit policies.
