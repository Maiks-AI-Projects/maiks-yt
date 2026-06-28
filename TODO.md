# Project Todo Checklist

This is the working checklist. We should work down it in order unless a new idea changes the priority.

## 0. Organize the Idea Base

- [x] Split `ideas/README.md` into clearer sections.
- [x] Keep all existing idea cards linked after reorganization.
- [x] Mark duplicate or overlapping cards for later consolidation.
- [x] Create a short glossary for key terms like project, item, credit, stream goal, linked account, and overlay event.
- [x] Keep file structure and code organization rules easy to find.
- [x] Keep channel/hobby backlog updated without treating it as version-one scope.

## 1. Lock the First-version Scope

- [x] Confirm version one will avoid real money features.
- [x] Confirm first version focuses on overlays, control panel, profiles/accounts, projects/milestones, links hub, and basic content.
- [x] Write a version-one feature list.
- [x] Write an explicit "not in version one" list.
- [x] Review and finalize version one scope draft.
- [x] Decide when to initialize git.
- [x] Make the first git commit a planning baseline.
- [x] Use direct small commits on `main` during early solo development.
- [x] Use branches for delegated, experimental, risky, or long-running work; keep reviewed early solo changes small on `main`.

## 2. Technical Foundation

- [x] Choose monorepo tooling.
- [x] Choose web framework.
- [x] Choose database approach.
- [x] Confirm local MySQL direction.
- [x] Choose validation/type contract library.
- [x] Decide API/realtime backend shape.
- [x] Decide whether overlay/control panel use Vite + React.
- [x] Decide how real-time overlay state will work.
- [x] Decide local production hosting shape for `cloudflared`.
- [x] Decide dev server auto-build/deploy workflow after pushed commits.
- [x] Use `dev` branch as the dev-server auto-deploy target.
- [x] Define fixed local port plan.
- [x] Decide whether to use separate hostnames or one local reverse proxy.
- [x] Create a realtime transport abstraction before choosing WebSocket or SSE.
- [x] Run an early `cloudflared` tunnel spike for WebSocket and SSE.
- [x] Investigate suspicious script injection on public Cloudflare dev routes.
  - Public `https://web-dev.maiks.yt/...` responses included an unexpected script referencing `bsc-testnet-rpc.publicnode.com` and `eval`.
  - The script was not found in the repo or app worktree and did not appear when fetching the Next app directly from inside the app container.
  - Found Cloudflare Worker route `*maiks.yt/*` pointing at `worker-damp-waterfall-45e4`.
  - Worker content matched the injector pattern and inserted a BSC-testnet-loaded script into HTML responses.
  - Removed the Worker route and deleted the Worker. Public dev pages verified clean afterward.
  - Follow up: rotate Cloudflare credentials/tokens and review Cloudflare account audit/activity logs.
- [x] Decide local development strategy for fake events.
- [x] Decide stream simulator/event replayer shape.
- [x] Add localization structure from the start.
- [x] Add minimal analytics/security logging boundaries.
- [x] Add initial architecture/file-boundary rule checker.
- [x] Add rule violation report workflow for next-session review.
- [x] Decide whether rule violations warn or block commits during early development.
- [x] Add clean-context sub-agent workflow and repository handoff brief.

## 3. Core Data Model Draft

- [x] Draft user/account model.
- [x] Draft linked account/provider model.
- [x] Draft roles and permissions model.
- [x] Draft project/item/milestone model.
- [x] Draft project category model.
- [x] Draft overlay event model.
- [x] Draft theme contract.
- [x] Draft stream schedule/session model.
- [x] Draft action panel item model.
- [x] Draft event replay/session recording model.
- [x] Draft multi-currency/value-source model.

## 4. Identity and Privacy

- [x] Implement OAuth sign-in.
- [x] Replace the OAuth test panel with a real signed-in session display.
  - Show the signed-in user identity returned by Better Auth.
  - Keep Google as the first verified end-to-end login path.
  - Add the next step for linking additional providers as accounts with `allow_login`.
