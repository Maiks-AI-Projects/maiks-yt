# Project Build Roadmap

This is the working build plan for Maiks.yt V2. It should keep us honest: build a small vertical slice, test it in the dev environment, improve it, then move on.

The order can change when reality teaches us something, but changes should be intentional and written down.

## Working Rules

- Keep V1 real-money features out of the first public version.
- Prefer small commits that leave the dev server working.
- Keep `main` and `dev` in sync during early solo development.
- Use feature branches later when the site is live, in serious testing, or changes become risky.
- Every feature needs a build task and a test task.
- If a phase touches overlays, test through Cloudflare Tunnel and at OBS-like resolutions.
- If a phase touches data, add or update migrations before app code depends on it.
- If a phase touches user trust, privacy, payments, moderation, or public claims, write the policy/edge-case notes first.

## Current Foundation

Already built:

- TypeScript monorepo with `pnpm` and Turborepo.
- Apps for web, API, overlay, and control panel.
- Shared packages for config, domain, events, integrations, testing, themes, UI, and database.
- Drizzle + MariaDB database foundation.
- New V2 dev database on `mariadb-master`, separate from the old database.
- Dev server deployment on `codex-server-1`.
- Cloudflare Tunnel dev hostnames:
  - `web-dev.maiks.yt`
  - `api-dev.maiks.yt`
  - `overlay-dev.maiks.yt`
  - `control-dev.maiks.yt`
- API health checks:
  - `/health`
  - `/health/database`
- Six-hour rule violation automation.

## Current Milestone

Current phase: Phase 2, Core Data Model Draft.

Goal:

- Draft the first real schema for identity, roles, projects, streams, overlays, actions, and replay sessions.
- Keep the migration reviewable before applying it.
- Add enough seed data to prove the next overlay/control-panel work.

Next after that:

- Phase 3, Identity, Roles, and Privacy Foundation.

## Phase 0: Roadmap and Scope Gate

Build:

- Finalize version-one scope.
- Keep this roadmap as the main build order.
- Keep `TODO.md` as the detailed task inventory.
- Add a short "current milestone" section when we start a phase.

Test:

- Confirm the roadmap matches `version-one-scope-draft.md`.
- Confirm every phase has at least one verification step.

Done when:

- Version-one scope is approved enough to build against. Complete.
- The next phase is obvious without needing to reread every idea card. Complete.

## Phase 1: Developer Safety and Rule Monitoring

Build:

- Improve the architecture/rule checker so it can write `reports/rule-violations.md`.
- Decide which rules are warnings and which rules block commits.
- Add checks for file naming, package boundaries, accidental generated files, and missing roadmap updates for new major features.
- Add a manual script for "start of session review."

Test:

- Run the checker locally.
- Let the six-hour automation run and inspect the output.
- Verify reports do not expose secrets.

Done when:

- A fresh session can start by reading one report and knowing whether the repo is healthy.

## Phase 2: Core Data Model Draft

Build:

- Draft schema files for users, linked accounts, roles, projects, milestones, overlay events, stream sessions, action items, and replay sessions.
- Keep this as a draft migration until reviewed.
- Add domain types/rules beside the schema where useful.
- Add seed data for local/dev testing.

Test:

- Generate Drizzle migrations.
- Review migration SQL before applying.
- Apply to the V2 dev database only.
- Add basic domain tests for key invariants, such as "cannot remove the last login method."

Done when:

- The database has the minimum tables needed for identity, projects, overlays, and simulator work.
- We can seed a fake creator profile, fake project, fake stream session, and fake overlay state.

## Phase 3: Identity, Roles, and Privacy Foundation

Build:

- Implement OAuth sign-in.
- Support multiple linked accounts.
- Add `Allow login` per linked account.
- Prevent disabling/unlinking the last login method.
- Add roles and permissions.
- Add profile privacy defaults.
- Add account deletion/anonymization design and initial implementation.
- Add scoped URL token gates for non-public surfaces.

Test:

- Sign in with a test provider/account.
- Link and unlink accounts.
- Try to remove the last login method and confirm it is blocked.
- Verify private profiles do not leak public data.
- Verify deletion anonymizes user-identifying records without deleting ledger-like records.
- Verify control/admin URLs require token plus login once privileged features exist.

Done when:

- Users can safely sign in, manage linked accounts, and have a private-by-default profile.

## Phase 4: Stream Simulator and Event Replayer

Build:

