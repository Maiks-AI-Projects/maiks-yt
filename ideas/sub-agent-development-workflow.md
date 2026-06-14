# Sub-agent Development Workflow

## Goal

Reduce context and token usage without losing review quality.

The project should not depend on one long conversation remembering every decision. Stable context belongs in the repository, and each coding worker should receive only the context required for one task.

## Roles

### Coordinator and Reviewer

The main Codex thread acts as architect and reviewer.

It:

- reads `AGENTS.md` and `reports/current-work.md`
- selects the next task
- gives a worker a narrow prompt and write scope
- reviews the returned patch
- runs integration and browser checks
- updates the current-work report and checklist
- commits, pushes, and deploys

### Worker

A worker starts without the long conversation history.

It receives:

- one concrete objective
- explicit files or directories it owns
- relevant acceptance criteria
- exact checks to run
- one or two product cards only when needed

It does not commit, push, deploy, modify secrets, or expand the task.

## Model Selection

Use GPT-5.5 by default for both implementation workers and verification workers.

Another model is appropriate only when the task is mechanical, isolated, low-risk, and easy to verify. Examples include link inventories, small copy changes, simple fixture additions, or tightly scoped CSS variants.

Do not downgrade architecture, authentication, identity, privacy, permissions, moderation, money, database, realtime, overlay queue, or cross-package work.

### Verification Worker

For risky or cross-module work, a separate clean-context worker may inspect the patch for:

- behavioral regressions
- missing tests
- type-contract mismatches
- security/privacy mistakes
- UI layout problems

The coordinator still makes the final decision.

## Task Size

A worker task should normally fit one of these shapes:

- one package-level domain change plus tests
- one page or UI surface
- one API endpoint family
- one browser verification pass
- one documentation/research decision

Do not assign broad requests such as "finish chat" or "build the project system."

## Prompt Template

```text
Read AGENTS.md and reports/current-work.md.

Task:
<one concrete objective>

You own:
<explicit files/directories>

Acceptance criteria:
- <criterion>
- <criterion>

Run:
- <narrow test/typecheck>

Do not commit, push, deploy, or edit files outside your ownership.
Report changed files, checks, and unresolved concerns.
```

## Session Workflow

1. Start a fresh coordinator thread.
2. Ask it to read `AGENTS.md` and `reports/current-work.md`.
3. Run `corepack pnpm agent:brief`.
4. Assign at most a few independent workers at once.
5. Review and integrate each returned patch.
6. Update `reports/current-work.md`.
7. Commit and deploy only after checks pass.
8. Start another fresh coordinator thread when the conversation becomes large.

## Context Budget Rules

- Do not paste the full `TODO.md` into worker prompts.
- Do not pass conversation history to workers unless absolutely necessary.
- Prefer repository links and file paths over repeated explanations.
- Use clean-context workers rather than forked-context workers for normal implementation.
- Keep the coordinator focused on decisions, review, and integration.