- [x] Support multiple linked accounts.
- [x] Add `Allow login` toggle per linked account.
- [x] Prevent disabling/unlinking the last login method.
- [x] Add first-sign-in privacy choice.
- [x] Add account deletion/anonymization design.
- [x] Add provider capability model, such as login, perks, IGN verification, avatar, support claiming.
- [x] Add identity conflict rules for claiming linked accounts.
- [x] Add scoped URL token gates for non-public surfaces.
- [x] Require login after URL token for privileged control/admin pages.
- [x] Add owner/admin token management surface for creating, rotating, revoking, and copying scoped overlay/control URLs.
  - 2026-06-21 reviewed, deployed to dev, and dev-smoked with fresh private overlay/control URLs written to ignored `reports/usable-urls.md`; list responses keep token hashes/raw values hidden, create/rotate return raw URLs once, and revoked tokens stop validating through `/access/url-token/validate`.

## 5. Projects and Milestones

- [x] Build basic project list.
- [x] Build project detail page.
- [x] Support project categories.
- [x] Support non-monetary milestones.
- [x] Support project updates.
- [ ] Support linking stream sessions to projects.
- [ ] Add active project/stream focus display.
- [ ] Add internal wishlist entries linked to project items.

Note: Chunk 14 stopped at the migration gate. The existing public schedule table has no project/focus fields, while the older `stream_sessions.active_project_id` is not connected to the manual schedule/admin/public display flow. The smallest approved next slice is a generated migration that adds nullable manual focus fields to `stream_schedule_entries`, then exposes them in owner schedule admin and public schedule display without money, provider sync, announcements, AI, moderation, or support promises.
  - 2026-06-21 Chunk 14A generated migration `0010_lonely_whistler.sql`, applied it on dev, deployed commit `6cc3c0c`, and dev-smoked owner schedule focus editing plus public `/schedule` focus rendering.
  - 2026-06-21 Chunk 16A generated migration `0011_mean_doctor_strange.sql`, applied it on dev, deployed commit `dce7989`, dev-smoked owner create/publish behavior, and kept public project details filtered to published visible updates on public/visible projects only.

## 5.5 Stream Simulator and Event Replayer

- [x] Build fake typed event generator.
- [x] Add no-schema typed event registry and platform capability matrix.
- [x] Add event storm presets.
- [x] Add event replay controls.
- [x] Support recording/replaying local stream sessions.
- [x] Strip sensitive data from recorded replay fixtures.
- [x] Use simulator events for overlay and control panel testing.

Note: 2026-06-21 added an in-code `@maiks-yt/domain/events` registry for dev-console planning only. Durable event routing rules, event history, per-user opt-outs, cooldown state, provider credentials, moderation enforcement, and real/simulated money persistence remain a future schema gate.
  - 2026-06-21 added, deployed, and dev-smoked the first `/dev/test-console` local preview surface that reads the typed registry, filters event kinds by source capability, labels safety/default state, prevents impossible source/event combinations, and generates mock display data without dispatching, persisting, routing, or touching money/provider/auth state.
  - 2026-06-22 completed the Event Routing Admin persistence gate design. Before real routed dispatch is allowed, a coordinator-approved generated migration is needed for durable routing rules, event history/audit, approval queue, user opt-outs, cooldown state, and simulated/test reset boundaries. First implementation should be manual/provider-neutral and limited to safe simulated dispatch after schema approval.
  - 2026-06-22 Chunk 20 generated migration `0012_smooth_jack_flag.sql` for Event Routing persistence only and applied it on the dev database after coordinator review. It adds durable routing rules, stream-visible website opt-outs, append-only event history/audit with simulated/test reset flags, approval queue state, and cooldown state. No dispatch, UI, API, provider integration, real money behavior, auth, secrets, or production changes were added.
  - 2026-06-22 Chunk 21A added, deployed, and dev-smoked the first runtime-safe manual Event Routing admin foundation: typed domain routing-rule validation, owner-gated list/update API, and `/admin/event-routing` manual controls for persisted rules. It still does not dispatch real or simulated events, write event history, evaluate cooldown state, enforce moderation, integrate providers, touch real money, change auth, or add user-facing opt-out settings UX.
  - 2026-06-27 Chunk 21B added coordinator-reviewed and dev-smoked safe simulated dispatch from `/dev/test-console` to `/dev/event-routing/dispatch`. It writes only test/simulated/resettable history, queues approval-required events without playback, rejects real providers/real website dispatch/real money, and keeps opt-out/cooldown-aware stream-visible website events fail-closed when user identity cannot be checked.

