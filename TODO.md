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
  - 2026-06-28 Phase 5A generated and dev-applied migration `0016_jittery_nebula.sql` for moderator/helper trust metadata and role-grant audit history. It enriches `user_roles` with trust level, scope, live/offline availability, expiration, revocation metadata, and adds `role_grant_audit_logs`. No admin UI, runtime permission changes, automatic promotions, provider role sync, real moderation enforcement, auth changes, secret changes, or production behavior was added.
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
- [x] Add admin dashboard for testing navigation.
  - 2026-07-09 added `/admin` as a grouped dashboard for current admin/testing surfaces. It preserves `devAuthToken` in links during coordinator smoke so owner-token testing can move between admin pages without copying tokens repeatedly.
  - 2026-07-09 added `/admin` to `pnpm dev:smoke:notify`, bringing the recurring smoke runner to 12 checks and covering the new testing dashboard route with the same text/page retry behavior.
  - 2026-07-09 follow-up added live testing status cards for API health, database health, unread/critical notifications, provider intake health, and session-admin reachability. The dashboard now reads the dev auth token from the shared local storage helper used by admin tooling.
- [x] Add owner session review and revoke surface.
  - 2026-07-09 added owner-only `/admin/sessions` plus API list/revoke routes over Better Auth sessions. The surface shows session timing, IP, and user-agent without exposing session tokens, and revokes by deleting selected session rows.
  - 2026-07-09 follow-up added a protected "revoke other sessions" action that keeps the current real browser session and deletes other Better Auth session rows. Dev-token pseudo sessions are rejected for bulk revoke so smoke tests cannot accidentally clear every browser session.

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
  - 2026-06-28 Phase 4A added, deployed, and dev-smoked safe simulated playback from Event Routing into existing overlay top/center notification WebSocket events. Pending approvals can now be listed/reviewed from owner admin, direct safe simulated routes can publish immediately, internal-only/unsafe events fail closed, and real providers, real website production dispatch, real money, moderation enforcement, and provider intake remain gated.
  - 2026-06-29 Phase 6A added, deployed, and dev-smoked the first real provider SDK foundation in `@maiks-yt/integrations` for Twitch/Twurple, YouTube/googleapis, and Discord REST, plus sanitized provider configuration status and owner-gated `/admin/provider-integrations/status` with `/admin/provider-integrations` display. Missing env vars now report safe missing status and secret values are never returned. Dev smoke confirmed owner access reports Twitch configured and YouTube/Discord missing on the current dev environment, unauthenticated access returns `401`, and the admin page renders without the known injection marker. OAuth, token storage/rotation, webhooks/EventSub receivers, live chat ingestion, provider moderation/write actions, real money, migrations, Cloudflare/Docker config, auth flow changes, and production behavior remain gated.
  - 2026-06-29 Provider status compatibility follow-up: legacy `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` now count as the YouTube OAuth client foundation, and Discord status now surfaces `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` alongside bot-token readiness. Turbo dev env allowlist now passes `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, and `DISCORD_GUILD_ID` into app processes. Safe live checks confirmed the Discord bot token is valid, matches the application id, and can read the configured dev guild after the bot invite/code-grant setting was fixed.
  - 2026-06-29 Provider library capability follow-up: added, deployed, and dev-smoked `@twurple/chat` in the integrations package for the next Twitch chat-intake slice and changed provider status capabilities from plain text to typed available/configured/missing/not-enabled/gated entries. Dev status now shows Twitch chat library available, Twitch EventSub gated, YouTube OAuth consent not enabled, and Discord Gateway/`discord.js` gated. No OAuth/token storage, webhooks, provider writes, or moderation actions were added.
  - 2026-06-29 Phase 6B added, deployed, and endpoint-smoked the first read-only Twitch chat intake path: owner-gated admin status/start/stop controls, anonymous read-only Twurple chat connection to the configured/default Maiks channel, Twitch message projection into the private streamer-chat/control-panel feed, and provider-status runtime state. Smoke confirmed channel `maiksmc` can move stopped -> connecting -> connected -> stopped, and provider status reports `twitch-chat-runtime: configured` while connected. Manual harmless Twitch message verification remains open because this agent should not write to Twitch chat. Twitch messages are not sent to the OBS overlay in this slice. No EventSub, YouTube live chat, Discord Gateway, provider writes, moderation enforcement, token storage, real money, migrations, production behavior, Cloudflare/Docker config, or auth changes were added.
  - 2026-06-30 Phase 6C generated migration `0019_thankful_famine.sql` for `provider_runtime_credentials` and added owner-gated YouTube owner-consent endpoints plus `/admin/provider-integrations` controls. The slice can create a Google consent URL, handle the callback, and store a read-only YouTube refresh token without returning raw tokens. Migration application and live consent smoke remain coordinator steps. Michael wants Discord read-only Gateway intake before YouTube because Discord can be validated without going live; YouTube live-chat polling should stay last among the current chat providers. Twitch EventSub, provider writes, moderation enforcement, real money, production behavior, Cloudflare/Docker config, and secret edits remain separate work.
  - 2026-07-04 coordinator smoke confirmed Phase 6C is deployed on dev and the dev database already has `provider_runtime_credentials`. Unauthenticated YouTube credential access returns `401`; owner-auth consent URL generation returns an accounts.google.com URL with `https://www.googleapis.com/auth/youtube.readonly`, signed state, and `https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback`. Michael completed the Google consent step and an active read-only YouTube credential exists. YouTube live-chat polling remains a later/live-test phase.
  - 2026-07-04 added, deployed, and dev-smoked a dev-only short-lived owner test-token mint endpoint for coordinator smoke testing: `POST /dev/testing/owner-token` requires a server-side mint secret, chooses an existing linked owner wildcard user, stores only a hash in `dev_auth_tokens`, and returns the raw token/login URL once. Tokens expire within 1-15 minutes and exercise the normal dev owner bearer path instead of bypassing page/API permissions. Smoke confirmed missing secret returns `403`, the minted token can access owner-gated provider status, the response does not include the mint secret/raw token, and the DB row stores a 64-character hash. Production disables the endpoint.
  - 2026-07-04 captured the multi-channel provider routing idea. YouTube/Twitch/Discord integrations should separate provider credentials from channel identities and content lanes, because one Google account can expose multiple YouTube channels/Brand Accounts and Michael may route Minecraft, Satisfactory, dev, AI, or other topics to different destinations over time. First safe runtime slice should discover YouTube channels from the stored credential; durable label/selection persistence should follow before live-chat polling.
  - 2026-07-04 added, deployed, and dev-smoked no-schema YouTube channel discovery. Owner-gated `GET /admin/provider-integrations/youtube/channels` uses the stored read-only owner credential and returns sanitized channel summaries only; `/admin/provider-integrations` can display discovered channels. Dev smoke discovered `MaiksMC` (`@maiksmc`). Durable channel identity/selection persistence and live-chat polling remain separate follow-up work.
  - 2026-07-04 added, deployed, migrated, and dev-smoked durable YouTube channel identity/selection. Migration `0021_omniscient_bloodstrike.sql` adds saved provider channel identities; owner-gated API/UI can discover-and-save channels and select/clear the live-chat channel. Dev smoke selected `MaiksMC` (`@maiksmc`) for live chat. Polling, provider writes, EventSub/webhooks, moderation enforcement, money, production behavior, secret edits, and Cloudflare/Docker config remain out of scope.
  - 2026-07-04 added, deployed, and endpoint-smoked read-only YouTube live-chat polling: selected-channel polling through the stored read-only Google credential, owner-gated admin start/stop/status controls, control-token chat-window status/reconnect, provider-status runtime state, `/chat` YouTube service dots, and private streamer-chat projection with overlay visibility false by default. Smoke confirmed unauthenticated admin status returns `401`, owner start/status works, selected channel is `MaiksMC`, token-gated chat status works, and the runtime waits safely when no active YouTube live chat exists. Real YouTube message capture still needs an active YouTube live chat for manual smoke. No provider writes, EventSub/webhooks, moderation enforcement, money, production behavior, schema changes, secret edits, or Cloudflare/Docker config were added.
  - 2026-07-04 researched the official Twitch, YouTube, and Discord event surfaces and added `ideas/provider-event-intake-inventory-and-internal-triggers.md`. Next provider-intake work should catalog all official provider event names first, then add an append-only intake ledger and unknown-safe normalization so every provider event can be logged/internal-triggered even when routing/display remains disabled.
  - 2026-07-04 added the first no-schema provider Connections catalog foundation locally: typed Twitch/YouTube/Discord provider event catalog, typed event action catalog, and read-only `/admin/connections` page. This lists incoming provider event types and possible actions without runtime subscriptions, provider writes, routing execution, schema changes, money behavior, moderation enforcement, secret edits, Cloudflare/Docker config, or production behavior.
  - 2026-07-04 generated local migration `0022_living_rage.sql` for `provider_event_intake_logs` plus domain normalization/redaction helpers. This gives provider events a pre-routing append-only ledger for known and unknown incoming events, but does not yet add runtime writes, API list/read endpoints, broad subscriptions, provider writes, routing execution, money behavior, moderation enforcement, secret edits, Cloudflare/Docker config, or production behavior.
  - 2026-07-04 wired existing read-only Twitch, YouTube, and Discord chat intake projections into `provider_event_intake_logs`. Chat messages still appear in the private streamer chat path as before, and ledger write failures do not block chat display. This does not add broad EventSub/webhook/Gateway subscriptions, provider writes, routing execution, public overlay behavior, money behavior, moderation enforcement, secret edits, Cloudflare/Docker config, or production behavior.
  - 2026-07-04 added owner-gated read-only `GET /admin/connections/intake` and a Recent Received Events panel on `/admin/connections` for the provider intake ledger. The UI lists summaries, safety badges, provider/channel/actor context, and redacted payload previews only. It adds no mutation controls, provider writes, routing execution, public overlay behavior, money behavior, moderation enforcement, secret edits, Cloudflare/Docker config, or production behavior.
  - 2026-07-04 added broad read-only Discord Gateway non-chat intake logging. The existing Discord Gateway runtime now projects raw non-`MESSAGE_CREATE` Gateway packets into `provider_event_intake_logs` with known/unknown-safe internal triggers and redacted payloads. Chat `MESSAGE_CREATE` continues through the private streamer-chat path to avoid duplicate ledger rows. No provider writes, Discord role sync, routing execution, public overlay behavior, money settlement, moderation enforcement, secret edits, Cloudflare/Docker config, or production behavior were added.
  - 2026-07-04 added the first Twitch EventSub webhook receiver foundation at `POST /provider-webhooks/twitch/eventsub`. It verifies Twitch HMAC signatures against the raw body, returns verification challenges, logs notification/revocation payloads into `provider_event_intake_logs`, and reports receiver-secret readiness in provider status. It does not create subscriptions, call Twitch APIs, execute provider writes, route events publicly, settle money, enforce moderation, edit secrets, change Cloudflare/Docker config, or enable production behavior.
  - 2026-07-05 added a review-ready Twitch EventSub subscription manager for the log-only receiver. Owner-gated API/UI can list current webhook subscriptions and create missing defaults for `stream.online`, `stream.offline`, and `channel.update` using app-token Twitch API access and the configured webhook secret without exposing secrets. Dev server manual smoke already enabled those three subscriptions for broadcaster `617410645`/`maiksmc`; real intake rows will arrive when Twitch sends actual online/offline/channel-update notifications. No provider writes beyond subscription registration, public routing, money settlement, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-05 added, deployed, and fail-closed-smoked a Discord webhook-events receiver at `POST /provider-webhooks/discord/events`. It verifies `X-Signature-Ed25519`/`X-Signature-Timestamp` using `DISCORD_PUBLIC_KEY` or `DISCORD_APPLICATION_PUBLIC_KEY`, acknowledges signed `PING` payloads with `204`, and logs signed event payloads into `provider_event_intake_logs` with mechanism `discord-webhook`. 2026-07-09 follow-up loaded the Discord application public key on dev, restarted the container, confirmed unsigned requests fail with `401 discord_webhook_signature_rejected`, and provider status reports `discord-webhook-events` as configured. No Discord provider writes, role sync, public routing, money settlement, moderation enforcement, schema change, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-05 added, deployed, and dev-smoked a YouTube PubSubHubbub receiver at `GET/POST /provider-webhooks/youtube/pubsub`. It echoes hub verification challenges, parses Atom feed POSTs with `fast-xml-parser`, and logs feed entries as `youtube-pubsub` provider intake events for upload/content-update notifications. Smoke confirmed challenge echo, synthetic Atom POST `204`, and recent `youtube-pubsub` intake rows in `/admin/connections/intake`. No YouTube provider writes, subscription creation, public routing, money settlement, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-05 added, deployed, and dev-smoked a YouTube PubSub subscription manager. Owner-gated API/UI can show the selected YouTube channel feed topic and public callback URL, then request subscribe or unsubscribe with the Google PubSubHubbub hub. Smoke confirmed the selected channel target is ready, the hub accepted the subscribe request, and Google called back to the receiver with a verification challenge that returned `200`. The hub has no list/status API, so this surface reports target readiness and request results rather than pretending to know durable subscription state. No provider content writes, public routing, money settlement, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-05 added, deployed, and dev-smoked a YouTube activities poller. Owner-gated API/UI can manually poll recent selected-channel activities through the stored read-only YouTube credential and write resulting activity events to `provider_event_intake_logs` with mechanism `youtube-activity`. Smoke confirmed unauthenticated poll returns `401`, owner poll fetched recent activities for the selected channel, and `/admin/connections/intake` shows recent `youtube-activity` rows. This is a one-shot manual poll only; no recurring scheduler, provider writes, public routing, money settlement, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-09 added a read-only provider intake health summary API and `/admin/connections` health cards. The owner-gated endpoint summarizes latest stored rows for Twitch EventSub/IRC, YouTube live chat/activity/PubSub, and Discord Gateway/webhook mechanisms as healthy, stale, or missing. It adds no provider writes, routing execution, money behavior, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior.
  - 2026-07-09 added provider intake health shape verification to `pnpm dev:smoke:notify`. The smoke runner mints a short-lived dev owner token when a dev testing secret is available, verifies the owner-gated health endpoint payload, and stays quiet about normal healthy/stale/missing mechanism statuses. It skips the owner-gated check in local shells without a dev testing secret.
  - 2026-07-09 added a low-frequency read-only YouTube activities poll to `pnpm dev:smoke:notify` when a dev testing secret is available. This reuses the existing owner-gated poll endpoint as a dev intake heartbeat and stores only the already-reviewed provider intake rows. It does not add provider writes, public routing, money settlement, moderation enforcement, schema change, secret edit, Cloudflare/Docker config, or production behavior.
  - 2026-06-30 provider-intake rule update: real provider intake should be always-on by default once connected. Offline Twitch subs/bits/follows, YouTube memberships/paid events, Discord boosts, and similar events still need to be registered for history/accounting. Live/offline routing controls whether they display, not whether they are stored.
  - 2026-07-02 Phase 6D implemented Discord read-only Gateway chat intake for the private streamer chat path. It adds `discord.js`, typed Discord message projection, owner-gated status/start/stop endpoints, token-gated chat-window status/reconnect endpoints, provider-status runtime capability, `/admin/provider-integrations` controls, and Discord service dots in `/chat`. Discord messages remain private streamer-chat/control-panel input only and are not routed to OBS overlay by default. No provider writes, Discord role sync, moderation enforcement, EventSub/webhooks, YouTube polling, real money, migrations, auth changes, Cloudflare/Docker config, or production behavior was added.
  - 2026-07-03 Phase 6F provider failure alert hook added for review: Twitch and Discord read-only chat runtimes now create a warning `source: provider` system notification through the existing notification/Web Push path when auto-reconnect is suppressed after repeated disconnects. This does not add provider writes, provider moderation, new schema, secret edits, production behavior, or a destructive reconnect loop.
  - 2026-07-04 current `dev` was redeployed from commit `150351c` and smoke-tested after reusable check-script/refactor work. `api-dev`, `web-dev`, `control-dev/chat`, and `overlay-dev` returned `200` without the known injection marker; provider status shows Twitch and Discord runtimes connected and YouTube OAuth consent available.

