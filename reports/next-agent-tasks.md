# Next Agent Tasks

Updated: 2026-06-15

These tasks finish the existing Action Panel partial area without beginning the broader Safety and Moderation phase.

Run them in order. The coordinator reviews and commits after each task. Do not assign overlapping workers to these tasks because later tasks depend on earlier contracts and migrations.

## Task 1: Action Panel Domain Permissions (Completed)

The typed permission and transition foundation is complete and reviewed. Do not rerun this task; Task 2 now depends on these contracts.

Model: GPT-5.5

Prompt:

```text
Read AGENTS.md, reports/current-work.md, and reports/next-agent-tasks.md.

Task:
Add the typed domain permission and decision-transition foundation for the Action Panel.

You own only:
- packages/domain/src/actions/action-item.types.ts
- packages/domain/src/actions/action-item.rules.ts
- packages/domain/src/actions/index.ts
- packages/domain/test/action-item.rules.test.ts

Acceptance criteria:
- Define typed capabilities for action-panel viewing, general decisions, and category-scoped decisions.
- Preserve "*" as the existing owner wildcard.
- Add pure rules for viewing, deciding, and valid action-status transitions.
- Terminal items cannot be decided again.
- Approve, reject, and defer transitions are explicit and type-safe.
- Optional decision notes are allowed and capped at 1,000 characters.
- Add focused tests for owner wildcard, broad permission, category permission, denial, malformed permissions, defer, and terminal states.
- Do not add moderator roles, role-management UI, strikes, bans, money actions, database changes, API routes, or web UI.

Run:
- corepack pnpm --filter @maiks-yt/domain test
- corepack pnpm --filter @maiks-yt/domain typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, or edit files outside your ownership.
Report changed files, checks, and unresolved concerns.
```

Reviewer gate:

- Review permission naming and transition semantics.
- Confirm no broader moderation or money behavior was introduced.
- Run domain tests and architecture check.
- Commit and deploy before Task 2.

## Task 2: Action Panel Persistence (Completed)

The Action Panel schema, legacy-safe migration, constrained decision history, and non-destructive seeds are complete and reviewed. Do not rerun this task; Task 3 now depends on these contracts.

Model: GPT-5.5

Start only after Task 1 is committed.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, and reports/next-agent-tasks.md.

Task:
Align Action Panel persistence with the domain contract and add append-only decision history.

You own only:
- packages/database/src/database.schema.ts
- packages/database/src/seed-dev.service.ts
- the newly generated packages/database/drizzle/0007_*.sql
- packages/database/drizzle/meta/0007_snapshot.json
- packages/database/drizzle/meta/_journal.json

Acceptance criteria:
- Align action_items priority, status, category, decision kind, stream relevance, live safety, due date, and optional source fields with the domain contract.
- Safely normalize existing legacy values before tightening database enums or constraints.
- Add append-only action_item_history containing action ID, decision, previous status, new status, actor domain-user ID, optional note, and timestamp.
- Add indexes needed for action lookup and recent history.
- Seed only non-money, non-moderation Action Panel examples.
- Rerunning the seed must never reopen or overwrite a previously decided action.
- Do not add API routes, UI, moderator roles, role-management behavior, strikes, bans, or money actions.

Run:
- corepack pnpm --filter @maiks-yt/database typecheck
- corepack pnpm --filter @maiks-yt/database db:generate
- node scripts/check-architecture.mjs

Do not apply the migration to the shared dev database.
Do not commit, push, deploy, or edit files outside your ownership.
Report changed files, migration behavior, checks, and unresolved concerns.
```

Reviewer gate:

- Carefully review generated SQL.
- Test migration on a disposable clean database and a disposable database containing legacy Action Panel values.
- Confirm seed idempotency.
- Commit, deploy, and apply to the V2 dev database only after successful review.

## Task 3: Authorized Action Panel API

Model: GPT-5.5

Start only after Task 2 is committed and the migration is applied.

Planned ownership:

- `apps/api/src/actions/`
- focused Action Panel route registration in `apps/api/src/main.ts`
- focused API tests

Required behavior:

- Resolve the authenticated session to the linked domain user and role permissions.
- `GET /actions` returns active items, recent history, and per-item decision capability.
- `POST /actions/:id/decision` performs permission check, transition validation, optimistic concurrency, item update, and history insertion in one transaction.
- Return `401`, `403`, `404`, and `409` for the appropriate cases.
- Test owner wildcard, category permission, denial, stale decisions, terminal items, transaction rollback, and actor identity.

The coordinator should write the final worker prompt after reviewing Tasks 1 and 2 so it references the actual contracts.

## Task 4: Authenticated Action Panel UI

Model: GPT-5.5

Start only after Task 3 is committed.

Planned ownership:

- `apps/web/src/app/actions/`
- Action Panel-specific styles in `apps/web/src/app/globals.css`

Required behavior:

- Replace the current `action=` URL demo mutation with authenticated API calls.
- Keep `live=1` only as a bookmarkable view filter.
- Show loading, signed-out, forbidden, empty, stale-decision, and failure states.
- Display recent decision history.
- Hide or disable controls based on server-provided capability.
- Verify decision persistence after refresh on desktop and mobile.

The coordinator should write the final worker prompt after the API contract is stable.

## Manual Parallel Gate: OBS

Michael can run the real OBS checklist while Action Panel tasks proceed.

The Action Panel work is not blocked by OBS. Do not mark the overlay section fully complete until the shared browser source passes the hidden-source and scene-switching checks.

## Blocked Creator Hub Follow-up

Do not assign the real destination-link task until Michael provides approved:

- Twitch URL or URLs
- YouTube URL or URLs
- Discord/community invite
- optional support destination
- preferred order and primary link

Unavailable destinations currently render honestly and are not broken links.