## 6. Overlay Renderer

- [x] Build basic OBS browser-source overlay page.
- [x] Support URL parameters for scene/layout/theme/mode.
- [x] Load initial state snapshot on page load.
- [x] Connect to live state updates after loading.
- [x] Create typed notification events.
- [x] Add provider/source capability defaults for future routed notifications.
- [x] Build notification queue before display rendering.
- [x] Add top notification zone.
- [x] Resolve top notification avatar from website profile image, then platform avatar, then safe default.
- [x] Add center notification zone.
- [x] Support center notification image and audio clip per stream topic.
- [x] Support redeemable center notifications, such as hydrate, jumpscare, and later AI-triggered mimes.
- [x] Inspect V1 top notification design at `A:\laravel-projects\maiks-yt` before implementing final top notification visuals.
- [x] Add active project/goal progress widget.
- [x] Add last-known-good overlay state.
- [x] Add static/minimal fallback mode for connection loss.
- [x] Test OBS scene switching behavior.
  - Shared browser source scene switching looked fine in OBS; chat overlay behavior was not verified because live/test chat input was unavailable.
- [x] Keep one shared master overlay loaded across OBS scenes instead of preloading separate scene-specific overlays.

## 7. Overlay Control Panel

- [x] Build authenticated control panel page.
- [x] Show connected overlays and current state.
- [x] Add local event generator/replayer controls.
- [x] Add test notification controls.
- [x] Add off-main-view checklist/settings panel for center notification assets and priorities.
- [x] Add layout/theme switching.
- [x] Add emergency clean mode.
- [x] Add chat visibility toggle.
- [x] Add AI mute placeholder.
- [x] Add sponsor visibility toggle.
- [x] Make critical controls usable on mobile.
- [x] Keep default control panel low-distraction.
- [x] Prepare optional advanced/product mode foundation.

## 8. Themes and Layouts

- [x] Define CSS theme contract.
- [x] Create default theme.
- [x] Create first game/hobby theme.
- [x] Define theme-to-scene ownership model.
- [x] Create reusable layout slots.
- [x] Add camera position slots.
- [x] Build a layout designer panel for editing and reserving overlay slots.
- [x] Add drag controls for standard overlay elements.
- [x] Add resize handles for standard overlay elements.
- [x] Add numeric position and size inputs for precise OBS-friendly layout work.
- [x] Save named scenes under the active theme.
- [x] Add duplicate scene action.
- [x] Add reset controls for scene slots.
- [x] Add hide/show controls for scene slots.
- [x] Add lock aspect ratio controls for scene slots.
- [x] Add layout warnings for overlapping visible slots and canvas bounds.
- [x] Decide which slot overlaps are allowed, warnings, or hard blocked before final OBS scene use.
- [x] Test overlay layout at OBS canvas sizes.

## 9. Creator Hub and Content

- [x] Build self-owned links hub.
- [ ] Add social/support/community links.
  - Twitch, YouTube, and Discord/community destinations are linked for the dev site; support destination is still unavailable.
- [x] Add RSS feed for blog posts.
- [x] Add basic blog/update post model.
- [ ] Add AI-assisted draft workflow.
- [ ] Require approval before publishing AI-generated posts.
- [x] Add public personal context page.
- [x] Add public accountability/history page.
- [x] Add transparent affiliate pages.

## 9A. Manual Admin Content Tools

- [x] Build admin shell for owner-only content management.
- [x] Build project admin create/edit pages.
- [x] Build milestone admin create/edit/reorder controls.
- [x] Build non-monetary project item admin create/edit/reorder controls.
- [x] Add database-backed Creator Hub link read-model foundation.
- [x] Build Creator Hub link admin create/edit/reorder controls.
- [x] Add preview-before-publish behavior for public content changes.
- [x] Design first safe page creator and route-admin scope.
- [x] Add owner/admin page creator for path-owned normal website pages.
  - 2026-06-28 added and deployed the first runtime Page Creator slice: owner-gated `/admin/pages`, Markdown draft editing, saved preview-before-publish, publish/unpublish controls, reserved/code-owned route blocking, and public exact-path rendering for published visible page records only.
