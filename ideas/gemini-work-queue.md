# Gemini Work Queue

This file is a safe handoff area for non-critical work that can be drafted by Gemini or another assistant without touching production behavior.

## Branch

Use the `gemini/drafts` branch for Gemini-generated work.

Gemini should create or edit markdown, JSON drafts, or CSS token proposals only. Do not let Gemini edit application code, auth code, payment logic, database migrations, Docker files, Cloudflare configuration, environment files, or deployment scripts without a Codex review first.

## Safe Work

- Landing page theme briefs for games, hobbies, and channel identities.
- CSS variable proposals for themes.
- Overlay visual style notes and notification tone ideas.
- Landing page copy drafts.
- Community rules drafts.
- Affiliate disclosure copy drafts.
- Health/about page copy drafts.
- Channel and hobby inventory tables.
- Research notes for stores, wishlist providers, social platforms, and stream tools.

## Unsafe Work

- OAuth, auth, account-linking, sessions, cookies, or permissions.
- Payment provider decisions, ledger behavior, refunds, credits, chargebacks, or tax wording.
- Database schema, migrations, seed data, or production data.
- Secrets, environment variables, tokens, API keys, or Cloudflare tunnel settings.
- Docker, deployment, CI, automation, or server scripts.
- Legal claims presented as fact.

## Theme Token Contract

Theme drafts should use these CSS variables:

```css
--maiks-bg: #000000;
--maiks-fg: #ffffff;
--maiks-muted: #888888;
--maiks-panel: #111111;
--maiks-accent: #4f9cff;
--maiks-danger: #ff4f4f;
--maiks-warning: #ffd166;
--maiks-success: #45d483;
--maiks-notification-bg: #111111;
--maiks-notification-fg: #ffffff;
```

## Suggested Prompt

```text
Create landing page theme briefs for Maiks.yt for:
1. Satisfactory
2. Minecraft
3. Coding / build streams
4. General community

For each theme, provide:
- mood and audience
- color tokens using the Maiks.yt theme token contract
- typography feel
- landing page layout ideas
- overlay notification style
- accessibility and contrast notes
- do/don't list

Do not write application code. Do not discuss auth, payments, database schema, deployments, secrets, or legal/tax claims as fact.
```

## Raw Context Endpoint Idea

Raw AI context endpoints are useful later, but we should start with markdown files until the shape is stable. A future read-only endpoint could expose public, non-sensitive context as JSON:

- `GET /ai-context/project`
- `GET /ai-context/themes`
- `GET /ai-context/channels`
- `GET /ai-context/work-queue`

Those endpoints must never include secrets, private user data, OAuth configuration, payment data, internal moderation notes, or unpublished personal information.
