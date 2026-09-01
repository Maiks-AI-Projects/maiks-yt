# Maiks.yt VLC playback contract

This is the source contract for sibling work that talks to Maiks.yt music playback or the streaming-PC Local Agent. It describes source behavior only. It is not live installation proof.

## Local Agent connection

- WebSocket path: `/local-agent/live`
- Subprotocol: `maiks-local-agent.v1`
- Protocol version: `1`
- Credential: bearer token in the `Authorization` header only
- Capability: `vlc-music`
- Command lease: API coordinator issues playback commands with a 15 second expiry

`/local-agent/connect` is not the contract. Config and service setup must use `/local-agent/live`.

## Audio routes

The selectable audio routes are fixed typed IDs. Do not send PipeWire sink names as route IDs.

| Route ID | Label | PipeWire sink | Media role |
| --- | --- | --- | --- |
| `communication` | Communication | `stream_communication` | `Communication` |
| `music` | Music | `stream_music` | `Music` |
| `private` | Private | `stream_private` | `Private` |
| `game` | Game | `stream_game` | `Game` |

Route states are `available`, `unavailable`, `error`, or `reconnecting`. The API reports canonical labels and sink names. The Local Agent reports the runtime state for each route after inspecting PipeWire.

## Owner music control API

Read state:

```http
GET /admin/music/play-control/state
```

Control playback:

```http
POST /admin/music/play-control/control
Content-Type: application/json
```

Payload:

```json
{
  "action": "play",
  "audioRouteId": "music"
}
```

Supported actions:

- `play`: start the next playable track, or resume a paused active track.
- `pause`: pause a loading or playing active track.
- `resume`: resume only a paused active track. If nothing is paused, state reports `music_resume_without_paused_track`.
- `stop`: stop the active track without selecting a replacement.
- `next`: skip the active track and select the next playable track.
- `skip`: legacy alias for `next`.
- `select`: play one existing catalog track by `trackId`; missing or unplayable selections report `music_track_selection_required`, `music_selected_track_not_found`, or `music_selected_track_not_playable`.
- `route.select`: set the selected output route without changing catalog playback or history.

When VLC is actively playing the current track through the Local Agent, superseding actions use Local Agent acknowledgement as the state boundary:

- `next`, `skip`, and `select` first send `track.stop` for the old `playbackId`. The API keeps reporting the old track until that stop succeeds or the Local Agent reports the old playback inactive.
- Active `route.select` sends replacement `track.play` for the same `playbackId` at the observed position and commits the new route only after `track.play` succeeds.
- Failed, rejected, or expired replacement `track.play` records the target playback as failed and releases the `local-agent-vlc` lease, so the browser fallback can take over only after Local Agent playback is stopped or known inactive.
- While a guarded transition is waiting, `reason` is `music_local_agent_transition_pending`.

Response state includes:

- `status`: `idle`, `loading`, `playing`, `paused`, `blocked`, or `error`
- `audioRouteId`: selected route ID
- `audioRoutes`: route ID, label, PipeWire sink, media role, runtime state, and optional detail
- `playbackId`, `currentTrack`, `startedAt`, `updatedAt`
- `player.connected`, `player.owned`, and `player.blockedReason`
- `reason` when an operation cannot produce playback

## Local Agent VLC commands

The API sends only the generic command envelope to the Local Agent. The `vlc-music` module validates the payload before it touches VLC.

`track.play` payload:

```json
{
  "playbackId": "playback-id",
  "sourceUrl": "https://api.maiks.yt/music/playback/audio/playback-id",
  "audioRouteId": "music",
  "startPaused": false,
  "startAtSeconds": 0,
  "volumePercent": 70
}
```

`track.pause`, `track.resume`, and `track.stop` use the active `playbackId`. `track.stop` accepts `null` for service shutdown cleanup. `track.seek`, `volume.set`, and `status.get` remain Local Agent module actions, not owner UI requirements.

VLC launches without a shell. The selected route becomes `PULSE_SINK`; the process receives media through VLC's RC stdin channel, not as a shell command. Unknown route IDs fail validation, and unavailable selected routes fail instead of falling back to Music.

For a replacement `track.play`, the module stops the old VLC child before validating the replacement route. If the selected route is unavailable, the old child is already stopped and the acknowledgement fails without leaving stale audio alive.

## Fallback and handoff

`/music/player` remains the browser fallback. If the Local Agent is disconnected, lacks `vlc-music`, rejects `track.play`, fails `track.play`, or lets `track.play` expire, the API releases the `local-agent-vlc` lease. The browser player can then acquire playback through the existing player-state endpoint.

OpenDeck should call the Maiks control API. It should not spawn VLC directly. Music-library work should provide approved playable catalog `trackId` values to `select`; it should not create a second playback contract.
