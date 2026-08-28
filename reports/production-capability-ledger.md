# Maiks.yt Production Capability Ledger

Updated: 2026-08-28

## Delivery authority and evidence

- The production branch and live site are the normal forward-development path. Ordinary reviewed, reversible application slices are authorized for coordinator commit, push, production deployment, and non-GUI live verification without a new approval request for each slice.
- Authorization is not evidence of delivery. Keep `implementation`, `integration`, `deployment`, and `real verification` separate, and advance each state only from the corresponding artifact or live proof.
- Each deployment still requires exact-target proof, the established rollback procedure, a concrete verification path, and successful health and preservation checks. Schema-affecting work additionally requires the repository backup and migration procedure.
- Real payments or refunds, purchases, destructive data deletion, account ownership or secret changes, external messages, and starting a public stream retain their specific gates.
- Desktop and GUI automation remain forbidden. Use HTTP, API, service, container, log, and other non-GUI evidence for live verification where applicable.

## Direction

`production` is the sole forward-development line. The dev repository and its
branches are evidence for product intent and earlier experiments, not a second
product to maintain and not a history to merge wholesale. Wanted behavior is
rebuilt or selectively reused in the production architecture and visual system.

## 2026-08-27 Readiness Audit

Current result: NOT READY for a live stream.

- Production containers are healthy with zero restarts, and no observed 5xx or WebSocket failures were seen, but provider and tunnel runtime telemetry is still insufficient.
- Twitch `maiksmc` primary and `maiksplays` secondary are configured. Deployed revision `30adb56` now reports chat-reply readiness truthfully, and a sanitized live runtime probe confirms the bot access token is invalid; three EventSub subscriptions still target old `maiksmc`, and the intake ledger has no rows.
- YouTube has no active production credential or selected channel, Discord read checks pass but auto-start is off and the webhook public key is absent, and installed-window owner-session proof is still missing for the PWAs.
- Direct Chat and Control HTTP and WebSocket paths now enforce the `requiresLogin` session contract in deployed revision `f12c98d`, while `overlay:connect` remains token-only. A valid bare Control token now fails with `401` on the live origin; a real signed-in owner/PWA check remains open. OBS is currently closed with no widget clients and no output running, and local playback remains unverified.

This ledger records separate delivery stages. `Implementation: done` does not
mean a capability is deployed or proven in a real user path.

## 2026-08-28 Reviewed Production Tranche

| Slice | Design | Approval | Implementation | Integration | Deployment | Real verification | Evidence / open gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Updates publishing editor | done | done | done | done | done | not-started | Michael-approved image implemented in the owner Admin shell and deployed in `c98486f`; senior review reports Standards 0 / Specification 0. Verify the signed-in revision-safe lifecycle and rendered desktop/mobile fidelity. |
| Account browser contracts | done | done | done | done | done | not-started | Minimal session, provider, domain/profile, and preference projections deployed in `c98486f`; opaque provider-profile refs; one exact fail-closed Web session parser. Senior review reports Standards 0 / Specification 0. Verify OAuth, linking, profile/privacy, Control, and recovery. |
| Chat and Moderation provider status | done | done | done | done | done | not-started | Safe typed status projection deployed in `c98486f`; it preserves reconnect and access gates while removing raw errors, ids, message bodies, counters, and runtime internals. Verify installed status/reconnect with real providers. |
| Event Routing operator truthfulness | done | done | done | done | done | not-started | Server-driven capabilities and fail-closed unsupported controls are deployed in `c98486f`. Verify current and legacy rules against real intake and destinations. |
| Creator Links admin | done | done | done | done | done | in-progress | Approved image `reports/visual-concepts/production-admin-links/admin-links-candidate-v1.png` is implemented and deployed in `c98486f`. Live public projection and unauthenticated admin/delete boundaries are verified; signed-in owner CRUD/publication and rendered fidelity remain open. |

Shared gate: `pnpm check:review` passes with 155 domain tests, 609 API tests,
87 Web tests, the production Web build including `/admin/updates`, Overlay and
Control typechecks, 16 Local Agent tests, architecture rules, and diff checks.
No GUI, browser, screenshot, deployment, server, or live verification was run.

