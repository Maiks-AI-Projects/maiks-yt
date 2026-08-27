# Maiks.yt Local Agent

The Local Agent is the single modular system service for outbound Maiks.yt-to-streaming-PC work. This first slice supplies the connection, identity, device credential, capability registration, heartbeats, acknowledgements, persistent deduplication, reconnect/backoff, and module lifecycle foundation. It does not add an inbound HTTP, WebSocket, SSE, or LAN listener.

The Stream Audio Mixer remains responsible for PipeWire routing. Local modules target stable sinks directly:

- Private cue/TTS: `stream_private`
- VLC music (contract only in this slice): `stream_music`

The audio client sets its PipeWire application name to `maiks-audio-agent`, matching the existing Private routing rule. Browser/PWA audio and `/music/player` remain supported fallbacks; this app does not remove or redirect them.

## Implemented boundary

The service makes one authenticated outbound WebSocket connection using subprotocol `maiks-local-agent.v1`. Registration carries the durable device UUID, logical agent ID, protocol/service versions, currently usable module actions, and module status. The same connection carries commands, acknowledgements, and heartbeats.

Commands have separate event and command IDs, timestamps, an optional expiry, a capability/action pair, and an unknown payload validated by the target module. The agent acknowledges receipt, executes once, atomically stores the terminal acknowledgement, then returns it. A repeated event replays its stored result; reuse of an event ID for a different command is rejected. Up to 2,048 recent terminal results are retained. Invalid or corrupt state stops startup rather than silently discarding dedupe history.

Reconnect uses capped exponential backoff with jitter. Module startup is ordered; a startup failure rolls already-started modules back in reverse order. Shutdown also runs in reverse order. Unavailable local binaries are reported as capability status instead of claiming actions that cannot execute.

`private-audio` is the only executable module in this slice:

- `cue.play` synthesizes a bounded WAV cue locally and sends it to `pw-play --target stream_private`.
- `tts.speak` validates bounded text/voice/rate input, runs `espeak-ng` without a shell, and pipes its WAV output to the same stable sink.

VLC music and Countdown are typed module/command contracts only. They are deliberately not instantiated or registered yet.

## Dedicated credential design

The remote endpoint is intentionally not part of this patch. Before production use, it must issue a revocable device credential bound server-side to exactly one durable device ID and an allowlist of local-agent capabilities/actions. It must not accept a website owner session, owner API token, dev-auth token, provider token, or another broad credential as a substitute. Rotation/revocation and an owner-visible last-seen/capability audit are server-side gates.

The systemd unit uses `LoadCredential=` to expose the token through `$CREDENTIALS_DIRECTORY` only for the service. Direct development can instead set `MAIKS_LOCAL_AGENT_CREDENTIAL_FILE`. The agent rejects non-regular credential files, group/world permissions, whitespace-bearing tokens, query-string credentials, non-WebSocket URLs, and insecure non-loopback `ws://` endpoints. Tokens are sent only in the outbound `Authorization` header and are never placed in a URL or state file.

## Build and local proof

```bash
pnpm --filter @maiks-yt/local-agent build
pnpm --filter @maiks-yt/local-agent test
pnpm --filter @maiks-yt/local-agent typecheck
node apps/local-agent/dist/main.js --print-device-id
node apps/local-agent/dist/main.js --self-test-cue
node apps/local-agent/dist/main.js --self-test-tts "Private audio test"
```

The proof commands require no Maiks.yt secret or remote connection. Cue needs `pw-play`; TTS also needs `espeak-ng`. They do produce local audio and therefore are later manual smoke steps, not automated test actions.

## User-service helpers

The checked-in unit is a template. The install helper requires an existing build, renders absolute Node/app paths, copies a safe config example only when none exists, reloads the user systemd manager, and intentionally does not enable or start the service.

```bash
apps/local-agent/ops/install.sh
apps/local-agent/ops/status.sh
apps/local-agent/ops/uninstall.sh
```

After installation, edit `~/.config/maiks-yt/local-agent/config` and provision `~/.config/maiks-yt/local-agent/device-token` with mode `0600`. The uninstall helper stops/removes only the unit and preserves configuration, credential, and dedupe state for deliberate manual removal or recovery.

## Production and live-smoke gates

Automated tests use an in-memory transport and fake audio backend. Later live testing should be performed in this order:

1. Confirm `pw-cli`/the Stream Audio Mixer exposes `stream_private` and `stream_music` with the expected routing.
2. Run `--self-test-cue`, verify it is audible on Private only, and verify the PipeWire client identity is `maiks-audio-agent`.
3. If `espeak-ng` is installed, run `--self-test-tts` and verify Private-only speech plus clean cancellation.
4. Provision a least-privilege test device credential after the server endpoint exists; verify broad owner/dev/provider tokens are rejected.
5. Start the unit manually and verify one outbound connection, registration status, heartbeats, reconnect jitter, and clean SIGTERM shutdown.
6. Send a fake harmless cue command twice with the same event ID; verify one playback and a replayed terminal acknowledgement. Restart between deliveries and repeat to prove disk-backed dedupe.
7. Send expired, malformed, unknown-capability, and event-ID-collision commands; verify they fail closed without audio.
8. Interrupt the connection after receipt and before terminal delivery; reconnect and verify the persisted terminal acknowledgement is replayed without re-execution.
9. Verify the browser/PWA Private cue/TTS fallback and `/music/player` still work unchanged.

VLC execution, Countdown execution, the remote device enrollment/API, credential rotation UI, server persistence, and live OBS/stream behavior remain explicitly outside this first patch.
