# Local Model Lab Workflow and PR Checklist

## Purpose

This document defines how local models (AI assistants) should safely contribute to the Maiks.yt codebase. Local models generate draft work only; all review, commit, deploy, and production decisions remain with the coordinator (Michael).

## Workflow

### 1. Issue Selection

- Each issue in `reports/next-agent-tasks.md` or GitHub represents a bounded task.
- Issues are numbered sequentially; process them in order (Issue 8 first, then 7, 6, etc.).
- Only one issue at a time per branch.

### 2. Branch Creation

- Active branch: `codex/local-model-lab`
- Create a new branch per issue: `codex/local-model-lab/issue-{N}-{short-name}`
- Example: `codex/local-model-lab/issue-8-local-model-workflow`

### 3. Task Types

**Safe for local models (draft only):**

- Documentation updates (`reports/`, `ideas/`)
- Design-only planning (schema proposals, runbook drafts)
- Generated migrations (schema only, no runtime code)
- Type-safe domain/API code with clear safety boundaries
- Tests for existing or new code

**Require coordinator review before any work:**

- Architecture and shared contracts
- Authentication, identity, permissions, privacy, security
- Money, ledger, credits, refunds, sponsor accounting
- Moderation and abuse handling
- Database schema and migrations (generation approved first)
- Real-time transport and overlay queues
- Cross-app or cross-package changes
- Provider integrations (Twitch, YouTube, Discord, Steam)

### 4. Scope Boundaries

**Never touch:**

- `.env` files, secrets, Cloudflare config, Docker config
- Deployment scripts, migrations application, server state
- Production data or production deployment
- Authentication changes unless explicitly assigned
- Real-money behavior without approved money-phase task

**Must include:**

- Safety checks (reject real provider dispatch, real money, real production events)
- Test coverage for the new behavior
- Typecheck pass

### 5. PR Creation

After completing work on a branch:

1. Commit with a descriptive message
2. Push the branch
3. Create a PR targeting `codex/local-model-lab`
4. Reference the issue number in the PR description

## PR Checklist

Every PR must include:

### Changed Files

- List all files modified
- Note which are docs, schema, domain, API, web, or test files

### Checks Run

- `[x] node scripts/check-architecture.mjs`
- `[x] git diff --check`
- `[ ] pnpm --filter <package> test` (if applicable)
- `[ ] pnpm --filter <package> typecheck` (if applicable)
- `[ ] pnpm --filter <package> build` (if applicable)

### Skipped Checks

- Note any checks skipped and why

### Unresolved Risks

- List any risks that require coordinator attention
- Note anything that needs manual verification

### Safety Verification

- [ ] No real provider dispatch is enabled
- [ ] No real money behavior is introduced
- [ ] No production secrets are exposed or committed
- [ ] No authentication changes outside scope
- [ ] No migration application (only generation)
- [ ] No deployment or server state changes

## Review Process

The coordinator/reviewer:

1. Reviews the worker patch
2. Checks architecture and cross-module behavior
3. Runs integration tests and verification
4. Updates `TODO.md` and `reports/current-work.md`
5. Commits, pushes, and deploys on `dev` if approved
6. Closes the issue and updates `reports/next-agent-tasks.md`
