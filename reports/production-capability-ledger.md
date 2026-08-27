# Maiks.yt Production Capability Ledger

Updated: 2026-08-27

## Direction

`production` is the sole forward-development line. The dev repository and its
branches are evidence for product intent and earlier experiments, not a second
product to maintain and not a history to merge wholesale. Wanted behavior is
rebuilt or selectively reused in the production architecture and visual system.

This ledger records separate delivery stages. `Implementation: done` does not
mean a capability is deployed or proven in a real user path.

## Capabilities

| Capability | Design | Approval | Implementation | Integration | Deployment | Verification | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public site and public content | done | done | done | done | blocked | blocked | Production routes, typed public loaders, and `pnpm check:review`; public origin currently returns Cloudflare `530` | Restore production reachability, identify the deployed revision, then smoke the main public routes |
| Account identity and linked login providers | done | done | done | done | blocked | blocked | Focused account pages, independent Maiks.yt name/image, linked provider choices, and production auth code | Verify sign-in, linking, profile replacement, privacy, and session recovery on the live origin |
| Public profiles and recognition | done | in-progress | in-progress | not-started | not-started | not-started | `/profiles` is explicitly a static public/private demonstration, not a real account read model | Approve public slug/privacy/recognition rules, then replace the demonstrations with real data |
| Unified provider chat intake | done | done | done | in-progress | blocked | blocked | Twitch multi-channel, Discord, and YouTube intake code plus shared streamer-chat projection; failed first-stream evidence shows the full path was not reliable | Prove MaiksPlays channel intake and reconnect behavior end to end before the next stream |
| Chat attention and viewer commands | done | done | done | in-progress | blocked | blocked | Production commits for reliable attention readout and viewer commands; `!commands` exists in code | Verify live reply credentials, command output, unread attention, and suppression behavior on the actual channel |
| Event routing and alerts | done | done | done | in-progress | blocked | blocked | Real-provider execution, cooldown/approval history, top/center transport, and alert-sound work exist in production | Rehearse real follow/sub/chat-derived events, dedupe, audio ownership, and fallback in OBS |
| Music catalog, requests, and playback | done | done | done | in-progress | blocked | blocked | Production music schema/API/UI, YouTube Audio Library import, browser/OBS fallback, per-PWA output selection, and locally tested authoritative playback projection to the VLC agent with authenticated media retrieval and lifecycle feedback | Restore reachability, configure the local agent, then prove real catalog playback, automatic next, `stream_music`, reconnect, history, and browser fallback |
| Streaming-PC local agent and private audio | done | done | done | in-progress | not-started | not-started | `apps/local-agent` has tested outbound transport, durable dedupe/device identity, private cue/TTS, VLC execution, bounded credential-protected media download, immediate module status, a typed countdown extension point, a fail-closed server connection, and an owner-only redacted health endpoint | Add managed credential rotation/revocation, then configure and prove the service without weakening the dedicated credential boundary |
| Operational Chat, Moderation, Control, and Notifications PWAs | done | done | done | in-progress | blocked | in-progress | Production implementation plus local desktop, half-screen, touch, and mobile evidence in `reports/visual-qa/production-pwa-redesign/README.md`; live origins currently return `530` | Deploy after reachability returns, then verify installed access, real provider data, moderation effects, music output, and overlay controls |
| PWA session and rapid recovery | done | done | in-progress | in-progress | blocked | blocked | Token plus login boundary exists; bounded transient retry now reacts within 30 seconds and on online/foreground; the dedicated OAuth return page awaits image approval | Approve and implement the recovery page, then prove durable installed access and recovery in less than one minute without weakening owner/moderator boundaries |
| OBS widget bridge and master-overlay fallback | done | done | in-progress | in-progress | blocked | blocked | Protocol-v1 bridge contracts, readiness/fallback semantics, and companion commit `f150376` with approved Project Zomboid chat, camera, BRB, and alert Browser Sources; local tests/build and synthetic renders pass | Restart/update the companion only when OBS is available, then verify every source, effect acknowledgement, audio owner, reconnect, and master-overlay fallback in one rehearsal |
| Sandustry OBS collection | in-progress | not-started | not-started | not-started | not-started | not-started | Rejected V1 and later V2 assets under `reports/visual-concepts/sandustry-obs/production-assets-v2`; V2 is reference evidence, not approval | Review V2 at native size, keep only usable assets, then build the OBS collection named exactly `Sandustry` |
| Moderation, roles, ranks, and helper operations | in-progress | in-progress | in-progress | in-progress | blocked | blocked | Local/provider moderation, audit, rules, grants, and admin foundations exist; final Ranks & Perks ownership remains unsettled | Resolve the Ranks & Perks boundary and verify real moderator workflows without exposing raw identifiers |
| Notifications and operational health | done | done | done | in-progress | blocked | blocked | Notification PWA, Web Push, recurring health checks, and sanitized admin health surfaces exist | Restore origin reachability, then verify delivery, read/archive, long-lived access, and failure-only alerting |
| Page Creator and route ownership | done | done | done | in-progress | blocked | blocked | Persistence, owner editor, preview/publish gate, reserved routes, and exact-path rendering exist | Verify live draft isolation and publish/unpublish behavior before using it for production pages |
| Backup, export, and recovery evidence | done | in-progress | in-progress | in-progress | blocked | blocked | Key-data export, backup health, runbook, and a dry-run record exist | Approve retention/encryption/owner policy, install the production workflow, and prove a disposable restore drill |
| Money and accounting | done | in-progress | in-progress | in-progress | blocked | blocked | Private ledger, dated rules, imports, receipts, reports, and posting workflow exist; public money behavior remains gated | Verify bookkeeping against real provider statements before opening any public payment path |
| Production route and operator-surface hygiene | done | done | in-progress | in-progress | blocked | blocked | The production web build no longer registers the dev test console, Gemini lab, or retired Live Helper page; old public links to `/dev` and `/gemini-lab` fail closed; static profile demonstrations and some implementation-detail copy remain | Deploy and verify the retired routes and stale public-link behavior after reachability returns, then continue the narrower product-content audit |

## Ranked Queue

### P0: Make The Next Stream Work

1. Restore reachability to the production host and record the deployed commit. Current SSH is unreachable and the public origins return Cloudflare `530`.
2. Deploy and live-verify the locally integrated operational PWA redesign without losing provider chat, attention, commands, moderation, music, audio-output, token, or session behavior.
3. Rehearse the MaiksPlays path end to end: provider intake, newest-first Chat, attention, `!commands`, moderation, alerts, music controls, and reconnect behavior.
4. Complete the OBS widget Browser Sources while retaining the master overlay as a tested fallback.
5. Prove installed PWA access remains usable and that owner/moderator recovery takes less than one minute.

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