- Define typed fake events for chat, notifications, raids, stream goals, and control actions.
- Build a local event generator in `packages/testing`.
- Add event storm presets.
- Add replay session records and replay fixtures.
- Build basic replay controls in the control panel.

Test:

- Replay a normal stream event sequence.
- Replay an event storm.
- Confirm sensitive data is stripped from saved replay fixtures.
- Confirm overlay and control panel use the same event contracts.

Done when:

- We can test overlays/control panel without going live on Twitch or YouTube.

## Phase 5: Realtime Transport Spike

Build:

- Create a transport abstraction around typed events.
- Implement a minimal WebSocket transport.
- Implement a minimal SSE transport if WebSocket behavior is uncertain.
- Add heartbeat, reconnect, snapshot, and catch-up concepts.
- Add a small API endpoint for current overlay state.

Test:

- Test WebSocket through Cloudflare Tunnel.
- Test SSE through Cloudflare Tunnel.
- Test reconnect behavior.
- Test initial snapshot after page load.
- Test from OBS or an OBS-like browser source if practical.

Done when:

- We choose the first realtime transport based on evidence, while keeping the abstraction flexible.

## Phase 6: Overlay Renderer V1

Build:

- Build the OBS browser-source overlay page.
- Support URL parameters for scene, layout, theme, and mode.
- Load initial state snapshot on page load.
- Connect to live state updates.
- Add last-known-good state.
- Add static/minimal fallback mode for connection loss.
- Add top notification and center notification zones.
- Inspect V1 top notification design at `A:\laravel-projects\maiks-yt` before finalizing visuals.

Test:

- Test overlay through `overlay-dev.maiks.yt`.
- Test common OBS canvas sizes.
- Test scene/layout/theme parameters.
- Test disconnect/reconnect.
- Test blank-start behavior after page load.
- Test notification queue behavior with event storms.

Done when:

- The overlay can run in OBS and survive normal reload/reconnect situations without looking broken.

## Phase 7: Overlay Control Panel V1

Build:

- Build the authenticated control panel surface.
- Show connected overlays and current state.
- Add test notification controls.
- Add event replay controls.
- Add layout/theme switching.
- Add emergency clean mode.
- Add placeholders for chat visibility, sponsor visibility, and AI mute.
- Keep default controls low-distraction.

Test:

- Use the control panel through `control-dev.maiks.yt`.
- Trigger test notifications and replay fixtures.
- Switch layout/theme and verify overlay updates.
- Use emergency clean mode and verify overlay clears quickly.
- Test basic mobile usability for emergency controls.

Done when:

- A stream can be controlled from the panel without editing OBS/browser-source URLs live.

## Phase 8: Themes and Layouts

Build:

- Define the CSS theme contract.
- Create the default theme.
- Create the first game/hobby theme.
- Define reusable layout slots.
- Add camera position slots.
- Add safe areas for chat, sponsor spots, and notifications.

Test:

- Test at OBS canvas sizes.
- Verify no slot overlaps with chat, sponsor spots, camera, or important notification areas.
- Verify theme switching only changes CSS/theme data, not app logic.

Done when:

- Themes and layouts can change stream identity without code changes.

## Phase 9: Projects and Milestones V1

Build:

- Build project list and project detail pages.
- Support project categories.
- Support non-monetary milestones.
- Support project updates.
- Link stream sessions to projects.
- Add active project/stream focus.
- Add internal wishlist entries linked to project items, without external store integration yet.

Test:

- Create projects and milestones from seed/admin data.
- Display public project pages.
- Mark a project as stream focus and show it on overlay/control panel.
- Verify no real money flow exists yet.

Done when:

- Projects can represent work, goals, and milestones before donations exist.

## Phase 10: Creator Hub, Content, and Schedule

Build:

- Build self-owned links hub.
- Add editable social/support/community links.
- Add public schedule.
- Add admin schedule page.
- Add cancellation flow.
- Add basic blog/update model.
- Add RSS feed.
- Add public personal context and accountability pages.
- Add affiliate pages with clear income-source disclosure.

Test:

- Publish a schedule entry.
- Cancel a stream with a reason.
- Publish a basic update post.
- Verify RSS output.
- Verify public pages are readable without sign-in.

Done when:

- The site can act as the public home base even before complex integrations.

## Phase 11: Chat and Stream Bot V1

Build:

