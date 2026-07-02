# Foundation To Feature Stage Plan

Status: planning map only. This does not approve production work, secrets, provider credentials, real money, moderation enforcement, Cloudflare/Docker changes, or public AI behavior.

The dev foundation is now strong enough to stop adding generic scaffolding and start choosing feature lanes. Each lane below should be expanded into its own detailed stage plan before implementation. High-risk lanes stay gated until their earlier design, data, safety, and restore stages are complete.

## Global Stage Order

1. **Stabilize Dev**
   - Keep `dev` deployable and smoke-tested.
   - Resolve external blockers such as Cloudflare Worker injection before trusting browser smoke.
   - Keep local/test events resettable and clearly separated from real/provider data.

2. **Manual Admin First**
   - Build owner/admin pages that let Michael manage content and routing manually.
   - Prefer preview-before-publish.
   - Avoid automation, provider sync, AI publishing, and money behavior.

3. **User Control And Safety**
   - Add opt-outs, audit trails, review queues, cooldowns, and owner override controls.
   - Add moderator/trusted-helper boundaries before live moderation power.
   - Keep private/security/account/provider-token events internal-only.

4. **Provider And Realtime Intake**
   - Add provider integrations only after scopes, token storage, revocation, failure behavior, rate limits, and manual override are documented.
   - Start read-only or shadow-mode where possible.
   - Keep platform-specific events capability-gated.

5. **Money And Public Commitments**
   - Start only after legal/provider/ledger/refund/export decisions are approved.
   - Simulated/test-money remains separate from real money forever.
   - No donation/support promises until terms and audit behavior exist.

6. **Production Release Preparation**
   - Freeze feature work.
   - Verify backups/restores, fresh secrets, OAuth redirects, owner assignment, migration order, smoke surfaces, rollback points, and accepted risks.
   - Promote only reviewed dev commits.

## Page Creator And Route Admin

### Stage 1: Manual Admin Over Existing Persistence

- Build owner-gated page create/edit/list/publish controls using `content_pages`.
- Enforce reserved/code-owned route checks before saving or publishing.
- Add admin preview for drafts.
- Keep public catch-all routing disabled until validation is reviewed.

### Stage 2: Public Path Routing

- Add exact path-only public rendering on the primary website host.
- Publicly render only published/public records.
- Fail closed on ambiguity, reserved paths, invalid paths, or missing records.
- Add smoke tests for code-owned route precedence.

### Stage 3: Content Operations

- Add duplication, archive/unpublish, SEO preview, and simple revision/audit history.
- Add safe reusable content blocks only if they reduce real editing friction.
- Keep legal/money pages code-owned or separately reviewed until production wording is approved.

### Stage 4: Host/Subdomain Routing Later

- Design host plus path ownership.
- Review Cloudflare/DNS/reverse-proxy risks separately.
- Do not automate subdomain creation until infrastructure/security review.

## User Stream-Visibility Opt-Out UX

### Stage 1: Design And Copy

- Finalize signup/profile wording for stream-visible website activity.
- Confirm whether default is opt-in or opt-out per event family.
- Keep privacy/security/account/provider-token events internal-only and absent from overlay settings.

### Stage 2: Profile And Signup Settings

- Add user-facing controls for website signup, public username changes, profile image updates, and later free website TTS.
- Persist choices through `event_user_opt_outs`.
- Add account/settings copy explaining that stream visibility can be changed later.

### Stage 3: Dispatch Enforcement

- Enforce opt-out at dispatch time, not from stale cache.
- Add API/domain tests for blocked opt-out outcomes.
- Confirm stream-visible website events fail closed when user identity is missing.

### Stage 4: Promotional Event Tuning

- Add once-per-stream or once-per-hour limits.
- Add approval defaults for profile image and free TTS.
- Add event-routing admin presets for safe website promotion.

## Event Routing, Test Console, And Overlay Playback

### Stage 1: Dev-Test Dispatch Done

- Safe simulated dispatch and resettable event history exist on dev.
- No public playback is emitted yet.

### Stage 2: Review Queue And Approval Workflow

- Add owner/admin approval controls for queued simulated events.
- Keep approval actions separate from playback.
- Add clear audit history for approve/reject/defer decisions.

### Stage 3: Controlled Playback To Existing Overlay Zones

- Route approved/test events to top or center notifications.
- Keep real providers disabled.
- Add visual smoke for overlay rendering and cooldown behavior.

### Stage 4: Production-Safe Routing Defaults

- Add safe default rules and explicit disabled states for production.
- Keep internal-only events impossible to route publicly.
- Keep all provider and real-money routes disabled until their gates open.

## Real Chat And Provider Intake

### Stage 1: Provider Gate Inventory

- Define scopes for Twitch, YouTube, Discord, and any future music/game providers.
- Decide token storage, refresh, revocation, rate limits, error handling, reconnect behavior, and manual override.
- Document what each provider can and cannot emit. For example, Discord and YouTube cannot emit Twitch bits.

### Stage 2: Read-Only Shadow Intake

- Connect one provider at a time in dev.
- Store minimal redacted intake history or live-only shadow output.
- Do not show messages on overlay by default.
- Add clear disconnected/degraded states.

### Stage 3: Unified Streamer Chat

- Merge fake/local and real provider chat into the private streamer chat view.
- Keep overlay eligibility separate from streamer visibility.
- Add source labels, order controls, and safe filters.

### Stage 4: Overlay Chat Eligibility

- Add explicit routing/filter rules for which chat can appear on stream.
- Keep bot/system/provider-service messages hidden by default.
- Add emergency hide/shutdown controls.

## Moderator Management, Trust Levels, And Moderation

### Stage 1: Management Model

