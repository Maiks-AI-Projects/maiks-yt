# Live Stream Goals and Auto-allocation

## Idea

Allow an item or project to be marked as the active stream goal. During that stream, funds from platform events such as subs, gifted subs, Bits, memberships, and similar support can be automatically allocated to the stream goal.

Provider support intake itself should not depend on the stream being live. People can sub, send bits, renew memberships, boost, or trigger provider-side support-like events while the streamer is offline. Those events still need to be registered, audited, and available for later claiming/accounting. The live stream goal only decides the default allocation/display behavior when a stream and active goal are present.

Users can later log in and change where their contribution goes, even if they did not have an account when the contribution happened.

## Why It Matters

Live stream goals make support feel immediate. Viewers can see progress move during the stream, and the overlay can show a clear shared target.

The ability to later redirect support keeps the system user-respecting. It avoids trapping a contribution just because the user supported through Twitch or YouTube before having a site account.

## Data Needed

- active stream
- active stream goal
- platform support events
- offline provider support events
- estimated support value
- default allocation target
- user claim status
- temporary platform identity
- linked site account
- allocation history
- redirect history
- overlay progress state

## Build Requirements

- mark project/item as active stream goal
- stream session model
- automatic allocation rules for platform events
- live progress overlay
- claimable contribution records
- account linking flow for users without accounts
- redirect contribution flow
- audit trail for allocation changes
- clear explanation of default allocation

## Claiming Contributions

If someone supports through Twitch, YouTube, Patreon, or another platform before they have a site account, the system can record the event under a platform identity.

Later, when they link that platform account to a site account, eligible contribution records can become claimable and editable according to the rules.

If no stream is live when the event arrives, the contribution should still be recorded. It can remain unallocated, use a configured offline default, or require owner review. It should not disappear simply because OBS was closed.

## Type-safety Notes

Platform support events should be separate from direct donations. Their values may be estimated, delayed, restricted, or non-refundable depending on source.

## Open Questions

- Which platform events auto-allocate to the active stream goal?
- What should be the default allocation for provider support that arrives while offline?
- How long can users redirect a platform-derived contribution?
- Should direct donations during a stream default to the stream goal too?
- Should stream goals be allowed to auto-change when fully funded?
- Should platform-derived support count as restricted credits, donation value, or a separate support type?