The Creator Links row was delivered later in production rollout `c98486f`; its
deployment and verification evidence is recorded independently from the earlier
shared tranche gate.

## 2026-08-28 Production Migration Ledger Reconciliation

| Slice | Design | Approval | Implementation | Integration | Deployment | Real verification | Evidence / open gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Drizzle migration-history integrity | done | done | done | done | not-applicable | done | Source commit `49c0b23` restores the two historical game-catalog migrations already present in the live 30-row applied history, preserves the music migration byte-for-byte as 0029, repairs the journal/snapshot chain to 67 tables, and restores matching schema declarations. Independent senior review returned `READY`; `pnpm check:review` passed; two disposable generation runs produced no schema change and no 0030 migration. No live migration, database mutation, deployment, restart, or volume change occurred. |

The earlier split-history gate is closed. Future schema work must continue from
`0029_jazzy_crystal`; it must not recreate, renumber, or reapply the restored
game-catalog migrations.

## 2026-08-28 Public Health Context And Writing Decisions

| Slice | Design | Approval | Implementation | Integration | Deployment | Real verification | Evidence / open gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public Health context | done | done | done | done | done | done | Commit `93c353c` is deployed to Web and public-HTTP verified. Independent review found zero standards and zero tone/factual-fidelity findings. Current tumor, brain-damage, ADHD, and practical effects remain public; old fractures and an unrelated head injury remain source-only and test-protected. |
| Public writing style | done | in-progress | not-started | not-started | not-started | not-started | Michael is choosing among three plain-language directions at `https://choices.mmc.onl/p/maiks-yt/l/df2127362d9157df`. The result authorizes a later page-by-page audit/proposal, not a blind rewrite. |
| Dedicated public AI-use page | idea | in-progress | not-started | not-started | not-started | not-started | The current proposal choice is `https://choices.mmc.onl/p/maiks-yt/l/8f21ecdc5567efc4`. It supersedes the earlier paragraph-only idea. Future copy must disclose AI assistance and responsibility while keeping Michael's real-person/live-content boundary precise. |

## 2026-08-28 Correctness And Recovery Tranche

| Slice | Design | Approval | Implementation | Integration | Deployment | Real verification | Evidence / open gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account-scoped session recovery | done | done | done | done | done | not-started | List, selected revoke, and revoke-others are bound to the authenticated Better Auth account and deployed in `c98486f`; senior review reports Standards 0 / Specification 0. Verify with two live accounts. |
| Terminal URL-token rotation | done | done | done | done | done | not-started | Deployed in `c98486f`: revoked and expired tokens cannot rotate or return raw launch material; active expiring and no-expiry tokens remain supported. |
| Schedule game-link preservation | done | done | done | done | done | not-started | Deployed in `c98486f`: the single Game focus preserves additional links, normalizes deterministic order, and preserves promoted relationships. |
| Truthful Project publication | done | done | done | done | done | not-started | Deployed in `c98486f`: one public-status predicate drives Domain/API/Web, and repository writes atomically preserve `is_public => eligible(status)`. Live two-connection MariaDB proof remains open. |

Shared gate: `pnpm check:review` passes with 156 Domain tests, 627 API tests,
100 Web tests, the production Web build, Overlay and Control typechecks,
16 Local Agent tests, architecture rules, and diff checks. No deployment, GUI,
browser, server-state, or live database verification was performed.

## 2026-08-28 Connections Catalogue Boundary

Production Connections no longer advertises simulation-only support money,
development free TTS, or `test/system` events. Real Website, Twitch, YouTube,
and Discord catalogue entries remain. Independent review reports Standards 0 /
Specification 0, and the shared gate passes with 102 Web tests. Implementation
and deployment in `c98486f` are complete; real operator verification is not started.

The reviewed production source through `c98486f` was deployed across Web, API,
Overlay, and Control on 2026-08-28. This advances deployment for source present
at that revision; it does not prove the signed-in or provider-backed operator
workflows listed as open elsewhere in this ledger.

A wrong-target delegation wave was stopped in `maiks-yt-fresh`. None of that
residue is production evidence or part of this ledger. Future workers must prove
the exact production path and branch before receiving writable scope.

## Capabilities

