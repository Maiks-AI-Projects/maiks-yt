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
- [ ] Review and finalize version one scope draft.
- [x] Decide when to initialize git.
- [x] Make the first git commit a planning baseline.
- [x] Use direct small commits on `main` during early solo development.
- [ ] Start using branches once live, in serious testing, or making risky/long-running changes.

## 2. Technical Foundation

- [ ] Choose monorepo tooling.
- [ ] Choose web framework.
- [ ] Choose database approach.
- [ ] Confirm local MySQL direction.
- [ ] Choose validation/type contract library.
- [ ] Decide API/realtime backend shape.
- [ ] Decide whether overlay/control panel use Vite + React.
- [ ] Decide how real-time overlay state will work.
- [ ] Decide local production hosting shape for `cloudflared`.
- [ ] Decide dev server auto-build/deploy workflow after pushed commits.
- [ ] Use `dev` branch as the dev-server auto-deploy target.
- [ ] Define fixed local port plan.
- [ ] Decide whether to use separate hostnames or one local reverse proxy.
- [ ] Create a realtime transport abstraction before choosing WebSocket or SSE.
- [ ] Run an early `cloudflared` tunnel spike for WebSocket and SSE.
- [ ] Decide local development strategy for fake events.
- [ ] Decide stream simulator/event replayer shape.
- [ ] Add localization structure from the start.
- [ ] Add minimal analytics/security logging boundaries.
- [ ] Add initial architecture/file-boundary rule checker.
- [ ] Add rule violation report workflow for next-session review.
- [ ] Decide whether rule violations warn or block commits during early development.

## 3. Core Data Model Draft

- [ ] Draft user/account model.
- [ ] Draft linked account/provider model.
- [ ] Draft roles and permissions model.
- [ ] Draft project/item/milestone model.
- [ ] Draft project category model.
- [ ] Draft overlay event model.
- [ ] Draft theme contract.
- [ ] Draft stream schedule/session model.
- [ ] Draft action panel item model.
- [ ] Draft event replay/session recording model.
- [ ] Draft multi-currency/value-source model.

## 4. Identity and Privacy

- [ ] Implement OAuth sign-in.
- [ ] Support multiple linked accounts.
- [ ] Add `Allow login` toggle per linked account.
- [ ] Prevent disabling/unlinking the last login method.
- [ ] Add first-sign-in privacy choice.
- [ ] Add account deletion/anonymization design.
- [ ] Add provider capability model, such as login, perks, IGN verification, avatar, support claiming.
- [ ] Add identity conflict rules for claiming linked accounts.
- [ ] Add scoped URL token gates for non-public surfaces.
- [ ] Require login after URL token for privileged control/admin pages.

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

- [ ] Build fake typed event generator.
- [ ] Add event storm presets.
- [ ] Add event replay controls.
- [ ] Support recording/replaying local stream sessions.
- [ ] Strip sensitive data from recorded replay fixtures.
- [ ] Use simulator events for overlay and control panel testing.

## 6. Overlay Renderer

- [ ] Build basic OBS browser-source overlay page.
- [ ] Support URL parameters for scene/layout/theme/mode.
- [ ] Load initial state snapshot on page load.
- [ ] Connect to live state updates after loading.
- [ ] Create typed notification events.
- [ ] Build notification queue before display rendering.
- [ ] Add top notification zone.
- [ ] Add center notification zone.
- [ ] Inspect V1 top notification design at `A:\laravel-projects\maiks-yt` before implementing final top notification visuals.
- [ ] Add active project/goal progress widget.
- [ ] Add last-known-good overlay state.
- [ ] Add static/minimal fallback mode for connection loss.
- [ ] Test OBS scene switching behavior.
- [ ] Decide whether preloaded overlays are required.

## 7. Overlay Control Panel

- [ ] Build authenticated control panel page.
- [ ] Show connected overlays and current state.
- [ ] Add local event generator/replayer controls.
- [ ] Add test notification controls.
- [ ] Add layout/theme switching.
- [ ] Add emergency clean mode.
- [ ] Add chat visibility toggle placeholder.
- [ ] Add AI mute placeholder.
- [ ] Add sponsor visibility placeholder.
- [ ] Make critical controls usable on mobile.
- [ ] Keep default control panel low-distraction.
- [ ] Prepare optional advanced/product mode foundation.

## 8. Themes and Layouts

- [ ] Define CSS theme contract.
- [ ] Create default theme.
- [ ] Create first game/hobby theme.
- [ ] Create reusable layout slots.
- [ ] Add camera position slots.
- [ ] Ensure chat, camera, sponsor slots, and notifications do not overlap.
- [ ] Test overlay layout at OBS canvas sizes.

## 9. Creator Hub and Content

- [ ] Build self-owned links hub.
- [ ] Add social/support/community links.
- [ ] Add RSS feed for blog posts.
- [ ] Add basic blog/update post model.
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
