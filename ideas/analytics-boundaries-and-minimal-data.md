# Analytics Boundaries and Minimal Data

## Idea

Collect only data that is strictly necessary for security and website features.

Any analytics, telemetry, or tracking should be clearly explained on the website.

## Why It Matters

The project includes link click analytics, sponsor telemetry, RSS, public project history, chat logs, platform integrations, and security monitoring. Without clear boundaries, this could become more invasive than intended.

## Data Principles

- collect the minimum needed
- avoid tracking users across unrelated contexts
- explain what is collected and why
- separate public transparency from private analytics
- keep sponsor telemetry limited to what is promised
- avoid selling user data
- retain data only as long as needed

## Build Requirements

- analytics policy page
- event collection allowlist
- security logging
- sponsor telemetry rules
- link click analytics controls
- retention settings
- admin visibility into collected data

## Open Questions

- Which analytics are truly needed for version one?
- Should link click analytics be disabled by default?
- How much sponsor telemetry is acceptable?
- How long should security logs be retained?
