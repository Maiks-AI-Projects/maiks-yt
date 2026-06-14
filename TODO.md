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
- [ ] Start using branches once live, in serious testing, or making risky/long-running changes.

## 2. Technical Foundation

- [x] Choose monorepo tooling.
- [x] Choose web framework.
- [x] Choose database approach.
- [x] Confirm local MySQL direction.
- [x] Choose validation/type contract library.
- [x] Decide API/realtime backend shape.
- [x] Decide whether overlay/control panel use Vite + React.
- [x] Decide how real-time overlay state will work.
- [ ] Decide local production hosting shape for `cloudflared`.
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
- [ ] Add localization structure from the start.
- [ ] Add minimal analytics/security logging boundaries.
- [x] Add initial architecture/file-boundary rule checker.
- [x] Add rule violation report workflow for next-session review.
- [x] Decide whether rule violations warn or block commits during early development.

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

## 5. Projects and Milestones

- [ ] Build basic project list.
- [ ] Build project detail page.
- [ ] Support project categories.
- [ ] Support non-monetary milestones.
- [ ] Support project updates.
- [ ] Support linking stream sessions to projects.
- [ ] Add active project/stream focus display.
- [ ] Add internal wishlist entries linked to project items.

## 5.5 Stream Simulator and Event Replayer

- [x] Build fake typed event generator.
- [x] Add event storm presets.
- [x] Add event replay controls.
- [x] Support recording/replaying local stream sessions.
- [x] Strip sensitive data from recorded replay fixtures.
- [x] Use simulator events for overlay and control panel testing.

## 6. Overlay Renderer

- [x] Build basic OBS browser-source overlay page.
- [x] Support URL parameters for scene/layout/theme/mode.
- [x] Load initial state snapshot on page load.
- [x] Connect to live state updates after loading.
- [x] Create typed notification events.
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
- [ ] Test OBS scene switching behavior.
- [ ] Decide whether preloaded overlays are required.

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
- [ ] Build a layout designer panel for editing and reserving overlay slots.
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
- [ ] Test overlay layout at OBS canvas sizes.

## 9. Creator Hub and Content

- [x] Build self-owned links hub.
- [ ] Add social/support/community links.
- [x] Add RSS feed for blog posts.
- [x] Add basic blog/update post model.
- [ ] Add AI-assisted draft workflow.
- [ ] Require approval before publishing AI-generated posts.
- [ ] Add public personal context page.
- [ ] Add public accountability/history page.
- [ ] Add transparent affiliate pages.

## 10. Stream Scheduling

- [ ] Build stream schedule model.
- [ ] Build admin schedule page.
- [ ] Build public schedule page.
- [ ] Add cancellation flow.
- [ ] Add cancellation reason templates.
- [ ] Prepare Twitch/YouTube scheduling sync.
- [ ] Prepare Discord/social cancellation announcements.

## 11. Chat and Stream Bot

- [ ] Connect fake/local chat source first.
- [ ] Normalize chat messages.
- [ ] Tag messages as human, bot, system, or moderator tool.
- [ ] Hide bot/system messages from overlay by default.
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

## 13. Action Panel

- [ ] Build action item model.
- [ ] Build action panel page.
- [ ] Sort by urgency, stream relevance, and category.
- [ ] Separate live-safe actions from off-stream admin tasks.
- [ ] Add role-aware approval permissions.
- [ ] Add approve/reject/defer behavior.
- [ ] Add audit history.

## 14. Safety and Moderation

- [ ] Define roles and permissions.
- [ ] Define community rules.
- [ ] Build warning/strike model.
- [ ] Add automatic warning system.
- [ ] Add ban/restriction model.
- [ ] Add abuse policy page, including police-report warning for serious abuse.
- [ ] Add offensive display name handling.
- [ ] Add malicious linking/claiming handling.

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

## 17. Backup, Export, and Recovery

- [ ] Add automated database backups.
- [ ] Add backup health checks.
- [ ] Add manual export for key data.
- [ ] Document restore process.
- [ ] Document rare improper-deletion restore process.
- [ ] Decide backup retention and encryption.