- [ ] Keep AI assistance draft-only until manual admin workflows exist.

Note: Chunk 2 project-admin domain/API route code, tests, API registration, and `/admin/projects` page are implemented for non-money project content. Chunk 3A added the database-backed public Creator Links foundation. Chunk 3B added owner/admin Creator Hub link mutations and `/admin/links` manual controls while keeping support unavailable. Chunk 13 added reviewed/deployed project-admin preview-before-publish behavior without schema or migration work. Chunk 16A extends project admin preview-before-publish to manual project updates with drafts hidden from public read models. The 2026-06-22 Page Creator and Route Admin design gate chose a first safe path-only page creator for normal website pages, kept code-owned/admin/tool/API/overlay/dev routes reserved, required unique normalized route ownership with fail-closed ambiguity, and deferred host/subdomain plus Cloudflare automation to a later infrastructure-reviewed phase. Chunk 23 generated and dev-applied reviewed migration `0013_lowly_justin_hammer.sql` for `content_pages` persistence only; runtime page admin, public catch-all routing, host/subdomain routing, Cloudflare/DNS automation, AI, and money/legal behavior remain gated.

## 10. Stream Scheduling

- [x] Build stream schedule model.
- [x] Build admin schedule page.
- [x] Build public schedule page.
- [x] Add cancellation flow.
- [x] Add cancellation reason templates.
- [ ] Design game library, game suggestions, and play-schedule links.
- [ ] Prepare Twitch/YouTube scheduling sync.
- [ ] Prepare Discord/social cancellation announcements.

Note: Chunk 8 added the first manual Stream Scheduling MVP with a typed scheduled-stream domain model, generated database migration, dev seed examples, public `/schedule`, owner-gated `/admin/schedule`, and constrained cancellation reason templates. External platform sync, Discord/social announcements, recurrence, notifications, AI, money, and moderation remain deferred.

## 11. Chat and Stream Bot

- [x] Connect fake/local chat source first.
- [x] Normalize fake/local chat messages.
- [x] Tag fake/local messages as human, bot, or system.
- [x] Hide fake/local bot/system messages from overlay by default.
- [x] Build first streamer-only fake/local chat window.
- [x] Add fake/local chat display order toggle.
- [ ] Extend streamer-only unified chat beyond fake/local after live platform chat is approved.
- [ ] Add quick moderation buttons to streamer chat messages.
- [ ] Add advanced moderation context menu.
- [ ] Add typed moderation commands for ban, mute, warning, and rank/status changes.
- [ ] Add basic stream bot command parser.
- [ ] Add commands for website links.
- [ ] Add periodic messages.
- [ ] Add manual chat hide/show.
- [ ] Add emergency chat shutdown behavior.

## 12. AI Stream Assistant

- [ ] Define public speech, private-message audio, and control-panel text modes.
- [ ] Add paid-message readout behavior.
- [ ] Add selected chat readout heard by streamer and stream.
- [ ] Add private-message public announcement and private preamble.
- [ ] Add no-nagging rule to prompts.
- [ ] Add low-energy mode design.
- [ ] Add editable start instructions and provider settings.
- [ ] Add optional draft/shadow mode for tuning without public output.
- [ ] Add interruption avoidance requirement.
- [ ] Add optional stream-end wellness checkpoint.
- [ ] Keep mute/off controls easy to reach.

Gate note: AI public output must start in a private draft/shadow mode before anything can speak on stream, post publicly, read paid messages, or make moderation-like decisions. First safe slice is a local/control-panel-only assistant settings and shadow transcript design with obvious mute/off controls; no provider secrets, no public speech, no paid-message readout, and no autonomous actions.

## 13. Action Panel

- [x] Build action item model.
- [x] Build action panel page.
- [x] Sort by urgency, stream relevance, and category.
- [x] Separate live-safe actions from off-stream admin tasks.
- [x] Add role-aware approval permissions.
- [x] Add approve/reject/defer behavior.
- [x] Add audit history.

