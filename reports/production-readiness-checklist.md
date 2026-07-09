# Production Readiness / Dev-to-Prod Release Plan

Status: design-only Phase F1 release gate. Production is not ready.

Updated: 2026-07-09

This checklist is the planning artifact for moving from the current `dev` foundation toward real users, money/accounting, moderation, provider integrations, and a future production/main release. It does not approve deployment, branch changes, production secrets, Cloudflare/Docker/deployment edits, production migrations, server changes, or runtime implementation.

## Status Legend

- Done: design or dev behavior exists and has been reviewed or smoked on `dev`.
- Partial: useful dev behavior exists, but production readiness is incomplete.
- Blocked: Michael or a release owner must decide, approve, or perform a separate operational step.
- Risky: a capability could harm users, money, provider accounts, privacy, or production stability if opened too early.
- Next: concrete next planning or release-preparation action.

## Current Readiness Snapshot

- Done: `dev` is the active integration branch and the project has repeatable reviewer/coordinator habits, dev smoke scripts, owner-gated admin surfaces, and tracker docs.
- Done: read-only/provider-intake foundations exist on dev for Twitch, YouTube, and Discord, including sanitized admin status, selected YouTube channel identity, provider intake ledger visibility, webhook/PubSub/EventSub receiver plumbing, and provider intake health summaries.
- Done: local/fake and Maiks.yt-local moderation foundations exist on dev with audit/current-state separation and permission-gated `/moderation` controls.
- Done: private notifications and Web Push are available on dev, and recurring dev smoke can create warning/critical notifications.
- Partial: auth/session/admin behavior exists for dev, but production owner assignment, fresh production OAuth apps, recovery expectations, and no-first-login promotion proof are still release blockers.
- Partial: provider OAuth/token storage exists for dev YouTube and provider receiver secrets exist on dev, but production credential storage, rotation, revocation, scope signoff, and failure ownership are not approved.
- Partial: backup planning exists, but restore proof, retention, encryption, storage target, health checks, and restore ownership are not approved.
- Blocked: money/accounting is planning-only. Real payment intake, provider support events becoming ledger rows, public support flows, refunds, chargebacks, credits, and exports need a separate money phase.
- Blocked: production cutover is not approved until Michael accepts the open decisions and a release owner records the signoff items below.

## Stage 0: Keep Dev Honest

- Done: keep all worker changes on reviewable worktrees or `dev`; do not deploy from unreviewed worker branches.
- Done: keep risky public behavior behind explicit gates: provider writes, real money, public AI, destructive moderation, production auth/secrets, account deletion/privacy erasure, and backup automation.
- Partial: recurring dev smoke covers core dev surfaces and notifications, but production smoke must be separately defined and run against production-like credentials and data.
- Next: keep `reports/current-work.md`, `reports/next-agent-tasks.md`, and this checklist updated whenever a gate moves from blocked to partial or partial to done.

## Stage 1: Release Candidate Policy

- Blocked: choose the exact branch policy before release preparation begins.
- Option A: promote one reviewed `dev` commit to `main` after final review.
- Option B: create a short-lived `release/<date-or-version>` branch from reviewed `dev`, apply only blocker fixes there, then merge to `main`.
- Required: record the release candidate commit SHA, source branch, target branch, target hostnames, release owner, and rollback reference.
- Required: freeze feature work during release preparation except reviewed blocker fixes.
- Required: do not create production branches or release tags from worker threads.

## Stage 2: Review and PR Gate

- Required: release candidate has a coordinator/reviewer pass, not only worker self-review.
- Required: every production-bound change has a narrow summary of behavior, migrations, config needs, and risks.
- Required: no unresolved worker-local diffs, generated artifacts, ignored local token files, or dev-only notes are accidentally included.
- Required: any accepted risk is written down with Michael's explicit approval.
- Blocked: decide whether the final release review happens as a PR into `main`, a release branch PR, or a direct coordinator merge from reviewed `dev`.

## Stage 3: Build and Test Gate

- Required before release candidate signoff:
  - `pnpm check:review`
  - `pnpm check:full` for high-risk release candidates or cross-package changes
  - `node scripts/check-architecture.mjs`
  - `git diff --check`
