# Maiks.yt Agent Instructions

This repository is a TypeScript monorepo for the Maiks.yt website, stream overlays, control tools, and community platform.

## Production Line

- The `production` branch and this production worktree are the sole forward-development line.
- Treat dev branches, older worktrees, and the damaged Windows-era copy as evidence or item-level recovery sources only. Do not merge or synchronize them wholesale and do not spend work keeping them current.
- Rebuild wanted behavior in production patterns when direct reuse would carry dev-only assumptions.
- Do not push, deploy, or change live services merely because checks pass. Require a clear real-user verification path and explicit coordinator authority for the live change.

## Read Order

Read only what the task needs:

1. `reports/current-work.md`
2. `reports/next-agent-tasks.md` when it exists and applies
3. the task-specific files named by the coordinator
4. the relevant section of `TODO.md`
5. one or two linked idea cards when product intent is needed

Do not load the full `ideas/` folder or the full project history.

## Engineering Rules

- Keep everything fully type-safe.
- Follow the existing domain-first file structure.
- Prefer existing packages and patterns over new abstractions.
- Keep changes tightly scoped to the assigned files and behavior.
- Prefer small, purpose-specific files. When a file becomes hard to review or grows into multiple responsibilities, split it into focused modules instead of continuing to add unrelated logic to it. Keep splits behavior-preserving unless the task explicitly asks for feature changes.
- Do not revert or rewrite changes made by another worker.
- Do not edit `.env` files, secrets, Cloudflare configuration, Docker configuration, migrations, deployment scripts, or authentication unless the task explicitly assigns them.
- Never add real-money behavior without an explicitly approved money-phase task.
- Use `apply_patch` for manual edits.
- Run the narrowest relevant tests and typechecks.
- Report files changed, checks run, and unresolved risks.

## Visual Acceptance

- `/home/michael/Documents/UI Skill` and its example catalogs are obsolete and are not design authority.
- Before implementing a new or materially redesigned Maiks.yt surface, generate a representative image, iterate until Michael explicitly approves it, and preserve that approved image as the acceptance reference.
- Implement the production surface against the approved image while preserving real behavior, accessibility, the established production style, and relevant responsive or OBS states.
- Verify the rendered desktop view and every relevant responsive, installed-PWA, or OBS state against the approved reference before claiming visual completion.
- Small functional fixes do not require an image-first cycle unless they materially change the visual result.

## Worker Rules

Workers receive one bounded task with an explicit write scope.

GPT-5.5 is the default model for workers and reviewers. A smaller model may be used only for mechanical, low-risk tasks with narrow acceptance criteria, such as isolated copy edits, inventory work, or a straightforward fixture update.

Always use GPT-5.5 for:

- architecture and shared contracts
- authentication, identity, permissions, privacy, or security
- money, ledger, credits, refunds, or sponsor accounting
- moderation and abuse handling
- database schema and migrations
- realtime transport and overlay queues
- cross-app or cross-package changes
- final review of delegated code

Workers must:

- stay within the assigned file ownership
- avoid broad refactors
- avoid commits, pushes, deployments, and server changes
- stop and report when the task requires a decision outside its scope
- leave the workspace in a reviewable state

## Reviewer Rules

The coordinator/reviewer:

- reviews every worker patch
- checks architecture and cross-module behavior
- runs integration tests and browser verification where relevant
- updates `TODO.md` and `reports/current-work.md`
- commits coherent reviewed slices to `production`; pushes or deploys only when authorized and verifies the actual target environment

## Standard Checks

Workers should use the narrowest checks relevant to the changed surface:

```powershell
pnpm --filter <package-name> test
pnpm --filter <package-name> typecheck
pnpm --filter <app-name> build
node scripts/check-architecture.mjs
```

Coordinator/reviewer checks should use the shared scripts unless a task explicitly needs a narrower or heavier run:

```bash
pnpm check:review
pnpm check:full
```

Use `pnpm check:review` before merging reviewed work. Use `pnpm check:full` before high-risk deploys or when changes cross many packages. Update `scripts/check-review.sh` and `scripts/check-full.sh` when the standard verification needs change.

Use `pnpm test:readiness` for a pre-testing local gate that runs review checks plus the dev smoke dry-run. Add `-- --visual` when screenshot coverage is needed before or after a testing session.

Use deployment scripts only from the reviewer/coordinator after review succeeds and the target environment is proven.