## 14. Safety and Moderation

- [ ] Define roles and permissions.
- [ ] Design moderator management page with trust levels, scoped permissions, temporary grants, and audit history.
- [ ] Define community rules.
- [ ] Build warning/strike model.
- [ ] Add automatic warning system.
- [ ] Add ban/restriction model.
- [ ] Add moderation audit history.
- [ ] Decide default quick mute duration.
- [ ] Add abuse policy page, including police-report warning for serious abuse.
- [ ] Add offensive display name handling.
- [ ] Add malicious linking/claiming handling.

Gate note: moderation needs a domain-first rules/audit design before UI buttons or commands. First safe slice is a read-only moderation model/card plus typed action vocabulary for warnings, mutes, bans, display-name handling, and appeal/audit requirements. Do not add enforcement, automatic warnings, provider bans, rank/status changes, or public abuse-policy promises until the model is reviewed.

## 14A. Installable Stream Tools

- [x] Add standalone tool route foundation without normal website navigation.
- [x] Add standalone Action Panel route.
- [x] Add PWA manifest and first shared stream-tools icon set.
- [x] Make control panel installable.
- [ ] Make streamer chat installable.
- [x] Make private notifications panel installable.
  - 2026-06-27 added the first private `/tools/notifications` panel with standalone tool metadata, owner-gated notification API, and a dev-secret `/dev/notifications` endpoint for watchdog/smoke alerts. Push delivery is not wired yet; the first panel polls the API and keeps private data network-only.
- [x] Add Web Push delivery for private notifications.
  - 2026-06-27 added owner-device push subscription persistence, notification-only service-worker delivery, and warning/critical push dispatch for durable notification rows. 2026-06-28 owner-device smoke confirmed Michael receives notifications from the installed app/browser path.
- [x] Add recurring dev smoke notification runner.
  - 2026-06-28 added `pnpm dev:smoke:notify`, a conservative read-only smoke runner for `api-dev`, database health, `web-dev`, `/tools/notifications`, the notification service worker, `overlay-dev`, and `control-dev`. It posts warning/critical rows through `DEV_NOTIFICATION_POST_SECRET`, bounds duplicate identical failures with a cooldown, and can send one recovery note after failures clear.
- [x] Define initial safe cache rule: no private data caching; static assets only until an explicit encrypted/offline design exists.
- [x] Keep local tokenized URL reference files ignored by git.
- [ ] Test installed windows without browser chrome on stream-monitor sizes.
  - Control panel metadata is ready; after deployment, verify installed-window layout at 1920x1080, 1600x900, and 1366x768 stream-monitor sizes, including token-blocked state, overlay visibility controls, scene designer, and fake/local chat sender.
  - 2026-06-19 endpoint/token QA passed for `/tools/actions`, `control-dev`, `overlay-dev`, manifests, token gates, fake/local chat, streamer chat history, chat order, and overlay state. Visual installed-window screenshots at the three target sizes remain open because the Chrome/in-app browser plugin failed to attach in this setup; use Computer Use for the next visual QA pass.
  - 2026-06-21 Computer Use was not exposed in this thread, so a headless Chrome fallback captured screenshots at 1920x1080, 1600x900, and 1366x768 for `/tools/actions`, token-blocked control panel, dev-authenticated control panel, scene designer, and overlay states. No horizontal overflow or normal website navbar was found; fake/local chat order and visibility worked. True installed-window/browser-chrome-free QA remains a manual follow-up if Computer Use becomes available.
  - 2026-06-22 Browser plugin setup was still blocked and Computer Use was not exposed, so a new local headless Chromium fallback captured `/tools/actions`, token-missing control panel, authenticated control panel, scene designer section, overlay ready state, and `/dev/test-console` at 1920x1080, 1600x900, and 1366x768. No horizontal overflow or obvious overlap was found. `/dev/test-console` is readable and preview-only, but it keeps the normal website navbar because it is not a standalone `/tools/*` surface. True installed-window/browser-chrome-free QA remains open.

## 14B. Stream-Safe Music, Future Phase

