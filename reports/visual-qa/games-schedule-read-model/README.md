# Games Schedule Read Model Visual QA

Date: 2026-08-27

## Scope

This proof covers the owner-only reverse Schedule summary added to
`/admin/games`. Schedule remains the only place that can create or change game
links. Games only shows relevant upcoming `planned` links and current `live`
links.

## Method

The production Next application was built and run locally. Playwright opened
`/admin/games` with an intercepted owner session and a synthetic API response
containing one upcoming planned association. This proves the rendered owner
workflow without changing production data.

## Evidence

- `admin-games-1440x1000.png`: full-width admin table plus the selected game's
  read-only Schedule panel and `Open Schedule` link.
- `admin-games-960x1080.png`: compact layout at approximately half-screen
  width.
- Both viewports reported `scrollWidth` equal to the viewport width, so the new
  summary does not introduce horizontal page overflow.
- The compact row uses the neutral label `1 link`; the detail panel carries the
  truthful `Planned` or `Live` state.

## Boundaries

- The visual run used synthetic data and made no database or schedule changes.
- Domain and API tests cover exclusion of cancelled, completed, unrelated, and
  stale planned associations.
- Authentication, deployment, and real production data remain unverified while
  the production host is unreachable and the public origins return Cloudflare
  `530`.