## 6. Overlay Renderer

- [x] Build basic OBS browser-source overlay page.
- [x] Support URL parameters for scene/layout/theme/mode.
- [x] Load initial state snapshot on page load.
- [x] Connect to live state updates after loading.
- [x] Create typed notification events.
- [x] Add provider/source capability defaults for future routed notifications.
- [x] Build notification queue before display rendering.
- [x] Route safe simulated Event Routing approvals/direct outcomes into overlay top/center notification playback.
- [x] Add user-facing stream visibility opt-outs for website/community events.
  - 2026-06-28 added current-user stream visibility preferences on `/account` backed by `event_user_opt_outs`, with a global opt-out plus website signup, public name, profile image, and future free TTS scopes. Safe simulated website dispatch now attaches the signed-in domain user where available, blocks opted-out stream-visible events, and fails closed when identity is missing.
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
  - 2026-07-09 coordinator-reviewed Phase D1 adds local Page Creator validation copy before save/publish mutations and records the next content chunks: current-schema page polish, support destination activation after Michael approval, project/public-policy polish, and schema-gated Game Library/play schedule.
- [ ] Keep AI assistance draft-only until manual admin workflows exist.

Note: Chunk 2 project-admin domain/API route code, tests, API registration, and `/admin/projects` page are implemented for non-money project content. Chunk 3A added the database-backed public Creator Links foundation. Chunk 3B added owner/admin Creator Hub link mutations and `/admin/links` manual controls while keeping support unavailable. Chunk 13 added reviewed/deployed project-admin preview-before-publish behavior without schema or migration work. Chunk 16A extends project admin preview-before-publish to manual project updates with drafts hidden from public read models. The 2026-06-22 Page Creator and Route Admin design gate chose a first safe path-only page creator for normal website pages, kept code-owned/admin/tool/API/overlay/dev routes reserved, required unique normalized route ownership with fail-closed ambiguity, and deferred host/subdomain plus Cloudflare automation to a later infrastructure-reviewed phase. Chunk 23 generated and dev-applied reviewed migration `0013_lowly_justin_hammer.sql` for `content_pages` persistence only; runtime page admin, public catch-all routing, host/subdomain routing, Cloudflare/DNS automation, AI, and money/legal behavior remain gated.