- Connect fake/local chat source first.
- Normalize chat messages.
- Tag messages as human, bot, system, or moderator tool.
- Hide bot/system messages from overlay by default.
- Add basic stream bot command parser.
- Add commands for website links.
- Add periodic messages.
- Add manual chat hide/show and emergency shutdown.

Test:

- Replay chat fixtures.
- Trigger bot commands and verify they do not clog overlay chat.
- Test chat hide/show under event storm.

Done when:

- Chat can be shown, hidden, and filtered in a stream-safe way.

## Phase 12: AI Stream Assistant Foundation

Build:

- Define public speech, private-message audio, and control-panel text modes.
- Add editable start instructions and provider settings.
- Add mute/off controls.
- Add optional draft/shadow mode.
- Add selected chat summary/readout behavior.
- Add paid-message readout behavior.
- Add private-message public announcement and private preamble behavior.
- Add optional stream-end wellness checkpoint.

Test:

- Test with fake chat and fake private messages.
- Confirm private-message mode clearly warns the streamer before private content.
- Confirm no private speech occurs except for private viewer messages.
- Confirm interruption avoidance with the selected AI provider.
- Confirm mute/off controls work instantly.

Done when:

- The AI can assist without creating privacy or energy-pressure problems.

## Phase 13: Action Panel and Moderation

Build:

- Build action item model.
- Build approval inbox.
- Sort by urgency, stream relevance, and category.
- Separate live-safe actions from off-stream admin tasks.
- Add approve/reject/defer behavior.
- Add roles-aware permissions.
- Add warning/strike model.
- Add abuse policy page.
- Add offensive display name and malicious linking handling.

Test:

- Create action items from fake events.
- Approve/defer/reject actions.
- Verify mods can only do allowed actions.
- Verify strike escalation.
- Verify audit history records decisions.

Done when:

- Live stream decisions and off-stream admin work no longer mix into one distracting pile.

## Phase 14: Platform Integrations

Build:

- Link Discord.
- Prepare Discord role sync.
- Link Twitch and YouTube accounts.
- Prepare Twitch/YouTube scheduling sync.
- Prepare Patreon linking.
- Prepare gaming platform account linking for verified IGN selection.
- Add provider capability model.

Test:

- Link and unlink each provider in dev/test mode where possible.
- Verify account claiming/conflict rules.
- Verify provider failures do not break sign-in.
- Verify perks/ranks can be calculated but not over-trusted.

Done when:

- External platforms can enrich the community experience without owning the identity model.

## Phase 15: Money Reality Check

Build:

- Compare payment providers available in the Netherlands.
- Document refunds, partial refunds, chargebacks, recurring support, and fees.
- Decide whether credits are technically and legally realistic.
- Design multi-currency/value-source support.
- Decide whether to use double-entry bookkeeping.
- Draft donation/support terms.
- Draft refund/revocation wording.
- Draft affiliate/sponsor disclosure.

Test:

- Review provider constraints before implementing real money.
- Confirm wording is clear that support may have tax/legal consequences.
- Confirm restricted credits from Twitch/YouTube/etc. cannot be paid out.

Done when:

- We know whether and how real money can safely enter the platform.

## Phase 16: Later Money Features

Build:

- Immutable ledger.
- Direct donations.
- Credits and restricted credits.
- Stream goal auto-allocation.
- Claimable platform-derived support.
- Transparent money trail.
- Public withdrawals.
- Spending records.
- Project archives.
- Product price tracking.
- External wishlist provider integrations.

Test:

- Test ledger invariants.
- Test refund/revocation rules.
- Test project overflow rules.
- Test mutually exclusive project outcomes.
- Test price change approval workflow.
- Test anonymized donation records after account deletion.

Done when:

- Money is boring, traceable, auditable, and not a source of drama.

## Phase 17: Backup, Export, and Recovery

Build:

- Automated database backups.
- Backup health checks.
- Manual export for key data.
- Restore documentation.
- Rare improper-deletion restore process.
- Backup retention and encryption policy.

Test:

- Restore a backup into a separate database.
- Verify backup health alerts.
- Verify account deletion/anonymization behavior with backups documented.

Done when:

- The platform can be recovered without improvising under stress.

## Always-On Verification

Run often:

- `pnpm check`
- `pnpm build`
- API health checks
- `/health/database`
- public dev URL smoke checks
- architecture/rule checker
- migration SQL review before applying

Before calling a phase done:

- Code is committed.
- Dev server is deployed.
- Public dev URLs still return 200.
- Relevant feature tests pass.
- `TODO.md` and this roadmap are updated.
