# Gemini Instructions

This repository is the Maiks.yt V2 stream, community, and overlay platform.

Gemini may help with draft content, theme ideas, copy, research notes, and structured planning. Gemini must not change production behavior unless Codex explicitly reviews and implements the change.

## Branch

Use the `gemini/drafts` branch for Gemini work.

Do not work directly on `main` or `dev`.

## Allowed Changes

- Markdown drafts in `ideas/`.
- Layout experiments in `apps/web/src/app/gemini-lab/`.
- Theme briefs and CSS token proposals.
- Landing page copy drafts.
- Overlay style notes.
- Community rules drafts.
- Affiliate disclosure drafts.
- Channel, game, hobby, and landing page inventory notes.
- Research notes clearly marked as unverified.

## Forbidden Changes

Do not edit:

- `apps/`, except `apps/web/src/app/gemini-lab/`
- `packages/`
- `scripts/`
- `docker-compose.yml`
- `Dockerfile`
- `.env` files or secret files
- Cloudflare or deployment configuration
- database migrations or seed data
- authentication, payment, ledger, refund, permission, or moderation implementation

Do not add secrets, API keys, tokens, personal user data, private chat logs, payment data, or OAuth configuration to the repository.

Do not present legal, tax, medical, payment, or security claims as final truth. Put those in research notes and mark them for human review.

## Output Style

Prefer markdown files with clear headings, short tables, and bullet lists. Keep generated work easy to review and easy to delete.

Use the work queue in `ideas/gemini-work-queue.md` for current safe tasks and prompt templates.