## 10. Stream Scheduling

- [x] Build stream schedule model.
- [x] Build admin schedule page.
- [x] Build public schedule page.
- [x] Add cancellation flow.
- [x] Add cancellation reason templates.
- [x] Design game library, game suggestions, and play-schedule links.
  - 2026-07-09 generated `0024_overjoyed_wrecker.sql` for game library persistence: owner-curated game records, private/reviewed suggestions, and links from games to existing stream schedule entries. Runtime admin/public pages, public suggestions, gifted-game handling, provider/store sync, money behavior, and scheduling provider sync remain separate scopes.
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
- [x] Extend streamer-only unified chat beyond fake/local after live platform chat is approved.
  - 2026-06-30 Phase 6B added read-only Twitch messages to the private streamer chat/control-panel feed. YouTube and Discord source support remains type/UI-ready but their live intake is separate follow-up work.
  - 2026-07-02 follow-up kept the standalone `/chat` window newest-first, compressed provider state into service dots, and added a control-token reconnect action for stopped Twitch intake. Unexpected Twitch chat disconnects now auto-reconnect unless 10 disconnects happen in 10 minutes, at which point manual review is required.
- [x] Add quick moderation buttons to streamer chat messages.
  - 2026-06-30 added source-tinted streamer chat rows plus quick Hide/Ban/Options controls. Hide, Ban, and Warn now call universal Maiks.yt-local streamer chat moderation endpoints for any source, with no provider API writes. The third warning applies an automatic local stream-surface ban.