- Required production smoke surfaces:
  - public website: `/`, `/links`, `/projects`, project detail, `/schedule`, privacy/accountability pages, and any published Page Creator records
  - API: health/root, public projects, public schedule, creator links, provider-intake health shape if enabled, and realtime status
  - auth: OAuth sign-in, signed-in account view, owner role resolution, forbidden non-owner state, and logout/session expiry
  - admin: projects, project updates, creator links, schedule, action panel, tokens, provider status, connections/intake, moderators, notifications, and Page Creator
  - stream tools: `/tools/actions`, `/tools/notifications`, control token gate, overlay token gate, scene designer, overlay ready/status, `/chat`, and `/moderation`
  - provider receivers: fail-closed unsigned/invalid requests and safe challenge/verification paths where applicable
  - database: migration status, production seed separation, critical read/write paths, and no dev-only reset path exposure
- Partial: dev smoke covers many of these surfaces; production smoke still needs release-owner execution with production-safe tokens and hostnames.

## Stage 4: Production Auth, Owner, and Admin Security Gate

- Blocked: production owner assignment must be explicit. The first production login must never become owner/admin automatically.
- Required: assign Michael's production owner account through a reviewed admin or one-time release process that records who did it and what account/provider identity was linked.
- Required: disable or prove unreachable all dev owner claim paths, including `DEV_OWNER_EMAILS` behavior and `POST /dev/testing/owner-token`.
- Required: create fresh production OAuth apps/keys for approved login providers; do not copy dev app secrets.
- Required: verify exact production redirect URLs and callback hostnames before allowing login.
- Required: keep Maiks.yt domain identity separate from auth-provider tables; OAuth provider email matching is not enough for ownership.
- Required: session/admin hardening signoff:
  - secure cookies and production session settings
  - privileged pages require signed-in role checks after any URL token gate
  - owner/mod/admin permissions are explicit capabilities, not display labels
  - admin token listing/create/rotate/revoke stays owner-gated
  - audit trails exist for sensitive grants, moderation actions, provider credential changes, and future money actions
- Blocked: define production account recovery expectations before first real users.

## Stage 5: Fresh Production Secrets and Provider App Gate

- Blocked: production secrets and OAuth apps must be created fresh by the release/operations owner.
- Required: separate dev and production values for database credentials, app/session secrets, URL tokens, Web Push VAPID keys, notification post secret, OAuth client secrets, provider webhook secrets, Discord public key/application credentials, Twitch EventSub secret/client credentials, YouTube OAuth/PubSub callback configuration, and any future money provider secrets.
- Required: record a non-secret rotation runbook: owner, location, rotation steps, post-rotation smoke, and rollback.
- Required: rotate anything touched during public dev tunnel or Cloudflare-injection investigations before production launch.
- Required: production provider scopes must be least-privilege and documented by capability: read-only intake, provider write/moderation, announcements, money/support, account linking, and token revocation.
- Risky: provider token storage and receiver secrets are usable on dev, but production vault/encryption/rotation/incident behavior is not approved.

## Stage 6: Migration and Data Gate

- Required: inventory every dev-applied migration since the production baseline in exact order.
- Required: classify each migration as production-required, dev-only, obsolete, or blocked.
- Required: take a production backup and verify restore before applying any production schema change.
- Required: apply schema migrations before deploying app code that requires the new schema, unless the migration is explicitly backward-compatible and the release owner chooses another order.
- Required: stop at the first failed migration or smoke check and choose rollback or fix-forward explicitly.
- Required: never generate or apply production migrations from worker planning tasks.
- Next: create a release-specific migration order document during release preparation, including rollback/fix-forward notes for each schema change.

## Stage 7: Backup, Restore, and Export Gate

- Blocked: production backup automation is closed until retention, encryption, target storage, health checks, alert ownership, and restore testing are approved.
- Required before production launch:
  - backup frequency
  - backup storage target
  - encryption decision
  - retention period
  - restore owner
  - backup health alert destination
  - restore drill using dev/staging-like data
  - documented manual export shape for critical data
- Required: backups are for disaster recovery and rare improper-deletion recovery, not a public undo promise.
- Required: account deletion/privacy erasure must document how older backups naturally age out deleted data.
- Next: write a backup inventory and restore runbook using dev/staging data only before any production backup automation.

## Stage 8: Notification and Monitoring Gate

