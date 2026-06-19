# Viewer-Influenced Stream-Safe Music

## Idea

Add a future stream tool where viewers can suggest and vote on music, but only from an approved stream-safe catalog.

The important rule is that viewers influence the queue; they do not directly control playback. The streamer always keeps final control over what plays on stream.

## Why It Matters

Music can make streams feel more alive, but open song requests are risky. A pre-reviewed catalog gives the community a fun way to participate while reducing copyright, VOD, and moderation risk.

Keeping playback in a separate browser/audio source also makes OBS control easier. It can have its own volume, mute, and source routing, and it leaves room for future live-only or VOD-safe audio setups.

## Product Rules

- Only approved tracks can be voted on or played.
- Viewer suggestions go to a review inbox, never straight into the live queue.
- The streamer can veto, stop, skip, pause, mute, change volume, and reorder the queue at any time.
- The music player and music overlay should stay separate surfaces: the player owns audio, while the overlay only shows state.
- Live-safe and VOD-safe should be separate fields, not assumed to be the same.
- Spotify should not be treated as the foundation for broadcast music control.

## Possible Surfaces

- `/music/player`: separate browser/audio source that actually plays music.
- `/music/overlay`: viewer-facing now-playing, attribution, safety badge, and vote display.
- `/music/suggest`: public suggestion form.
- Existing control panel: streamer-only live music controls.
- Website admin: music approval and catalog management.
- Twitch Extension: future viewer suggestions and voting inside Twitch.

The separate player endpoint is intentional. OBS can add it as its own browser source or audio source, which allows independent volume control, muting, monitoring, and future audio routing. The normal stream overlay should consume the same now-playing state but should not be responsible for playing audio.

Live music controls should be rolled into the existing stream control panel rather than becoming a separate panel. Approving suggested tracks, editing catalog metadata, and reviewing license safety should happen in a normal website admin page because those are off-stream administrative tasks.

## Data Needed

- title
- artist
- duration
- source or library
- license or policy link
- approval status: `approved`, `needs-review`, or `rejected`
- live-safe flag
- VOD-safe flag
- attribution text
- mood, genre, and energy tags
- internal notes

## Build Requirements

- Approved music catalog.
- Manual review workflow for suggested tracks.
- Website admin page for approving/rejecting suggested tracks and editing license metadata.
- Existing stream control panel section for playback, veto, skip, pause, mute, volume, and queue management.
- Private player endpoint suitable for OBS as a separate browser/audio source.
- Overlay endpoint for now-playing, attribution, track safety, and voting display.
- Shared now-playing state API used by both `/music/player` and `/music/overlay`.
- Independent streamer controls for player volume, pause, skip, mute, and emergency stop.
- Voting system limited to approved tracks.
- Public suggestion form that creates review items.
- Later Twitch Extension for suggestions and voting.
- Later OBS audio-routing investigation for live-only and VOD-safe separation.

## Suggested Phases

1. Define the approved music library and review workflow.
2. Build streamer controls and a private player endpoint.
3. Add viewer voting for approved tracks only.
4. Add website suggestions.
5. Add a Twitch Extension for suggestions and voting inside Twitch.
6. Investigate OBS audio routing for live-only and VOD-safe separation.

## Risks And Source Notes

- Twitch has a DMCA process and repeat-infringer policy. Its policy notes that repeat infringement can lead to account termination and describes three copyright strikes as the repeat-infringer threshold. Source to re-check before implementation: https://legal.twitch.com/en/legal/dmca-guidelines/
- Twitch Extensions can support this kind of viewer interaction. Twitch describes Extensions as sandboxed webpages inside Twitch, available as panel, overlay, or component views. Source to re-check before implementation: https://dev.twitch.tv/docs/extensions/
- Spotify is not a good foundation for this feature. Spotify's developer policy includes restrictions around non-interactive webcasting, integrations with streams or content from another service, and synchronization of sound recordings with visual media. Source to re-check before implementation: https://developer.spotify.com/policy
- The safest path is explicitly stream-safe catalogs or manually approved tracks where the license or policy is stored with the track.

## Open Questions

- Which music libraries are acceptable for live use, VOD use, or both?
- Should the system support local audio files, remote library URLs, or both?
- Should suggestions require login, or can guests suggest into a stricter review queue?
- Should votes expire per stream, per topic, or persist as long-term popularity?
- How should attribution be displayed on overlay, public pages, and VOD descriptions?
- Should the player fail closed if a track is missing license metadata?