- [x] Add advanced moderation context menu.
  - 2026-06-30 added a first Options panel with fake/local Warn/Note actions and disabled placeholders for censored-message allow controls. `Allow always`, `Allow this stream`, and timed allow rules still need a reviewed moderation allowlist/persistence phase.
- [x] Add applied chat-rules management window.
  - 2026-06-30 added a separate `/moderation` control-window route for active local chat hide/ban/warning rules and retraction. Hide/ban now write durable active moderation rows, warnings write durable audit rows with counts derived from history, and startup hydrates active local rules into the chat filter. Provider-side enforcement remains a future persistence/provider-write phase.
- [ ] Send warning messages to originating platform chat.
  - Required provider-write behavior: when Warn is used, send a message in the originating Twitch/YouTube/Discord chat tagging the user and saying they have a warning and the third warning results in an automatic ban. Current local endpoint returns the intended provider message text but does not send it until provider write clients, permissions, audit, and failure handling are implemented.
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

- [x] Define roles and permissions.
  - Direction: build configurable rank paths with levels and explicit action rights. Example: `mod lvl 1` through `mod lvl 10` are all mods, and a final promotion can jump to another path such as `admin lvl 1`. Rights attach to actions, then ranks collect those rights; emergency clear should start one rank above the first moderator rank by default and remain removable.
  - Approved defaults: seed `mod` levels 1-10, include an `admin` path, add an owner rank for Michael with all rights, allow multiple rank assignments, and use `/moderation` as the moderator control route.
  - Rights model should be Discord-inspired: users can hold multiple roles/ranks, effective rights are computed from explicit action flags, and future Discord role sync can be managed from the website. Maiks.yt remains authoritative; Discord role changes are audited integration output.
  - 2026-07-02 generated and dev-applied migration `0020_opposite_marauders.sql` for `role_rank_paths` plus rank metadata on `roles`, added owner-only rank path/role rights editing to `/admin/moderators`, and extended dev seed defaults for owner/mod/admin paths. Dev smoke confirmed API health, owner-auth `/admin/moderators` rank paths `owner`/`mod`/`admin`, seeded owner/mod/admin roles, `canManageRanks: true`, and `web-dev` `/admin/moderators` returning `200` without the known injection marker.