| Capability | Design | Approval | Implementation | Integration | Deployment | Verification | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public site and public content | done | done | done | done | done | in-progress | Revision `501613c`; live `200` smoke across the main public routes; owner Games has a read-only reverse Schedule summary, and collapsed reviewed-history filters are corrected with focused regression coverage. Reviewed production slices omit explicitly marked example Updates from production list, detail, RSS, and the ordinary owner inventory. The public Updates contract now also omits raw database ids and the internal example marker while preserving the private editor projection. Michael approved the image-first `/admin/updates` direction; the owner editor and authenticated API now provide draft create/edit, exact saved preview, opaque revision-safe publish, idempotent unpublish/publish retry behavior, no audit identifiers, and in-flight interaction locking backed by a delayed-response real-hook test. Public game suggestion creation now stores the private pending record while returning only an acceptance acknowledgement. Commit `f457085` restores currently live visible entries to public schedule reads without exposing completed/private rows. The current reviewed permissions patch also excludes revoked and expired grants from project-admin authorization while preserving active delegated access. Web revision `bd8e8dea117ea85c0f2c034bb631f210d7b06b91` deploys the accumulated Web source, the MaiksPlays `/plays` slice, public discovery from `/channels`, the factual Health wording, and the homepage authoritative schedule/project/Update read models with exact OCI provenance. Revision `ab2682f` removes raw ids from every anonymous Project level while preserving private admin persistence ids. Revision `c6b32aa` splits anonymous Schedule from private admin state, removes every schedule/project/game-link/game id and operator-only field, and deploys strict bounded Web parsing on provenance-labelled image `sha256:7c6b3c17...d1d6a`. Revision `87cb83c` removes the remaining anonymous Games database id, makes slug the unique parsed public identity, and deploys the populated 15-game contract on provenance-labelled image `sha256:ec67b352...ff37`; live recursion finds zero `id` keys. Public HTTP/API verification covers Home, Projects, a real Project detail, Accountability, Schedule, Games, Admin Projects/Schedule/Games, bounded failure behavior, and zero internal keys in the minimized anonymous contracts. `plays.maiks.yt` is published through Cloudflare and verified at `200` with the `/plays` rewrite. | Prove the signed-in owner publishing lifecycle, minimal public Updates/RSS responses, stale-preview rejection against MariaDB, unpublish behavior, anonymous game suggestion acceptance plus private owner review, a real populated public Schedule/homepage state, owner Games editing with real schedule data, and active-versus-inactive delegated project permissions. |
| Account identity and linked login providers | done | done | done | done | done | in-progress | Focused account pages, independent Maiks.yt name/image, linked provider choices, and production auth. Reviewed production commit `2b6264d` removes legacy development identity/status routes, replaces the Connections dependency with a signed-in minimal provider-id projection, and corrects avatar privacy caching. The production origin and account-contract hardening are deployed and preserved in current Web/API source. | Verify sign-in, OAuth callback, provider listing/linking, profile replacement/privacy, Control session access, and session recovery on the live origin. |
| Public profiles and recognition | done | done | in-progress | not-started | not-started | not-started | `/profiles` is a static public/private demonstration, not live profile behavior. A 2026-08-28 source audit found its search ignores the query and the public mock advertises unimplemented provider identity, verification, role-sync, supporter, donation, contribution, and perk behavior; the three pages do not themselves render raw internal/provider ids. Michael selected `/profiles/maiks`, one-year retirement before handle reuse, and manual Owner assignment of first handles to existing accounts. Private-account searchability and its name-only/no-image projection remain approved. Commit `a752c67` contains the independently reviewed Domain contract for normalization, reserved-name policy, atomic transitions, safe public identifiers, and minimized public/private projections. The production MariaDB preflight is complete and `reports/profile-handle-audit-event-store-proposal.md` defines the separately reviewed Owner-only audit model. No schema, migration, runtime consumer, reservation, or live profile exists. Recognition, linked identities, perks, and verified game names still lack approved public persistence or consent rules. | First obtain image-first approval for a truthful planned Profiles state and remove fake search/capability claims without implementing handles. Michael separately chooses whether to generate handle migration files at `https://choices.mmc.onl/p/maiks-yt/l/fc1c6e1363e3d9f6`. Application, append-only proof, retention/pseudonymization, the `maiks` data action, image routing, backup/restore proof, API/UI integration, and live account changes remain separate. |
| Public AI-use disclosure | done | in-progress | not-started | not-started | not-started | not-started | Michael selected a short dedicated public AI-use page and rejected placing the proposed section on the other About pages, with note `use a dedicated page`. The direct, warm, matter-of-fact 215-word copy proposal and desktop/mobile image-first candidates are registered under `reports/production-about-ai-page-proposal.md` and `reports/visual-concepts/production-about-ai/`. Image-generated body text is representative; the proposal remains the exact-copy authority. | Michael approves or declines the exact prepared implementation at `https://choices.mmc.onl/p/maiks-yt/l/fc1c6e1363e3d9f6`. Do not implement before submission. |
| Unified provider chat intake | done | done | done | in-progress | done | blocked | Deployed Twitch multi-channel, Discord, and YouTube intake code plus shared streamer-chat projection. Revision `2a99457` adds sanitized provider telemetry and broadcaster-scoped EventSub controls. Revision `30adb56` deploys a finite `twitch_chat_replies` capability with bounded cached read-only validation. Revision `96a5db7` minimizes every supporting owner-workspace browser contract, moves provider OAuth URL construction behind an owner-gated same-origin launcher, binds YouTube channel mutations to opaque owner references, and makes Web parsing reject raw, cross-provider, contradictory, and premature-success payloads. The final independent review and full production gate pass; Web/API are healthy on provenance-labelled image `sha256:bb4e99e8...388e87`, unauthenticated owner routes fail with finite `401`, and Control/Overlay are preserved. A prior sanitized live API-runtime probe returned `needs_attention / invalid_access_token`; signed-in owner controls, real intake, and installed reconnect remain unverified. | Reauthorize the Twitch bot credential with the required IRC chat scopes, then prove signed-in finite status, installed reconnect/API restart behavior, owner-bound intake review, and real provider traffic; separately reconcile intended subscriptions. |
| Chat attention and viewer commands | done | done | done | in-progress | done | blocked | Deployed reliable attention readout and viewer commands. Revision `30adb56` makes reply readiness visible and live verification proves the current bot access token is invalid without exposing it | Reauthorize the bot credential, then verify `!commands`, one harmless command reply, unread attention, and suppression behavior on the actual MaiksPlays channel |
| Event routing and alerts | done | done | done | in-progress | done | blocked | Deployed real-provider execution, cooldown/approval history, top/center transport, alert sounds, durable provider-chat routing, broadcaster-scoped Twitch live/offline resolution, and configured-channel EventSub controls. Reviewed production code also connects public schedule create/update/cancel to real website rule resolution with atomic history/approval/cooldown decisions, hashed cooldown identity, private-schedule silence, and isolated playback failures. The production admin catalogue omits simulated/test-only entries and rejects their save/reset/delete operations before persistence while retaining the non-production harness and all real kinds. The relevant API/shared source is deployed through `30adb56`; Control and Overlay source are preserved from `c98486f`. Service and auth-gate smoke passed, but owner configuration, schedule-to-overlay delivery, live MariaDB concurrency, and real transition/event rehearsal remain unverified. | Prove the catalogue boundary, real schedule history/routing/overlay behavior, cooldown transaction behavior, provider targets, follow/sub/chat events, dedupe, audio ownership, and OBS fallback. |
| Music catalog, requests, and playback | done | done | done | in-progress | done | blocked | Deployed music schema/API/UI, YouTube Audio Library import, browser/OBS fallback, per-PWA output selection, and server-side projection to the VLC agent. Commit `eb421e8` expires abandoned Local Agent commands exactly once and releases an unacknowledged VLC lease for browser fallback. Commit `6913f63`, deployed through `8e3bc62`, reduces successful public request responses to `{ ok: true, accepted: true }`. Revision `e5f0dd8` removes anonymous track/source ids and private provider/license/policy metadata, introduces opaque exact-selection references, re-resolves eligibility inside the daily-request transaction, and adds strict finite Web parsing without changing private admin, account Top 10, playback, Local Agent, VLC, review, or persistence identifiers. Independent review returned `READY`; the full production gate passed; Web/API are healthy on provenance-labelled image `sha256:94ad53a6...2718b`; Control/Overlay are preserved. The live catalog is empty and no request was written merely for verification. The streaming-PC agent remains unconfigured and unverified. | Populate the real catalog and prove authenticated Top 10 plus owner review. Then configure the local agent and prove real catalog playback, command expiry, automatic next, `stream_music`, reconnect, history, and browser fallback. |
| Streaming-PC local agent and private audio | done | done | done | in-progress | in-progress | not-started | The server connection/status side is deployed; `apps/local-agent` has tested outbound transport, durable identity/dedupe, private cue/TTS, VLC execution, bounded authenticated media retrieval, immediate module status, and a typed countdown extension point; real VLC playback remains unverified | Add managed credential rotation/revocation, then configure and prove the streaming-PC service without weakening the dedicated credential boundary |
| Operational Chat, Moderation, Control, and Notifications PWAs | done | done | done | in-progress | done | in-progress | Deployed with Control session enforcement and owner/`chat:view` authorization for every private Chat HTTP/WebSocket path. The current Control/Overlay source tree is identical to the deployed and preserved `c98486f` tree. Optional Control navigation and standalone Chat quick actions derive from active capabilities; Chat fails closed instead of assuming every signed-in viewer has all moderation rights. Owner/helper visual evidence is in `reports/visual-qa/production-pwa-redesign/README.md`. Installed-window and signed-in owner/moderator proof is still absent. | Verify installed owner/moderator access, permission loss, real provider data, moderation effects, music output, and overlay controls. |
| PWA session and rapid recovery | done | done | done | done | done | in-progress | Bounded retry and `requiresLogin` enforcement are deployed. Revision `2a99457` generates production create/rotate launch URLs for `control.maiks.yt`/`overlay.maiks.yt` while dev stays isolated. Production revision `fcfdd05` deploys the approved recovery flow with the exact existing website logo, a recovery-only public header, purpose-built authenticated PWA chrome, allowlisted returns, pre-render token stripping, configured providers, and a clean signed-out Notifications renewal path. Michael later confirmed the approval correction to that exact logo/header split; the deployed source already matched, so no new deployment was needed. Independent review and `pnpm check:full` pass. Public HTTP proves clean and unsafe redirects, token absence, the exact configured-provider projection, signed-out session, standalone Notifications markup, healthy Web/API/Control, and preserved Overlay. | Complete real OAuth in an installed PWA, then prove signed-in create/rotate, revoked-token behavior, current-permission revalidation, and recovery in less than one minute. |
| OBS widget bridge and master-overlay fallback | done | done | in-progress | in-progress | in-progress | blocked | Protocol-v1 bridge contracts, readiness/fallback semantics, and companion commit `f150376` with approved Project Zomboid chat, camera, BRB, and alert Browser Sources. Commit `6188f03` makes pre-start fallback acknowledgement-safe across disconnect, replacement, expiry, bridge send failure, and widget readiness loss while isolating stale master-overlay clients; its API/Overlay source is deployed and preserved. The OBS companion/source installation and real bridge path remain unverified. OBS was closed, zero widget clients were present, and no output was running during the last live check. | Restart/update the companion only when OBS is available, then verify every source, pre/post-start effect failure, audio owner, reconnect, and master-overlay fallback in one rehearsal. |
| Sandustry OBS collection | in-progress | not-started | not-started | not-started | not-started | not-started | Rejected V1 and later V2 assets under `reports/visual-concepts/sandustry-obs/production-assets-v2`; V2 is reference evidence, not approval | Review V2 at native size, keep only usable assets, then build the OBS collection named exactly `Sandustry` |
| Delegated authorization hygiene | done | done | done | done | done | in-progress | Reviewed production commits exclude revoked and expired role grants from Project admin, Money, URL-token administration, Sessions, Event Routing administration, Notifications, Content Pages, Stream Schedule, Creator Links, and Game Library while preserving active owner and delegated access. The relevant API/shared source is deployed through `30adb56`; focused tests prove forbidden outcomes and no protected side effects. | Exercise mixed active/revoked/expired grants against representative owner and delegated paths on MariaDB without exposing raw permissions or identifiers. |
| Moderation, roles, ranks, and helper operations | in-progress | in-progress | done | done | done | in-progress | Reviewed and deployed authority hardening in `8e3bc62`: ordinary CRUD, grant, revoke, and path flows from owner/admin/system/wildcard/malformed authority now fail closed; malformed rows project to a finite invalid state; raw audit snapshots stay out of outbound DTOs; and protected or malformed roles are excluded from Admin Overview counts. Senior final review reported `READY: zero findings`, `pnpm check:review` passed, live unauthenticated Moderators and Admin Overview API reads returned `401`, and Web/API remained healthy. The future Ranks & Perks product boundary and perk semantics are still unsettled, so design and approval remain in progress. | Resolve the Ranks & Perks boundary, define perks, add a privileged malformed-row recovery workflow if needed, and verify real moderator workflows without exposing raw identifiers. |
| Notifications and operational health | done | done | done | in-progress | done | blocked | Deployed Notification PWA, Web Push, recurring health checks, and sanitized admin health surfaces | Verify delivery, read/archive, long-lived access, and failure-only alerting |
| Page Creator and route ownership | done | done | done | in-progress | done | blocked | Deployed persistence, owner editor, preview/publish gate, reserved routes, exact-path rendering, finite operator copy, and the minimized browser contract. Audit identity and route ownership remain server-side while the owner browser receives only editor/publication fields. | Verify live draft isolation and publish/unpublish behavior before using it for production pages. |
| Backup, export, and recovery evidence | done | in-progress | in-progress | in-progress | done | blocked | Deployed key-data export and Backup Health with sanitized failure categories; runbook and dry-run evidence exist | Approve retention/encryption/owner policy, install the production workflow, and prove a disposable restore drill |
| Money and accounting | done | in-progress | in-progress | in-progress | done | blocked | Deployed private ledger, dated rules, imports, receipts, reports, and posting workflow; public money behavior remains gated | Verify bookkeeping against real provider statements before opening any public payment path |
| Production route and operator-surface hygiene | done | done | done | done | done | in-progress | Production removes the dev test console, Gemini lab, retired Live Helper page, fake overlay controls, dev identity/status exposure, dev/auth/API-origin fallbacks, inert simulation UI, stale implementation-detail copy, simulated Admin Overview state, retired CSS, legacy fake overlay/moderation injection routes, and unauthenticated realtime spike routes. Admin Overview no longer consumes development smoke state; public Updates omit raw ids/fixture markers; production Event Routing omits and rejects simulated/test catalogue state; finite Admin Overview and Page Creator copy are deployed. Real HTTP `404` behavior is verified. | Continue the response-contract audit and verify signed-in operator routes do not expose retired or development-only states. |

