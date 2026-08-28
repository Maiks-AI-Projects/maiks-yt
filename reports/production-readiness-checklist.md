# Production Operations / Readiness Checklist

Status: production is live and is the sole forward line.

Updated: 2026-08-28

This checklist tracks current production readiness, not a dev-to-prod plan. Dev and legacy material are evidence only. Do not infer branch policy, future cutover, or wholesale promotion from this document.

## Live Readiness Snapshot

- Current result: NOT READY for a live stream.
- Healthy: production containers are healthy with zero restarts, and no observed 5xx or WebSocket failures were seen.
- Gaps: provider and tunnel runtime telemetry is still insufficient, Twitch bot replies and `!commands` are blocked by a `401` bot token validation, YouTube has no active production credential or selected channel, Discord auto-start is off and the webhook public key is absent, installed-window and signed-in owner-session proof is still missing, OBS/widget fallback is unproven, local playback remains unverified, and the verification token exposed before request-log redaction still needs rotation.

## Evidence Base

### Deployed

- Production revision `c98486f` is deployed across Web, API, Overlay, and Control as image `sha256:d0f80fb56454d582ee0d080df9c7e2c9b698e96fdf859db0e75aa33333309836`; it includes the approved Creator Links admin and accumulated reviewed production source through that revision. No migration was applied.
- Production revision `501613c` is deployed across web, API, overlay, and control.
- Web-only revision `986a48b` is deployed for the not-found status correction.
- Revision `f12c98d` is deployed to API and Control for Control-token session enforcement; Web and Overlay were not recreated.
- Revision `4bb517d` is deployed to the API only for path-only request logging; Web, Control, and Overlay were not recreated.
- Revision `2a99457` is deployed to Web and API for provider telemetry/privacy hardening, production token launch URLs, durable provider-chat routing, Twitch live/offline rule resolution, and configured-channel EventSub controls. Control and Overlay were not recreated.
- The dedicated `maiks.yt` Cloudflare tunnel was recovered and is now connected dynamically.
- Live public checks returned the expected `200` and `404` responses, including correct `404` status for retired or missing routes.
- Previous web rollback evidence is retained as `maiks-yt-production:rollback-501613c-web`.

### Verified

- After the `c98486f` rollout, all four containers were healthy on the same image with zero restarts and no matching recent error, fatal, unhandled, or 5xx log lines. Home, Links, Admin Links, Admin Updates, API health, Control, and Overlay returned `200`; synthetic missing and retired dev routes returned `404`.
- Live public `GET /links` returned only the bounded public projection. Unauthenticated Creator Links admin read and delete requests returned `401` before mutation.
- Public-origin smoke has been exercised against the live production host.
- The not-found contract now returns real HTTP `404` for retired, missing, and dev-era routes.
- Unauthenticated Local Agent, Games, and Backup Health admin APIs return `401`.
- Chrome confirmed the owner admin shell fails closed while signed out.
- The production host and tunnel are reachable after recovery.
- Production containers are healthy with zero restarts, and no observed 5xx or WebSocket failures were seen during the audit.
- A real valid Control URL token without a signed-in session returns `401 not_authenticated` on the live origin.
- Matched and missing live API requests with synthetic query markers log only their paths; the marker key and values are absent.
- Revision `2a99457` passed `pnpm check:full`; live Home, Projects, Schedule, Games, Links, and API health returned `200`, while unauthenticated provider status and broadcaster-scoped EventSub reads returned `401`.
- After the `2a99457` Web/API replacement, all four containers were healthy with zero restarts, Control and Overlay retained their prior image ids, and recent Web/API logs contained no error- or warning-class lines.

### Unverified

- Real owner-session use on the live origin.
- Installed PWA access in a real user session.
- MaiksPlays stream intake and reconnect behavior end to end.
- OBS widget Browser Sources and fallback behavior in a live rehearsal.
- Streaming-PC Local Agent, VLC, and private-audio proof on the real machine.
- Backup/restore evidence beyond current checks.
- Provider writes, moderation effects, public AI output, and privacy deletion flows in live user paths.

## Readiness Gates

### Auth, Owner Assignment, and Session Security

- Required: explicit production owner assignment for Michael or another recorded owner account.
- Required: no first-login auto-promotion.
- Required: fresh production OAuth apps/redirects and separate production secrets.
- Required: owner/mod/helper permissions remain explicit capabilities, not labels.
- Required: privileged pages still check role/session state after any URL-token gate.
- Required: request logs redact URL-token query parameters before storage or operator display.
- Required: session expiry, sign-out, and recovery are tested on the live origin.