- Partial: private notifications, Web Push delivery, warning/critical notification rows, recurring dev smoke, and provider reconnect-suppression notifications exist on dev.
- Required: production notification failure reporting must identify who receives alerts, which failures page/push, and which failures stay in logs only.
- Required: production smoke should alert on broken core surfaces, failed provider receiver signatures/challenges, backup failures, repeated notification delivery failures, and security-relevant auth/session issues.
- Required: healthy checks should remain quiet; recovery-after-failure can notify once.
- Risky: missing/stale provider intake mechanisms should not automatically page unless Michael decides the mechanism is production-critical.

## Stage 9: Dev-Only Exclusions

Keep these out of production unless separately approved:

- `/dev/test-console`, `/dev/event-routing/dispatch`, `/dev/notifications`, `POST /dev/testing/owner-token`, dev smoke mint secrets, and any dev reset tools.
- `DEV_OWNER_EMAILS`, dev owner claim paths, dev databases, dev seeds, ignored usable-token reports, and test URL tokens.
- fake/local chat verification harnesses as user-facing truth.
- simulated money/test-money events, resettable histories, and preview-only event routing shortcuts.
- dev provider credentials, dev OAuth apps, dev webhook URLs, dev Discord/Twitch/YouTube app settings, and dev Cloudflare/tunnel assumptions.
- local-only smoke artifacts, screenshots, and temporary unpublished smoke content.

## Stage 10: Dangerous Gates That Stay Closed

- Real payment intake: closed until payment provider, legal/refund/chargeback handling, immutable ledger design, dated fee/split rules, corrections, exports, and private accounting reports are approved.
- Provider write actions: closed until provider-specific scopes, permissions, audit logs, rate limits, failure behavior, manual override, and rollback/revocation are approved.
- Destructive moderation: closed until policy versions, strike/restriction records, appeals/review expectations, streamer override, audit review, and provider-specific failure handling are approved.
- Public AI: closed until private shadow mode, prompt/data boundaries, paid-message rules, mute/off controls, safety review, and explicit public output approval exist.
- Production auth/secrets: closed until fresh production secrets/OAuth apps, explicit owner assignment, no-first-login-promotion proof, and session/admin security signoff are complete.
- Backup automation: closed until retention, encryption, restore proof, health alerts, and owner responsibilities are approved.
- Account deletion/privacy erasure: closed until live anonymization/deletion semantics, audit retention, ledger continuity, backup aging, recovery exceptions, and user-facing wording are approved.

## Production Cutover Checklist

- Blocked: Michael chooses release branch policy and release owner.
- Blocked: operations owner confirms fresh production secrets/OAuth apps and provider app configuration.
- Blocked: explicit owner assignment process is ready and first-login auto-promotion is disabled/proven impossible.
- Blocked: backup restore drill is complete and documented.
- Blocked: migration order is documented with required/blocked/dev-only classification.
- Blocked: production smoke plan is written with tokens/hostnames available to the release owner.
- Blocked: rollback reference is recorded: previous image/commit, database rollback/fix-forward stance, DNS/tunnel rollback steps, and decision owner.
- Blocked: Michael accepts unresolved risks in writing.
- Next: after all blockers are cleared, run release checks, apply migrations in order, deploy the production candidate, run smoke, and either launch, rollback, or fix forward with the release owner present.

## Michael-Facing Open Decisions

- Choose branch policy: promote reviewed `dev` to `main`, or use a short-lived release branch.
- Name the release owner and operations owner.
- Confirm the production owner account identity and how it will be assigned.
- Choose first production OAuth providers; likely start with the smallest set needed for owner/admin access.
- Choose backup frequency, retention, encryption, storage target, and restore owner.
- Decide whether production provider intake launches read-only, and which mechanisms are critical enough to alert.
- Decide whether money/accounting work starts before public support/payment buttons.
- Decide whether account deletion/privacy erasure must be implemented before general user signup.
- Decide which unresolved risks, if any, are acceptable for a first limited production launch.

## Release Signoff Record Template

- release candidate commit SHA:
- source branch:
- target branch:
- deployment target:
- release owner:
- operations owner:
- product safety owner:
- explicit owner account assigned:
- production OAuth apps created:
- production secrets created/rotated:
- migration list and applied order:
- backup restore verification date:
- production smoke surfaces checked:
- notification/monitoring owner:
- rollback reference:
- unresolved risks accepted by Michael:
