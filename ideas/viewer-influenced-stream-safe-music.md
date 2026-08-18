# Viewer-Influenced Stream-Safe Music

## Idea

Add a future stream tool where viewers can suggest and vote on music from allowed providers when the provider and license metadata pass the stream-safety rules.

The important rule is that viewers influence the queue; they do not directly control playback. The streamer always keeps final control over what plays on stream.

## Why It Matters

Music can make streams feel more alive, but unrestricted song requests are risky. Provider and license eligibility rules let the community participate without requiring Michael to listen to and manually approve hundreds of songs in advance.

Keeping playback in a separate browser/audio source also makes OBS control easier. It can have its own volume, mute, and source routing, and it leaves room for future live-only or VOD-safe audio setups.

## Product Rules

- Tracks from allowed providers can be selected, requested, queued, and played when their provider/license metadata passes the configured stream-safety policy and they are not blacklisted.
- Provider/license eligibility and Michael's personal review state are separate. Eligible tracks do not require manual pre-approval.
- Tracks with uncertain, missing, or incompatible rights metadata go to review and never straight into the live queue.
- A streamer skip records the playback outcome and places the track in a review queue. Michael can keep it available, restrict it, or blacklist it during or after the stream.
- Anonymous public requests are limited to one accepted request per IP-derived privacy key per Europe/Amsterdam calendar day. Raw IP addresses are not retained for this feature.
- Signed-in members can maintain a ranked Top 10. The default allowance is ten tracks and can later be raised by a reward or membership tier without redesigning the data model.
- The streamer can veto, stop, skip, pause, mute, change volume, and reorder the queue at any time.
- The music player and music overlay should stay separate surfaces: the player owns audio, while the overlay only shows state.
- Live-safe and VOD-safe should be separate fields, not assumed to be the same.
- Catalog, request, member-pick, and admin-review surfaces use a searchable track select plus inline preview playback with play/pause and seeking where the audio source supports it.
- Every played track creates durable history with title, artist, source, license, attribution, and safety snapshots so a later catalog edit cannot erase what was played.
- Blacklisted tracks are not selectable, requestable, queueable, or playable. A blacklist action takes effect immediately.
- Restricted or actively reviewed tracks are hidden from public/member selection but remain previewable in admin.
- The member allowance defaults to ten, but rank storage is not hard-limited to ten so later reward tiers do not require a schema migration.
- Local audio records use opaque storage references and checksums, never absolute server filesystem paths.
- Spotify should not be treated as the foundation for broadcast music control.

## Possible Surfaces

- `/music/player`: separate browser/audio source that actually plays music.
- `/music/overlay`: viewer-facing now-playing, attribution, safety badge, and vote display.
- `/music/suggest`: public suggestion form.
- `/music/request`: public eligible-track request form.
- Signed-in account music page: ranked Top 10 management and preview playback.
- Existing control panel: streamer-only live music controls.
- Website admin: catalog, playlist, suggestion review, blacklist, license metadata, preview playback, and played-history management.
- Twitch Extension: future viewer suggestions and voting inside Twitch.

The separate player endpoint is intentional. OBS can add it as its own browser source or audio source, which allows independent volume control, muting, monitoring, and future audio routing. The normal stream overlay should consume the same now-playing state but should not be responsible for playing audio.

Live music controls should be rolled into the existing stream control panel rather than becoming a separate panel. Approving suggested tracks, editing catalog metadata, and reviewing license safety should happen in a normal website admin page because those are off-stream administrative tasks.

## Data Needed

- title
- artist
- duration
- source or library
- license or policy link
- rights eligibility: `eligible`, `needs-review`, or `ineligible`
- personal review state: `unreviewed`, `keep`, `review`, or `blacklisted`
- live-safe flag
- VOD-safe flag
- attribution text
- mood, genre, and energy tags
- internal notes
- preview or local audio reference
- immutable played-history snapshot fields

## Build Requirements

- Allowed-provider catalog with automatic provider/license eligibility and a blacklist override.
- Manual review workflow for suggested tracks.
- Website admin page for approving/rejecting suggested tracks and editing license metadata.
- Existing stream control panel section for playback, veto, skip, pause, mute, volume, and queue management.
- Private player endpoint suitable for OBS as a separate browser/audio source.
- Overlay endpoint for now-playing, attribution, track safety, and voting display.
- Shared now-playing state API used by both `/music/player` and `/music/overlay`.
- Independent streamer controls for player volume, pause, skip, mute, and emergency stop.
- Voting system limited to eligible, non-blacklisted tracks.
- Public suggestion form that creates review items.
- Public eligible-track request with privacy-preserving daily rate limiting.
- Signed-in ranked Top 10 with a default limit of ten and a future tier-provided allowance.
- Shared searchable track select and preview player controls.
- Durable played-music history for later incident and rights review.
- Later Twitch Extension for suggestions and voting.
- Later OBS audio-routing investigation for live-only and VOD-safe separation.

## Suggested Phases

1. Define allowed providers, automatic rights eligibility, skip review, and blacklist workflow.
2. Build streamer controls and a private player endpoint.
3. Add viewer voting for eligible, non-blacklisted tracks only.
4. Add website suggestions.
5. Add a Twitch Extension for suggestions and voting inside Twitch.
6. Investigate OBS audio routing for live-only and VOD-safe separation.

## Risks And Source Notes

- Twitch has a DMCA process and repeat-infringer policy. Its policy notes that repeat infringement can lead to account termination and describes three copyright strikes as the repeat-infringer threshold. Source to re-check before implementation: https://legal.twitch.com/en/legal/dmca-guidelines/
- Twitch Extensions can support this kind of viewer interaction. Twitch describes Extensions as sandboxed webpages inside Twitch, available as panel, overlay, or component views. Source to re-check before implementation: https://dev.twitch.tv/docs/extensions/
- Spotify is not a good foundation for this feature. Spotify's developer policy includes restrictions around non-interactive webcasting, integrations with streams or content from another service, and synchronization of sound recordings with visual media. Source to re-check before implementation: https://developer.spotify.com/policy
- The safest scalable path is allowed providers with machine-checkable rights metadata, stored license evidence, and a manual review fallback for uncertain or skipped tracks.

## Open Questions

- Which music libraries are acceptable for live use, VOD use, or both?
- Should the system support local audio files, remote library URLs, or both?
- Should suggestions require login, or can guests suggest into a stricter review queue?
- Should votes expire per stream, per topic, or persist as long-term popularity?
- How should attribution be displayed on overlay, public pages, and VOD descriptions?
- Should the player fail closed if a track is missing license metadata?

## Current Decisions

- Public/member discovery can include eligible provider results that are persisted into the internal catalog when selected or requested.
- The anonymous daily limit applies to the public request endpoint only.
- The first owner capabilities are `music:manage` and `music:play-control`; owner wildcard retains both.
- Missing or uncertain license metadata fails closed into review.