## Ranked Queue

### P0: Make The Next Stream Work

1. Rehearse the MaiksPlays path end to end: provider intake, newest-first Chat, attention, `!commands`, moderation, alerts, music controls, and reconnect behavior.
2. Verify the deployed operational PWAs with installed access and real provider/moderation/music/overlay behavior.
3. Complete the OBS widget Browser Sources while retaining the master overlay as a tested fallback.
4. Prove installed PWA access remains usable and that owner/moderator recovery takes less than one minute.
5. Configure and prove the streaming-PC Local Agent for private audio and VLC without weakening its dedicated credential boundary.
6. Rotate the verification token that was used before production request-log redaction was deployed.

### P1: Make Production Coherent

1. Continue the production hygiene pass after the dev test console, Gemini experiments, retired Live Helper page, fake/test API routes, and public example Updates. Review static profile demonstrations, remaining fake controls, seed-only states, raw identifiers, and operator metrics one product surface at a time.
2. Replace static profile demonstrations with reviewed real profile, privacy, recognition, and linked-account read models.
3. Finish the Ranks & Perks product boundary and simplify moderator/admin workflows around actual permissions.
4. Finish multi-channel provider identity and routing behavior for the intended Twitch and YouTube channel structure.
5. Finish Page Creator adoption for appropriate informational pages without taking over code-owned routes.
6. Continue production website Event Routing producer by producer. Review project-update publication next; keep signup, public-name, and avatar events behind proven disclosure, identity, and persisted opt-out behavior.

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
