# Maiks.yt Production Capability Ledger

Updated: 2026-08-27

## Direction

`production` is the sole forward-development line. The dev repository and its
branches are evidence for product intent and earlier experiments, not a second
product to maintain and not a history to merge wholesale. Wanted behavior is
rebuilt or selectively reused in the production architecture and visual system.

## 2026-08-27 Readiness Audit

Current result: NOT READY for a live stream.

- Production containers are healthy with zero restarts, and no observed 5xx or WebSocket failures were seen, but provider and tunnel runtime telemetry is still insufficient.
- Twitch `maiksmc` primary and `maiksplays` secondary are configured, but the bot token still validates `401`, three EventSub subscriptions still target old `maiksmc`, and the intake ledger has no rows.
- YouTube has no active production credential or selected channel, Discord read checks pass but auto-start is off and the webhook public key is absent, and installed-window owner-session proof is still missing for the PWAs.
- Direct Chat and Control HTTP and WebSocket paths now enforce the `requiresLogin` session contract in reviewed code, while `overlay:connect` remains token-only. Deployment and a real owner-session check remain open. OBS is currently closed with no widget clients and no output running, and local playback remains unverified.

This ledger records separate delivery stages. `Implementation: done` does not
mean a capability is deployed or proven in a real user path.

## Capabilities

| Capability | Design | Approval | Implementation | Integration | Deployment | Verification | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public site and public content | done | done | done | done | done | in-progress | Revision `501613c`; live `200` smoke across the main public routes; owner Games has a read-only reverse Schedule summary with local responsive proof | Verify owner Games with a real signed-in owner session and real schedule data |
| Account identity and linked login providers | done | done | done | done | done | in-progress | Focused account pages, independent Maiks.yt name/image, linked provider choices, production auth code, and a live signed-out admin gate | Verify sign-in, linking, profile replacement, privacy, and session recovery on the live origin |
| Public profiles and recognition | done | in-progress | in-progress | not-started | not-started | not-started | `/profiles` is explicitly a static public/private demonstration, not a real account read model | Approve public slug/privacy/recognition rules, then replace the demonstrations with real data |
| Unified provider chat intake | done | done | done | in-progress | done | blocked | Deployed Twitch multi-channel, Discord, and YouTube intake code plus shared streamer-chat projection; current production evidence shows `maiksmc` primary and `maiksplays` secondary configured, the bot token still returns `401`, three EventSub subscriptions still target old `maiksmc`, and the intake ledger has no rows | Restore the live bot credential and channel targets before the next rehearsal |
| Chat attention and viewer commands | done | done | done | in-progress | done | blocked | Deployed reliable attention readout and viewer commands; current replies are not ready because the bot token still validates `401` | Verify live reply credentials, command output, unread attention, and suppression behavior on the actual channel |
| Event routing and alerts | done | done | done | in-progress | done | blocked | Deployed real-provider execution, cooldown/approval history, top/center transport, and alert-sound work | Rehearse real follow/sub/chat-derived events, dedupe, audio ownership, and fallback in OBS |
| Music catalog, requests, and playback | done | done | done | in-progress | done | blocked | Deployed music schema/API/UI, YouTube Audio Library import, browser/OBS fallback, per-PWA output selection, and server-side projection to the VLC agent | Configure the local agent, then prove real catalog playback, automatic next, `stream_music`, reconnect, history, and browser fallback |
| Streaming-PC local agent and private audio | done | done | done | in-progress | in-progress | not-started | The server connection/status side is deployed; `apps/local-agent` has tested outbound transport, durable identity/dedupe, private cue/TTS, VLC execution, bounded authenticated media retrieval, immediate module status, and a typed countdown extension point; real VLC playback remains unverified | Add managed credential rotation/revocation, then configure and prove the streaming-PC service without weakening the dedicated credential boundary |
| Operational Chat, Moderation, Control, and Notifications PWAs | done | done | done | in-progress | done | in-progress | Deployed at `501613c`; local desktop, half-screen, touch, and mobile evidence is in `reports/visual-qa/production-pwa-redesign/README.md`; routes and manifests are deployed, but installed-window and owner-session proof is still absent and the dedicated recovery page is pending visual approval | Verify installed access, real provider data, moderation effects, music output, and overlay controls |
| PWA session and rapid recovery | done | done | in-progress | in-progress | in-progress | blocked | Bounded transient retry is deployed and reacts within 30 seconds plus online/foreground; reviewed code now enforces `requiresLogin` on Control HTTP and WebSocket paths and includes session cookies on all Control PWA API calls; deployment and live-session proof remain open; the dedicated OAuth return page awaits image approval | Deploy and verify the auth correction, then approve and implement the recovery page and prove durable installed access in less than one minute |
| OBS widget bridge and master-overlay fallback | done | done | in-progress | in-progress | blocked | blocked | Protocol-v1 bridge contracts, readiness/fallback semantics, and companion commit `f150376` with approved Project Zomboid chat, camera, BRB, and alert Browser Sources; OBS was closed, the companion connected remotely, zero widget clients were present, it could not reach OBS, and no output was running | Restart/update the companion only when OBS is available, then verify every source, effect acknowledgement, audio owner, reconnect, and master-overlay fallback in one rehearsal |
| Sandustry OBS collection | in-progress | not-started | not-started | not-started | not-started | not-started | Rejected V1 and later V2 assets under `reports/visual-concepts/sandustry-obs/production-assets-v2`; V2 is reference evidence, not approval | Review V2 at native size, keep only usable assets, then build the OBS collection named exactly `Sandustry` |
| Moderation, roles, ranks, and helper operations | in-progress | in-progress | in-progress | in-progress | done | blocked | Deployed local/provider moderation, audit, rules, grants, and admin foundations; final Ranks & Perks ownership remains unsettled | Resolve the Ranks & Perks boundary and verify real moderator workflows without exposing raw identifiers |
| Notifications and operational health | done | done | done | in-progress | done | blocked | Deployed Notification PWA, Web Push, recurring health checks, and sanitized admin health surfaces | Verify delivery, read/archive, long-lived access, and failure-only alerting |
| Page Creator and route ownership | done | done | done | in-progress | done | blocked | Deployed persistence, owner editor, preview/publish gate, reserved routes, and exact-path rendering | Verify live draft isolation and publish/unpublish behavior before using it for production pages |
| Backup, export, and recovery evidence | done | in-progress | in-progress | in-progress | done | blocked | Deployed key-data export and Backup Health with sanitized failure categories; runbook and dry-run evidence exist | Approve retention/encryption/owner policy, install the production workflow, and prove a disposable restore drill |
| Money and accounting | done | in-progress | in-progress | in-progress | done | blocked | Deployed private ledger, dated rules, imports, receipts, reports, and posting workflow; public money behavior remains gated | Verify bookkeeping against real provider statements before opening any public payment path |
| Production route and operator-surface hygiene | done | done | in-progress | in-progress | done | in-progress | Revision `501613c` removes the dev test console, Gemini lab, retired Live Helper page, and fake overlay controls; web revision `986a48b` proves random, retired, missing-project, and missing-update routes return real HTTP `404` responses | Continue the narrower product-content audit one surface at a time |

