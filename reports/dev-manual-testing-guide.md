# Dev Manual Testing Guide

Updated: 2026-07-10

Purpose: give Michael a practical first-pass order for testing the dev site without needing to remember every feature lane. This guide assumes testing happens on the dev surfaces and that production/main release work is still separate.

## Before A Testing Session

Run the local readiness gate:

```bash
pnpm test:readiness
```

For screenshot coverage of public, admin, chat, moderation, and overlay surfaces:

```bash
pnpm test:readiness -- --visual
```

On the dev server, where the container does not run the full local Bash review gate, use:

```bash
pnpm test:readiness -- --skip-review
```

Expected current smoke size: 78 passing checks.

The readiness command waits for `api-dev` health before it starts the smoke dry-run, so immediately after a dev deploy it may report a few transient `502` attempts before continuing.

## Pass 1: Access And Recovery

Goal: make sure Michael can get in, recover from mistakes, and inspect sensitive state.

- Open `/admin`.
- Confirm the dashboard cards render as cards, not plain text.
- Open `/admin/sessions`.
- Confirm the current session is visible and "revoke others" does not log out the active browser.
- Open `/admin/tokens`.
- Confirm overlay/control/chat URLs can be created or rotated.
- Open `/admin/backup/health`.
- Download the key-data export from `/admin` and store it only as a short-lived private testing snapshot.
- Open `/tools/notifications` from the installed phone PWA and confirm unread/read/archive still work.

## Pass 2: Stream Windows

Goal: verify the windows Michael needs while live.

- If a stream window shows "Access Required", open `/admin/tokens`, create or rotate a Control Panel token, and use the generated control URL for `/chat`, `/moderation`, or `/control`.
- Open the standalone chat PWA at `control-dev` `/chat`.
- Confirm newest messages appear on top.
- Confirm Twitch, YouTube, and Discord status dots are visible.
- Confirm disconnected/problem states are clear but compact.
- Open `/moderation` as a separate window.
- Confirm the first panel is chat with quick actions.
- Confirm the panel dropdown exposes only allowed panels.
- Confirm applied rules and audit history load.
- Use fake/local chat first for hide, ban, warn, and retract testing.
- Confirm hidden/banned local messages do not show in overlay chat.
- Use emergency clear only as a deliberate test and then restore normal state.

## Pass 2A: Installed Window Checklist

Goal: verify the PWA/browser-window behavior that headless smoke cannot fully prove.

- Install or open Streamer Chat, Moderation, Control Panel, and Notifications as separate app windows where the browser supports it.
- Confirm each installed window opens without the normal website navbar and keeps the expected route after restart.
- Confirm the chat and moderation windows stay signed in or show the Access Required recovery path clearly.
- Resize chat and moderation to 1366x768, 1600x900, and 1920x1080 if practical, and check for horizontal overflow or clipped action buttons.
- Confirm provider chat remains private to chat/moderation windows and does not appear on the OBS overlay by default.

## Pass 3: Provider Intake

Goal: confirm real provider intake is visible privately before any overlay routing.

- Twitch: start/reconnect intake if needed, send one harmless Twitch chat message from a test account, confirm it appears in `/chat`, and confirm it does not appear on the OBS overlay by default.
- Discord: send one harmless Discord message in the configured guild/channel, confirm it appears in `/chat`, and confirm it does not appear on the OBS overlay by default.
- YouTube: only test real live chat when an active YouTube live chat exists; otherwise confirm the status stays in the safe waiting state.
- Open `/admin/connections`.
- Confirm recent intake rows are redacted and source/mechanism labels make sense.
- Confirm provider health cards do not expose raw tokens or payload secrets.

## Pass 4: Content And Public Pages

Goal: verify public pages can be edited or inspected safely without accidental publishing.

- Open `/admin/pages`.
- Create a draft page on a harmless path.
- Preview it in admin.
- Confirm it is not public until published.
- Publish, open the public path, then unpublish or delete the hidden/draft test record.
- Open `/admin/links` and verify public link ordering/published state.
- Open `/admin/projects`.
- Test project preview, updates, item estimates, and item links.
- Open `/admin/schedule`.
- Test schedule focus/project/game links with public schedule output.
- Open public `/links`, `/projects`, `/schedule`, `/games`, `/updates`, `/community-rules`, `/privacy/analytics`, and `/accountability`.

## Pass 5: Money And Accounting

Goal: test private accounting mechanics without public money behavior.

- Open `/admin/money`.
- Create one private test income entry.
- Create one private test spending/cost entry.
- Add receipt/reference metadata where useful.
- Add a correction rather than editing historical meaning.
- Void a deliberate mistake and confirm it stays auditable.
- Check derived warnings.
- Resolve a warning with a clear note.
- Export CSV, warning CSV, JSON summary, and the bundled review package.
- Confirm reports separate real/test/simulated/provider-sandbox values as expected.

Do not test public donation/support behavior yet; that remains a later explicit phase.

## Pass 6: Moderator And Helper Flow

Goal: confirm moderator permissions are understandable and reversible.

- Open `/admin/moderators`.
- Review rank paths, rights, role grants, trust levels, and expiration/revocation fields.
- Create or update only harmless test grants.
- Confirm the moderator window exposes actions based on rights.
- Revoke the test grant and confirm the audit trail is still visible.
- Open `/admin/live-helper` and confirm summaries omit raw payloads, tokens, and role permission internals.

## Pass 7: Event Routing And Overlay

Goal: verify public stream output still requires explicit routing/approval.

- Open `/admin/event-routing`.
- Confirm privacy/security/provider-token events cannot be routed publicly.
- Use `/dev/test-console` for safe simulated events.
- Test an approval-required event and approve/reject it from event routing.
- Confirm top/center overlay notifications work for safe simulated events.
- Confirm normal provider chat still does not appear on overlay unless explicitly routed later.

## Stop And Record

After each testing session, record:

- What worked.
- What broke.
- Which page/window was open.
- Whether it was public, admin, chat, moderation, overlay, or provider intake.
- Whether the problem is blocking streaming, annoying but usable, or polish.
- Screenshots for visual/layout problems.

Use issues/PRs for follow-up once the dev floor is usable enough for repeated testing.