- [x] Design moderator management page with trust levels, scoped permissions, temporary grants, and audit history.
  - 2026-06-28 Phase 5B added, deployed, and dev-smoked a manual owner-gated `/admin/moderators` surface plus API/domain rules for listing users/roles/grants/audit context and granting, updating, or revoking non-owner helper/moderator role grants over the Phase 5A persistence shape. Grant/update/revoke writes role-grant audit rows. Owner/admin roles, wildcard/role-management, production auth/secrets, provider credentials, real money, irreversible user deletion, and audit-log-disabling permissions are rejected. No migrations, provider sync, automatic promotion, real moderation enforcement, auth changes, secrets, or production behavior were added.
- [x] Add read-only live helper dashboard before moderation enforcement.
  - 2026-06-28 Phase 5C added, deployed, and dev-smoked `GET /admin/live-helper` and `/admin/live-helper` for owner wildcard or `moderators:manage` monitoring of safe pending Event Routing approvals, warning/critical notification summaries, active non-owner helper/moderator grants, and recent safe simulated/test event-routing history. The page/API are read-only and expose no raw payloads, secrets, tokens, provider credentials, deleted-user data, grant/revoke/approve/reject/moderation controls, schema changes, provider enforcement, money/support authority, AI decisions, auth changes, or production behavior.
- [x] Build a dedicated moderator control window.
  - Michael wants moderators to have their own window where they can assist across the fronts they are allowed to manage. First safe scope should combine private chat visibility, permission-gated quick actions, active rule review/retraction, pending approvals, and helper status without exposing owner-only provider credentials, money, auth, deployment, or destructive controls.
  - Product direction: start with the same combined-chat shape as `/chat`, add allowed quick controls on each row, and put the moderator's accessible panels behind a compact top dropdown. Keep default information dense but readable; move secondary context to hover/tooltips/expansion/options.
  - 2026-07-02 added the first chat-first `/moderation` control window with permission-filtered panels for Chat, Applied Rules, Pending Approvals, and Live Helper Summary. Stream chat hide/ban/warn/retract mutations now require both a valid control URL token and a signed-in user with matching role rights, and emergency clear requires `chat:emergency-clear`.
- [x] Add fake/local-only moderation command vocabulary and audit before provider enforcement.
  - 2026-06-29 Phase 5D added, deployed, and dev-smoked a fake/local-only `POST /fake-local-chat/moderation/commands` path with `fake-local-chat:moderate` gating, safe actions for warning, hiding fake/local messages, temporary local mutes, notes, and no-op drills, plus in-memory audit summaries in `/admin/live-helper`. Hidden fake/local messages are removed from streamer/overlay fake chat views, temporary local mutes suppress only fake/local test messages, and all outcomes keep `providerAction: false`. No Twitch/YouTube/Discord/provider enforcement, schema/migration, durable moderation audit, destructive user actions, money/support authority, AI decisions, auth changes, secrets, or production behavior was added.
- [x] Generate durable moderation audit persistence migration.
  - 2026-06-29 Phase 5E generated `packages/database/drizzle/0017_busy_harpoon.sql` for `moderation_audit_logs`, covering provider-neutral action/outcome/source fields, actor/target/message/event/session references, duration/active-until fields, provider-action metadata, test/simulated/reset boundaries, redacted context, timestamps, indexes, and safety checks that keep fake/local rows test/simulated with no provider action. Migration application and runtime writes remain separate follow-up work.