### Secrets and Provider Apps

- Required: production credentials remain separate from dev and legacy values.
- Required: provider app configuration is documented by capability and scope.
- Required: credential rotation/revocation runbook exists for the live environment.
- Required: no dev tunnel, dev OAuth, or dev webhook assumptions leak into production.

### Migrations and Data Change Control

- Required: every production schema change is inventory-backed and ordered.
- Required: backup and restore are verified before any new production migration that depends on them.
- Required: stop on failed migration or smoke, then choose rollback or fix-forward explicitly.
- Required: no worker thread generates or applies production migrations.

### Backup and Restore

- Required: backup retention, encryption, storage target, alert owner, and restore owner are decided.
- Required: a disposable restore drill exists with documented evidence.
- Required: account deletion and privacy erasure account for backup aging and recovery limits.
- Required: backup automation stays closed until the above is approved and tested.

### Money

- Required: real payment intake, refunds, chargebacks, credits, exports, and accounting reports stay gated until the money phase is explicitly approved.
- Required: no public support/payment path opens until private ledger behavior and audit rules are verified.

### Moderation

- Required: destructive moderation remains gated by policy, audit, review, and streamer-override rules.
- Required: moderator/helper workflows are verified against the live permission model.
- Required: no silent escalation from read-only or advisory moderation to destructive action.

### Provider Writes

- Required: provider write actions stay closed until scope, failure behavior, audit, and rollback are approved.
- Required: read-only intake must stay read-only unless a specific provider-write gate is opened.

### Public AI

- Required: public AI output stays off until shadow mode, data boundaries, safety review, and explicit approval are in place.
- Required: no autonomous public action without a separate approval gate.

### Privacy Deletion

- Required: account deletion, privacy erasure, and backup-aging behavior are defined before wider user access expands.
- Required: user-facing wording matches the actual deletion semantics.

### Notifications

- Required: production notification owners and alert destinations are recorded.
- Required: broken core surfaces, auth/session failures, provider-signature failures, backup failures, and repeated delivery failures have a clear page-vs-log decision.
- Required: healthy checks stay quiet.

### Rollback

- Required: rollback reference is recorded before any live change.
- Required: rollback includes image/commit reference, database stance, and tunnel/DNS recovery steps where relevant.
- Current reference: Web, API, Control, and Overlay are deployed at revision `c98486f` using image `sha256:d0f80fb56454d582ee0d080df9c7e2c9b698e96fdf859db0e75aa33333309836`. Immediate rollback images are retained as `maiks-yt-production:rollback-c98486f-web-before`, `maiks-yt-production:rollback-c98486f-api-before`, `maiks-yt-production:rollback-c98486f-control-before`, and `maiks-yt-production:rollback-c98486f-overlay-before`.

### Real Verification

- Required: proof comes from the real artifact and user path, not from build success, migration success, or screenshots alone.
- Required: verify the exact live hostname, session state, and user role before declaring a surface ready.
- Required: separate deployed, verified, and unverified states in every update.

## Next Stream Rehearsal

1. Restore the Twitch bot credential and channel targets, then recheck replies and `!commands`.
2. Activate YouTube and Discord only if the rehearsal actually needs them, then recheck the configured production paths.
3. Launch OBS with MaiksPlays and Project Zomboid, establish widget clients, and verify master-overlay fallback.
4. Prove installed PWA access and owner-session recovery in a real installed window.
5. Verify chat attention, commands, moderation, alerts, and music without an output running.
6. Confirm Local Agent and VLC real playback on the actual machine.
7. Run one explicitly authorized rehearsal only after the above prerequisites are satisfied.

## Open Decisions

- Explicit owner assignment method for the live production account.
- Production OAuth app and secret ownership for each provider.
- Backup retention, encryption, storage target, and restore owner.
- Exact money-phase boundary and public support/payment scope.
- Whether any provider-write or public-AI capability can open during the next production slice.
- Which notification failures page immediately versus remain log-only.

## Unresolved Risks

- MaiksPlays stream path is not yet verified end to end on the live origin.
- Installed PWA behavior is still unverified in a real installed session.
- OBS widget Browser Sources and fallback are not yet proven in a live rehearsal.
- Local Agent and VLC are not yet proven on the streaming PC.
- The verification token used before request-log redaction was deployed still requires owner-authenticated rotation.
- Backup/restore evidence is incomplete.
- Provider writes, moderation effects, public AI, and privacy deletion remain gated.