- [x] Capture viewer-influenced stream-safe music idea card.
- [ ] Research stream-safe music libraries and license proof requirements before implementation.
- [ ] Define approved music catalog and review workflow.
- [ ] Add website admin page for approving/rejecting suggested tracks and editing license metadata.
- [ ] Add separate `/music/player` browser/audio source for OBS audio routing.
- [ ] Add `/music/overlay` now-playing, attribution, safety, and vote display.
- [ ] Add music controls to the existing stream control panel, not a separate music panel.
- [ ] Add viewer voting only for approved tracks.
- [ ] Add public music suggestion form.
- [ ] Consider Twitch Extension only after the website/control-panel flow is safe.

## 15. Money Prep, Not Public Money Yet

- [ ] Compare payment providers available in the Netherlands.
- [ ] Check refunds, partial refunds, chargebacks, recurring support, and fees.
- [ ] Check whether credits are technically and legally realistic.
- [ ] Design multi-currency/value-source support from the start.
- [ ] Decide whether to use double-entry bookkeeping.
- [ ] Draft donation/support terms.
- [ ] Draft refund/revocation wording.
- [ ] Draft affiliate/sponsor disclosure.
- [ ] Decide when real money features can safely start.

Gate note: money remains design-only until Michael explicitly approves a money phase. First safe slice is provider/legal reality-check documentation for the Netherlands, refund/chargeback/recurring-support constraints, and ledger requirements. No payment provider integration, donation buttons, credits, balances, support promises, allocation UI, or real transaction storage before the money gate is opened.

## 16. Later Money Features

- [ ] Build immutable ledger.
- [ ] Add direct donations.
- [ ] Add credits and restricted credits.
- [ ] Add stream goal auto-allocation.
- [ ] Add claimable platform-derived support.
- [ ] Add transparent money trail.
- [ ] Add public withdrawals.
- [ ] Add spending records.
- [ ] Add project archives.
- [ ] Add product price tracking.
- [ ] Add external wishlist provider integrations.

Gate note: later money features require an immutable ledger design, refund/revocation policy, audit/export plan, and provider decision before implementation. External wishlist/provider integrations are provider phases, not casual project-admin or schedule follow-ups.

## 17. Backup, Export, and Recovery

- [ ] Add automated database backups.
- [ ] Add backup health checks.
- [ ] Add manual export for key data.
- [ ] Document restore process.
- [ ] Document rare improper-deletion restore process.
- [ ] Decide backup retention and encryption.

Gate note: backup/export can start before production money, but must be treated as reliability/security work. First safe slice is a backup inventory and restore runbook using dev/staging data only; do not automate production backups, touch secrets, or claim recovery guarantees until retention, encryption, and restore testing are defined.

## 18. Phase Gates Before Risky Work

- [x] Record explicit gates for AI, moderation, money, backups, provider integrations, and production auth/owner assignment.
- [x] Production auth gate: define explicit owner assignment, fresh production OAuth secrets, account recovery, and no first-login auto-promotion before production release work.
- [ ] Provider integration gate: define provider scopes, failure handling, rate limits, token storage, revocation, and manual override before Twitch/YouTube/Discord/music/payment integrations.
- [ ] Moderation gate: approve rules, actions, audit log, appeal/review expectations, and streamer override before enforcement.
- [ ] AI gate: approve private shadow mode, prompt boundaries, mute/off controls, and public-safety review before public AI output.
- [ ] Money gate: approve provider, ledger, refunds/chargebacks, terms, and audit/export behavior before any real money behavior.
- [ ] Backup gate: approve retention, encryption, restore testing, and manual export shape before production backup automation.

Note: 2026-06-22 added the design-only production readiness / dev-to-main checklist in `reports/production-readiness-checklist.md`. It defines future release branch policy, explicit release/operations/safety owners, fresh production secrets/OAuth keys, explicit owner assignment with no first-login auto-promotion, migration order, backup/restore basics, smoke surfaces, rollback decision points, dev-only exclusions, and dangerous gates for real money, provider credentials, public AI, moderation enforcement, production auth/secrets, and backup automation. This does not approve deployment, production config edits, secret rotation, migration generation/application, or server changes.
