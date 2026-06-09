# Streaming Platform Benefits as Site Credits

## Idea

Support Twitch subs, gifted subs, YouTube memberships, and similar platform-native support by converting part of their estimated value into site credits.

Example: if someone receives or buys a Twitch sub, they may receive a percentage of the creator's expected share as credits. Those credits can be used to support donation goals on the site.

To reduce fraud risk, these platform-derived credits cannot be paid out as cash refunds.

## Why It Matters

Some viewers will keep using Twitch and YouTube features no matter how good the website is. This idea gives those actions a place in the website economy without pretending they are the same as direct donations.

It also avoids punishing people for supporting through the platform they already use.

## Data Needed

- linked Twitch and YouTube accounts
- platform subscription events
- membership events
- gifted sub events
- estimated creator share
- credit grants
- credit restrictions
- credit usage history

## Build Requirements

- Twitch integration
- YouTube integration
- event ingestion and verification
- credit ledger
- fraud restrictions
- admin review tools
- public explanation of restricted credits

## Type-safety Notes

Credits should have a source type, such as direct-overflow, manual-grant, twitch-sub, youtube-member, or promo. Payout eligibility should be explicit on each credit entry.

## Open Questions

- What percentage of a sub or membership should become credits?
- Should gifted sub recipients, gifters, or both receive credits?
- How should regional pricing and platform cuts be handled?
- How long should platform-derived credits remain valid?
- What happens if a platform event is reversed or refunded?
