# Supporter Profile Recognition

## Idea

Let users display support activity on their profile if they choose to make it public.

Examples:

- gifted subs
- Twitch Bits
- YouTube memberships
- donations
- Patreon support
- project funding contributions
- raids or other community support events

Users should be able to choose what is public, private, or hidden.

## Why It Matters

Some viewers enjoy being recognized for helping the stream or community. Public supporter history can give them credit without forcing everyone into visibility.

It also makes profile pages feel more meaningful and connected to the live stream ecosystem.

## Data Needed

- support events
- platform source
- display preferences
- public/private visibility
- profile badges or history entries
- linked accounts
- event timestamps
- contribution categories

## Build Requirements

- profile support history
- visibility controls
- profile badges or stats
- source platform labels
- moderation/admin controls
- account linking for platform events
- privacy-safe summaries

## Type-safety Notes

Public support display should not directly expose raw financial records. Use typed display summaries derived from ledger/support events, with privacy rules applied.

## Open Questions

- Should exact amounts be public, approximate, or hidden by default?
- Should gifted sub givers and recipients both receive profile recognition?
- Should users be able to hide individual events?
- Should there be supporter badges or ranks?
- Should recognition differ by channel, game, or theme?