- [x] Persist fake/local moderation audit to the durable moderation table.
  - 2026-06-29 Phase 5F added, deployed, migrated, and dev-smoked fake/local moderation command attempts writing into `moderation_audit_logs` and `/admin/live-helper` reading recent fake/local audit rows from the durable table. Live hide/mute state intentionally remains in memory, so active suppressions still reset on API restart. Rows are forced to fake-local, test, simulated, resettable, and `providerAction: false`; no provider enforcement, destructive actions, durable active moderation state, money/support authority, AI decisions, auth changes, secrets, or production behavior was added.
- [x] Design durable active moderation state before making hide/mute state persistent.
  - 2026-06-29 Phase 5G completed a design/schema gate for a separate `moderation_active_states` read model. The smallest future migration should track current active message hides, mutes, restrictions, and bans with source/target references, expiration, revocation, appeal/review metadata, provider linkage, audit-row links, and fake-local/test/reset boundaries. Migration generation/application, runtime writes, provider enforcement, destructive moderation actions, auth changes, secrets, AI moderation, money/support authority, and production behavior remain gated.
- [x] Generate durable active moderation state migration.
  - 2026-06-29 Phase 5H generated `packages/database/drizzle/0018_slimy_stellaris.sql` for `moderation_active_states`, a current-state read model linked to `moderation_audit_logs` through create/last/revoke audit ids. The table covers source/state/status, target references, active timing, revocation, appeal/review metadata, provider placeholders without raw payloads or credentials, test/simulated/resettable flags, current-active indexes, and safety checks for fake-local/resettable/provider/revocation/temporary-state consistency. Migration application, runtime writes, live-helper durable active reads, provider enforcement, destructive moderation actions, auth changes, secrets, AI moderation, money/support authority, and production behavior remain gated.
- [x] Persist fake/local active moderation state after durable active-state migration.
  - 2026-06-29 Phase 5I added, deployed, migrated, and dev-smoked fake/local hide and temporary mute commands writing active rows into `moderation_active_states`, plus a read-only active fake/local moderation summary in `/admin/live-helper`. Dev smoke confirmed hidden fake/local messages disappear from streamer chat snapshots, temporary local mutes suppress matching fake/local messages, `/admin/live-helper` returns the active `message_hidden` and `author_muted` rows, and the dev DB rows are fake-local/test/simulated/resettable with `providerAction: false`. Warn, note, and noop commands remain audit-only. Live suppression still uses the in-memory runtime cache for immediate fake/local behavior. No provider enforcement, destructive actions, durable provider state, money/support authority, AI decisions, auth changes, secrets, or production behavior was added.
- [x] Define community rules.
  - 2026-06-29 Phase 5J completed a docs/design/schema-gate pass for community rules and moderation policy boundaries. The draft rules cover respect/harassment, stream disruption, identity abuse, support or money-adjacent abuse, privacy, and serious legal/platform escalation. These are design notes only, not a published policy page or production promise.
- [x] Build warning/strike model.
  - 2026-06-29 Phase 5J chose the safest manual-first ladder: internal note, human-reviewed warning, human-reviewed strike, active restriction, and owner-reviewed ban. Three active strikes should trigger owner review rather than an automatic ban. Helpers may monitor, add notes, draft proposed warnings, and run fake/local drills through narrow grants, but owner/admin/auth/money/secrets/provider authority remains out of scope.
- [ ] Add automatic warning system.
- [ ] Add ban/restriction model.
  - 2026-06-29 Phase 5J designed the restriction escalation model only. Existing `moderation_active_states` remains the current-effect read model for hides/mutes/restrictions/bans, while future strike/policy records should be separate from active enforcement state. Runtime restrictions, real bans, provider actions, destructive actions, and automatic escalation remain gated.
- [ ] Add moderation audit history.
  - 2026-06-29 Phase 5J kept `moderation_audit_logs` as append-only action history and `moderation_active_states` as current effect. A minimal future schema, if approved, would add `community_policy_versions`, `community_rule_definitions`, and `moderation_strikes`; no migration was generated.
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
- [x] Make streamer chat installable.
  - 2026-06-29 added a dedicated `/chat` mode on `control-dev` with its own `chat-manifest.webmanifest`, PWA identity, and focused full-window streamer chat layout. It reuses the existing control-panel token gate and streamer-chat API/live feed, and it does not add provider writes, moderation actions, service-worker private caching, auth changes, migrations, or production behavior.
  - 2026-06-29 follow-up narrowed the normal control-panel PWA manifest to `/control` so the existing control app no longer claims the whole `control-dev` origin and blocks `/chat` from installing as a separate app. Existing old-scope installs may need to be removed once on Ubuntu/Android before reinstalling the separate control/chat PWAs.
  - 2026-06-29 follow-up added a read-only Twitch intake status card to the standalone `/chat` PWA using the same `control:open` token gate, so the chat window can show connected/connecting/stopped state, channel, last message time, and safe runtime errors without adding provider writes, moderation, EventSub, auth changes, or migrations.
  - 2026-07-02 follow-up replaced the large status card with compact Twitch/YouTube/Discord service dots. Green means connected, red disconnected, orange connecting/problem; Twitch can retry a stopped connection from the chat window, and configuration/problem states link back to provider admin.
- [x] Make private notifications panel installable.
  - 2026-06-27 added the first private `/tools/notifications` panel with standalone tool metadata, owner-gated notification API, and a dev-secret `/dev/notifications` endpoint for watchdog/smoke alerts. Push delivery is not wired yet; the first panel polls the API and keeps private data network-only.