- Define roles, trust levels, temporary grants, and allowed surfaces.
- Separate owner, trusted helper, moderator, and viewer privileges.
- Define audit requirements before any enforcement exists.

### Stage 2: Admin Page

- Add owner-gated moderator/trust management.
- Support temporary grants, notes, and revoke flow.
- Keep all changes audited.

### Stage 3: Read-Only Moderation Context

- Show user history, trust status, recent actions, and linked-account context.
- Do not apply provider bans/mutes yet.
- Add private streamer-only visibility.

### Stage 4: Manual Moderation Actions

- Add warnings, hide-from-overlay, website mute, and website ban before provider enforcement.
- Add appeal/review expectations.
- Keep platform actions behind adapter capability checks.

### Stage 5: Provider Moderation Later

- Add Twitch/YouTube/Discord moderation adapters only after provider gates.
- Track partial success/failure per platform.
- Keep streamer override and audit trail mandatory.

## Money, Donations, Support, Ledger, And Credits

### Stage 1: Reality Check

- Compare payment/support providers available in the Netherlands.
- Decide donation/support terms, refunds, chargebacks, taxes, payout timing, and platform constraints.
- Keep support links unavailable until wording and destination are approved.

### Stage 2: Ledger Design

- Design immutable money/value events before accepting real money.
- Include donations, refunds, chargebacks, credits, restricted credits, revocations, reallocations, and anonymization behavior.
- Define export/audit requirements.

### Stage 3: Simulated Money Test Harness

- Continue using test/simulated money only.
- Add reset tools for simulated records.
- Verify UI and transparency flows without real providers.

### Stage 4: Real Provider Integration

- Add one provider at a time after terms, ledger, backup/export, and owner approval.
- Keep payments separate from stream notifications until routing/approval is safe.
- Add failure/reconciliation workflows.

### Stage 5: Public Support Features

- Add donations/support/project funding only after ledger and provider smoke.
- Add transparent public/user money trail.
- Add refund/revocation flow only with clear policy.

## Backup, Restore, Export, And Recovery

### Stage 1: Runbook

- Inventory data and non-secret config that must be backed up or reconstructable.
- Define dev/staging restore test steps.
- Define retention, encryption, storage, access, and owner responsibilities.

### Stage 2: Manual Dev Restore Test

- Take a dev/staging backup.
- Restore into a separate database.
- Verify application reads and smoke surfaces.
- Do not touch production data.

### Stage 3: Automated Dev Backups

- Add health checks and alert ownership.
- Keep credentials/secrets out of repo.
- Test backup failure states.

### Stage 4: Production Backup Gate

- Approve retention, encryption, restore owner, storage location, and restore verification schedule.
- Verify restore before applying production migrations or accepting real money/provider data.

### Stage 5: Export And Account Recovery

- Add owner/admin export tools for key records.
- Define account deletion/anonymization behavior across backups.
- Treat backup restores as disaster/admin-mistake recovery, not public undo.

## AI Stream Assistant

### Stage 1: Private Shadow Mode

- Add local/control-panel-only settings and shadow transcript.
- No public speech, posting, paid-message readout, or moderation-like decisions.
- Include obvious mute/off controls.

### Stage 2: Prompt And Boundary Review

- Define allowed inputs, private context, forbidden actions, no-nagging behavior, and low-energy mode.
- Keep provider secrets out of repo.
- Add audit/replay for prompts and outputs where safe.

### Stage 3: Streamer-Only Assistance

- Summarize chat privately.
- Draft responses or reminders for Michael only.
- Add interruption avoidance.

### Stage 4: Public Output Later

- Only after shadow-mode review.
- Require manual approval or hard mute controls.
- Never let AI make autonomous moderation or money decisions in the first public stage.

## Production Auth, Secrets, And Release

### Stage 1: Production Ownership Design

- Define explicit owner assignment.
- Confirm no first-login auto-promotion.
- Define account recovery expectations.

### Stage 2: Fresh Production Secrets

- Create fresh OAuth apps/keys and production token gates.
- Rotate anything touched during dev/Cloudflare incident investigation.
- Keep secrets out of repo and docs.

### Stage 3: Release Candidate

- Freeze features.
- Pick `dev` commit or release branch.
- Inventory migrations and dev-only exclusions.
- Verify backup restore.

### Stage 4: Production Smoke And Rollback

- Define smoke surfaces.
- Define rollback image/reference.
- Record accepted risks.
- Do not open money/provider/public-AI/moderation gates during first production release.

## Game Library And Play Schedule

### Stage 1: Manual Game Library

- Add owner/admin game records with platform/store, ownership/access status, interest status, stream-fit notes, content warnings, and visibility.
- Keep suggestions and gifts out of the first slice.

### Stage 2: Public Curated Game Pages

- Show currently playing, planned soon, maybe later, and completed on stream.
- Keep owner notes private unless explicitly public.

### Stage 3: Suggestions Review Queue

- Add viewer suggestions as pending/private records.
- Add review status, duplicate handling, moderator notes, and rejection reasons.
- Do not publish suggestions automatically.

### Stage 4: Schedule Linking

- Link stream schedule entries to game records.
- Avoid provider category sync until provider gates.

### Stage 5: Gifted Games Later

- Treat gifted games as value-bearing/money-adjacent.
- Require wording that gifts do not guarantee streams.
- Review privacy, public attribution, platform terms, and decline flow before implementation.

## Suggested Next Detailed Plans

1. Page Creator runtime admin, because persistence already exists and it is manual/non-provider.
2. Backup/restore runbook, because production and money/provider phases depend on it.
3. User stream-visibility opt-out UX, because website promotional events should not advance without user control.
4. Moderator management/trust levels design, because it unlocks future helper workflows without provider enforcement.
5. Provider gate inventory, because real chat and scheduling sync depend on it.
