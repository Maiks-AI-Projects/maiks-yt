# Production Readiness / Dev-to-Main Checklist

Status: design-only release gate, not an active deployment plan.

This checklist defines what must be true before `dev` can be promoted toward a future production or `main` release. It does not approve production deployment, generate migrations, edit Cloudflare/Docker/deployment configuration, rotate secrets, touch server state, or start risky feature phases.

## Branch and Release Boundary

- Choose the exact release branch policy before work starts: either promote a reviewed `dev` commit to `main`, or create a short-lived `release/<date-or-version>` branch from reviewed `dev` and merge it to `main` after final checks.
- Freeze feature work during release preparation except for reviewed blocker fixes.
- Record the release candidate commit SHA from `dev`, the target production branch, and the owner of the release decision.
- Keep dev hostnames and dev database data separate from production hostnames and production database data.
- Do not deploy from unreviewed worker branches.

## Explicit Owners

- Assign a human release owner before production preparation begins.
- Assign a production operations owner for backup/restore, secrets, rollback, and smoke-test signoff.
- Assign a product safety owner for public AI, moderation, provider integrations, and money gates.
- Assign the production owner account explicitly through a reviewed admin process.
- Do not auto-promote the first production login to owner or admin.
- Do not treat OAuth provider email matching as enough for production ownership.

## Fresh Secrets and OAuth

- Create fresh production secrets near release preparation, not by copying dev secrets.
- Create fresh production OAuth apps/keys for approved login providers.
- Rotate any credentials touched during public dev tunnel investigation before production launch.
- Verify production OAuth redirect URLs for `maiks.yt` and any privileged surfaces.
- Keep production token gates separate from dev token gates for overlay and control surfaces.
- Document who can rotate production secrets and where the non-secret rotation runbook lives.
- Do not edit secrets, `.env` files, Cloudflare config, Docker config, or deployment scripts as part of this checklist.

## Production Auth Gate

- Confirm Better Auth remains the selected production OAuth provider or record a replacement decision before release work starts.
- Verify the Maiks.yt domain identity model remains separate from provider-owned auth tables.
- Confirm account recovery expectations before production launch.
- Confirm privileged pages require authenticated role checks after any URL token gate.
- Confirm dev-only owner claim behavior is disabled or unreachable in production.
- Confirm no route depends on first-login auto-promotion.

## Migration Order

- Inventory all migrations applied on dev since the last production baseline.
- Confirm each migration has been reviewed and is required for production-visible behavior.
- Take and verify a restorable production backup before applying any schema change.
- Apply schema migrations before deploying app code that requires the new schema.
- Run the narrow smoke checks that prove old data still reads and new production-visible paths work.
- Stop at the first failed migration or smoke check and choose rollback or fix-forward explicitly.
- Never generate or apply production migrations from a worker planning task.

## Backup and Restore Basics

- Define backup frequency, retention, encryption, storage target, and restore owner before production launch.
- Verify a restore using dev/staging-like data before claiming production readiness.
- Keep backups for disaster recovery and rare improper-deletion recovery, not as a user-facing undo promise.
- Document manual export requirements for key data before money/provider phases.
- Add backup health checks and alert ownership before production depends on automated backups.
- Confirm critical non-secret configuration can be reconstructed from documented sources.

## Smoke Surfaces

- Public website: `/`, `/links`, `/projects`, project detail pages, `/schedule`, and public privacy/accountability pages.
- API: health or root route, public projects, public schedule, public creator links, and realtime status where applicable.
- Auth: OAuth sign-in, signed-in session display, owner role resolution, forbidden state for non-owner users, and account recovery expectations.
- Admin: project admin, project update draft/publish flow, creator link admin, schedule admin, action panel, and admin token management.
- Stream tools: `/tools/actions`, control panel token gate, overlay token gate, scene designer, overlay ready/status, fake/local chat harness, and streamer chat viewer.
- PWA/installability: manifest responses and the standalone tool surfaces that are intended for stream use.
- Database: migration status, seed/dev-only data separation, and read/write checks for production-owned tables.

## Rollback Decision Points

- Before secrets are switched: abort release preparation if production credentials, redirect URLs, or owner assignment are incomplete.
- Before migrations: abort if backup restore has not been verified or migration order is unclear.
- After migrations but before app swap: rollback database only if the migration plan explicitly supports it; otherwise fix forward with the release owner present.
- After app swap: rollback to the previous successful image if public website/API/auth/stream-tool smoke fails.
- After DNS/tunnel/route changes: rollback routing if production hostnames do not reach the intended surfaces cleanly.
- After public launch: hold risky phases closed until production monitoring, backups, and manual smoke results are stable.

## Dev-only Until Explicitly Approved

- `/dev/test-console` and any local-preview-only event tooling.
- Dev owner claim paths and `DEV_OWNER_EMAILS`.
- Dev databases, dev seeds, and ignored local usable-token references.
- Fake/local chat as a verification harness, not real Twitch/YouTube chat.
- Simulated money/test-money events and any non-production reset tools.
- Public AI output, autonomous moderation-like actions, provider credentials, real money, ledger/credits/refunds, and production backup automation until their gates are separately approved.

## Dangerous Gates and Blockers

- Real money cannot start until provider choice, legal/refund/chargeback handling, ledger design, audit/export, and terms are approved.
- Provider credentials cannot be added until scopes, token storage, revocation, rate limits, failure behavior, and manual override are approved.
- Public AI cannot speak, post, read paid messages, or make moderation-like decisions until private shadow mode, prompt boundaries, mute/off controls, and safety review are approved.
- Moderation enforcement cannot start until rules, actions, audit log, appeal/review expectations, and streamer override are approved.
- Production auth/secrets cannot launch until fresh secrets, OAuth redirect URLs, explicit owner assignment, and no-first-login-promotion behavior are verified.
- Production backup automation cannot be trusted until retention, encryption, health checks, alert ownership, and restore testing are approved.

## Release Signoff Record

Before moving `dev` to production/main, record:

- release candidate commit SHA
- target branch and deployment target
- release owner
- operations owner
- migration list and applied order
- backup restore verification date
- smoke surfaces checked
- rollback decision and previous image/reference
- unresolved risks accepted by Michael