- [x] Add Web Push delivery for private notifications.
  - 2026-06-27 added owner-device push subscription persistence, notification-only service-worker delivery, and warning/critical push dispatch for durable notification rows. 2026-06-28 owner-device smoke confirmed Michael receives notifications from the installed app/browser path.
- [x] Add recurring dev smoke notification runner.
  - 2026-06-28 added `pnpm dev:smoke:notify`, a conservative read-only smoke runner for `api-dev`, database health, `web-dev`, `/tools/notifications`, the notification service worker, `overlay-dev`, and `control-dev`. It posts warning/critical rows through `DEV_NOTIFICATION_POST_SECRET`, bounds duplicate identical failures with a cooldown, and can send one recovery note after failures clear.
  - 2026-07-09 added text/page retry knobs to `pnpm dev:smoke:notify` so web/tool/control/overlay/chat/moderation route checks can tolerate first-hit Next/Vite cold compilation on the HDD-backed dev folder, while API/database JSON checks remain single-shot.
  - 2026-06-30 follow-up: cron was confirmed firing at the scheduled times, but healthy runs remain intentionally quiet. Only failures and recovery-after-failure should notify.
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
- [ ] Design profit-aware income/cost reporting with dated fee and split rules.
  - 2026-07-09 Phase C1 added `reports/money-accounting-stage-plan.md`, defining a private/admin-first ledger/report/export path plus a generated-migration-only Phase C2 target. Public payment/donation/support behavior remains gated.
  - 2026-07-09 Phase C2 generated migration `0023_slimy_harpoon.sql` for private money ledger transactions/lines, dated rule versions, receipt references, report export audit, and accounting warnings. Runtime admin entry/report screens are next; public payments/support remain gated.
  - 2026-07-09 Phase C3 adds owner-only `/admin/money` plus `GET /admin/money/ledger` and `POST /admin/money/transactions` for manual private income/cost/fee/payout-style entries. This is manual ledger testing only, not public payment behavior.
  - 2026-07-09 Phase C4 adds owner-only CSV export for the current private ledger list and records each export in `money_report_exports` with checksum/count metadata. This is private reporting support only, not provider settlement or public money behavior.
  - 2026-07-09 Phase C5 adds optional private receipt/reference capture to manual ledger entries using the existing `money_receipt_references` table and includes receipt reference columns in CSV export. This is URL/reference metadata only, not file upload/storage.
  - 2026-07-09 Phase C6 adds owner-only voiding for private money entries so testing mistakes can be marked `voided` without deletion. Ledger summary totals ignore voided real entries, while CSV export still includes them for audit visibility.
  - 2026-07-09 Phase C7 adds owner-only correction transaction support: correction entries must reference an existing transaction and carry a reason, and `/admin/money` can start a correction draft from an existing row.
  - 2026-07-09 Phase C8 adds derived accounting warnings to `/admin/money` and export audit metadata for missing categories, missing receipt/reference metadata on real outgoing lines, and posted real estimates that still need confirmation.
  - 2026-07-09 Phase C9 adds accounting-date filters to private ledger list and CSV export, with current-month defaults in `/admin/money` and filter metadata recorded in export audit rows.
  - 2026-07-09 Phase C10 adds an owner-only JSON accounting summary export beside CSV, using the same private ledger/date filters and export audit table. It summarizes transaction/line/warning counts, real/all in/out/remainder totals, warning counts, and breakdowns by transaction type, money mode, category, and source provider.
  - 2026-07-09 Phase C11 adds owner-only accounting warning resolution using the existing `money_accounting_warnings` table. Resolving a derived warning suppresses that specific target/kind from list/export/report warnings without deleting ledger rows or adding a new migration.
  - 2026-07-09 Phase C12 adds an owner-only accounting warning review CSV export for unresolved filtered warnings, recorded in `money_report_exports` as `warning_review`.
  - 2026-07-09 Phase C13 adds owner-only private receipt evidence upload/download for manual ledger entries using ignored server-local `.private/money-receipts` storage and existing `future_upload` receipt references. No schema, public money, or provider behavior changed.
  - 2026-07-09 Phase C14 adds an owner-only accounting review package JSON export that bundles the current filtered summary, ledger CSV text, warning CSV text, and receipt reference index into one private download with export audit checksum metadata.
- [ ] Draft donation/support terms.
- [ ] Draft refund/revocation wording.
- [ ] Draft affiliate/sponsor disclosure.
- [ ] Decide when real money features can safely start.

Gate note: money remains design-only until Michael explicitly approves a money phase. First safe slice is provider/legal reality-check documentation for the Netherlands, refund/chargeback/recurring-support constraints, and ledger requirements. No payment provider integration, donation buttons, credits, balances, support promises, allocation UI, or real transaction storage before the money gate is opened.
  - 2026-06-30 added the profit-aware money reporting and dated rules idea card. The money phase now needs private admin reports for gross income, fees, costs, dated third-party split/fee rules, corrections, and exports before real public money behavior is safe.

## 16. Later Money Features

- [ ] Build immutable ledger.
  - 2026-07-09 Phase C2 generated the private ledger schema foundation; coordinator review/apply on dev is needed before runtime manual entry screens.
  - 2026-07-09 Phase C3 adds the first owner-only manual ledger entry/list UI for test data. It is not full double-entry bookkeeping yet.
- [ ] Add direct donations.
- [ ] Add credits and restricted credits.
- [ ] Add stream goal auto-allocation.
- [ ] Add claimable platform-derived support.
- [ ] Add transparent money trail.
- [ ] Add private accounting/report export.
  - First private accounting UI exists as ledger entry/list/summary. Phase C4 adds a manual CSV export button and audit row. Phase C5 adds receipt/reference metadata capture and CSV columns. Phase C6 adds non-destructive voiding for test mistakes. Phase C7 adds linked correction transactions. Phase C8 adds derived warning visibility and warning-count export metadata. Phase C9 adds accounting-date filtering for list/export. Phase C10 adds a JSON accounting summary report. Phase C11 adds warning resolution. Phase C12 adds warning-review CSV export. Phase C13 adds private receipt evidence upload/download for manual entries. Phase C14 adds a bundled private accounting review package export; richer XLSX/PDF packages remain later slices.
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
- [x] Document restore process.
- [x] Document rare improper-deletion restore process.
- [ ] Decide backup retention and encryption.

Gate note: backup/export can start before production money, but must be treated as reliability/security work. First safe slice is a backup inventory and restore runbook using dev/staging data only; do not automate production backups, touch secrets, or claim recovery guarantees until retention, encryption, and restore testing are defined.
  - 2026-07-09 Phase E1 added `reports/backup-restore-runbook.md` for dev/staging-safe inventory, manual export/restore verification, improper-deletion drill boundaries, and failure-only backup-health notification expectations. Production backup automation, encryption/key policy, retention, and destructive restore remain gated.

## 18. Phase Gates Before Risky Work

- [x] Record explicit gates for AI, moderation, money, backups, provider integrations, and production auth/owner assignment.
- [x] Production auth gate: define explicit owner assignment, fresh production OAuth secrets, account recovery, and no first-login auto-promotion before production release work.
- [ ] Provider integration gate: define provider scopes, failure handling, rate limits, token storage, revocation, and manual override before Twitch/YouTube/Discord/music/payment integrations.
  - 2026-06-29 Phase 6A opened only the read-only provider SDK/config-status foundation and deployed it to dev. The full provider integration gate remains open for scopes, rate limits, durable token storage, revocation, manual override, webhook/chat intake safety, provider failure handling, and production-secret readiness before any real provider intake or action.
  - 2026-06-29 Phase 6B keeps Twitch chat intake read-only and dev-controlled through owner-gated start/stop/status. It still does not approve provider writes, EventSub, durable token storage, moderation enforcement, money, or production behavior.
  - 2026-06-30 Phase 6C adds the first durable provider runtime credential shape for YouTube owner-authorized read-only live chat. This opens dev token storage only after the migration is applied; production vault/encryption/rotation policy is still future readiness work.
  - 2026-06-30 provider intake should run by default, including while offline, once a provider is connected. Event Routing live/offline flags must be display/routing gates only.
  - 2026-07-04 provider event inventory gate: before adding broad EventSub/Gateway/webhook intake, implement a typed provider-event catalog and append-only intake ledger so unknown/new provider events are stored and mapped to internal triggers instead of being dropped.
  - 2026-07-05 typed provider-event/action catalog, append-only intake ledger migration, runtime writes for existing read-only chat intake services, read-only admin intake visibility, broad Discord Gateway non-chat intake logging, the first Twitch EventSub verified/log-only receiver, Twitch EventSub default subscription manager, Discord webhook-events receiver, YouTube PubSub receiver, YouTube PubSub subscription manager, and manual YouTube activities poller are deployed on dev. Provider intake foundations are broad enough to switch to the next explicit phase, still without provider writes or public routing unless that phase is opened.
- [ ] Moderation gate: approve rules, actions, audit log, appeal/review expectations, and streamer override before enforcement.
  - 2026-07-09 Phase B1 adds moderation-window disabled-action explanations for missing rights and provider-write gates. Real provider enforcement, automatic warnings, durable allow rules, and policy/strike schema remain gated.
- [ ] AI gate: approve private shadow mode, prompt boundaries, mute/off controls, and public-safety review before public AI output.
- [ ] Money gate: approve provider, ledger, refunds/chargebacks, terms, and audit/export behavior before any real money behavior.
- [ ] Backup gate: approve retention, encryption, restore testing, and manual export shape before production backup automation.
  - 2026-07-09 Phase F1 refreshed `reports/production-readiness-checklist.md` into a staged dev-to-prod gate checklist. It is still not deployment approval.

Note: 2026-06-22 added the design-only production readiness / dev-to-main checklist in `reports/production-readiness-checklist.md`. It defines future release branch policy, explicit release/operations/safety owners, fresh production secrets/OAuth keys, explicit owner assignment with no first-login auto-promotion, migration order, backup/restore basics, smoke surfaces, rollback decision points, dev-only exclusions, and dangerous gates for real money, provider credentials, public AI, moderation enforcement, production auth/secrets, and backup automation. This does not approve deployment, production config edits, secret rotation, migration generation/application, or server changes.