## Ranked Queue

### P0: Make The Next Stream Work

1. Rehearse the MaiksPlays path end to end: provider intake, newest-first Chat, attention, `!commands`, moderation, alerts, music controls, and reconnect behavior.
2. Verify the deployed operational PWAs with installed access and real provider/moderation/music/overlay behavior.
3. Complete the OBS widget Browser Sources while retaining the master overlay as a tested fallback.
4. Prove installed PWA access remains usable and that owner/moderator recovery takes less than one minute.
5. Configure and prove the streaming-PC Local Agent for private audio and VLC without weakening its dedicated credential boundary.

### P1: Make Production Coherent

1. Continue the production hygiene pass after the dev test console, Gemini experiments, and retired Live Helper page removal. Review static profile demonstrations, fake controls, seed-only states, raw identifiers, and operator metrics one product surface at a time.
2. Replace static profile demonstrations with reviewed real profile, privacy, recognition, and linked-account read models.
3. Finish the Ranks & Perks product boundary and simplify moderator/admin workflows around actual permissions.
4. Finish multi-channel provider identity and routing behavior for the intended Twitch and YouTube channel structure.
5. Finish Page Creator adoption for appropriate informational pages without taking over code-owned routes.

### P2: Operate And Expand Safely

1. Add automated backup recency, artifact verification, and disposable restore evidence after policy approval.
2. Verify private accounting against real statements before considering public support or donation behavior.
3. Add provider writes, destructive moderation, public AI, and other high-risk automation only through their existing explicit approval gates.

## Deliberate Omissions

- No wholesale merge from dev.
- No effort to keep dev current.
- No wholesale recovery from the damaged Windows-era `Stream overlay & Website maiks.yt` copy. Use it only to recover a specifically missing, verified asset or history item.
- No production status claims based on recurring `Check project rule violations` tasks attached to that legacy path.
- No production test console, simulator framing, fake operational controls, or seed-only success states.
- No raw secrets, provider payloads, database identifiers, or debug metrics in routine user-facing UI.
- No claim that a build, migration, screenshot, or historical deployment proves the current live path.
