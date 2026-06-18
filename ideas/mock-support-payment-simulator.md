# Mock Support and Payment Simulator

## Idea

Build a development-only simulator for support and payment-like events so project funding, stream goals, overlays, profiles, and ledger rules can be tested before any real payment provider is connected.

This simulator may use real dev users and their linked platform data, such as display names, profile images, Twitch avatars, YouTube avatars, and selected public profile names. The support/payment values themselves remain simulated.

## Why It Matters

The platform needs realistic testing for money-adjacent flows long before public money is enabled.

Using real dev users helps test the parts that matter visually and socially:

- avatar resolution
- display-name priority
- verified profile identity
- overlay readability
- notification queue pressure
- project allocation behavior
- active stream goal behavior

Using simulated values keeps development flexible while the payment-provider, legal, refund, and ledger decisions are still open.

## Core Rule

Dev can mix real user identity data with simulated support events, but every simulated value event must be explicitly labeled as simulated.

The goal is not to protect the dev database from messy data. The dev database is allowed to be messy.

The goal is to make the typed event model clear enough that the production code can never confuse:

- a simulated donation
- a provider sandbox payment
- a real provider-confirmed payment
- a platform-derived estimated support value
- a site credit movement
- a restricted credit movement

## Data Needed

- event environment, such as `dev`, `sandbox`, or `production`
- value source, such as `mock`, `providerSandbox`, `providerLive`, or `platformDerived`
- provider or simulator event id
- actor user id when a real dev user is used
- fallback generated viewer profile when no real user is chosen
- amount and currency or value unit
- allocation target, such as project, item, milestone, or active stream goal
- optional message
- optional platform context, such as Twitch, YouTube, Patreon, or site direct
- replay/scenario id
- created timestamp

## Build Requirements

- typed mock support event contracts
- generated fake viewer profiles
- option to sample real dev users for avatar/name testing
- fake direct donation events
- fake failed payment events
- fake refund/reversal/chargeback events
- fake Twitch Bits, subs, gifted subs, YouTube memberships, and Patreon-like support events
- active stream goal allocation scenarios
- mutually exclusive project allocation scenarios
- overflow and credit scenarios
- event storm presets that combine chat, raids, support events, and overlay notifications
- clear dev/test UI labels
- guardrails so simulated value cannot be exported or treated as real provider-confirmed value
- admin views for tracing simulated support events through allocation, overflow, reversal, and credit-like outcomes

## Stream Simulator Integration

This should be part of the stream simulator/replayer system, not a separate fake money application.

Example scenarios:

- a real dev user avatar appears in a fake donation notification
- a fake gifted-sub burst pushes top notifications across the overlay
- a fake donation triggers a center notification and then re-enters the top notification queue
- a fake active stream goal receives several auto-allocated platform-derived support events
- a fake chargeback reverses a previous simulated support event
- a raid, chat spam wave, sponsor toggle, and fake donation happen in the same replay

## Money System Boundaries

This does not start real money features.

The simulator can help test future money-like behavior, but public donations, payouts, refunds, stored credits, and immutable ledger behavior still require explicit money-phase approval.

Until then, simulated support events should be useful for:

- UI testing
- overlay testing
- control panel testing
- project allocation design
- ledger contract design
- admin audit-flow design
- provider decision research

## Admin Audit Impact

The admin side needs a private audit surface before real money exists.

As the owner, Michael should be able to inspect how a support event moved through the system:

- where it came from
- which user or guest it was attached to
- which project, item, milestone, or stream goal it was allocated to
- whether it overflowed
- whether it became credit-like value
- whether it was moved, reversed, refunded, or anonymized
- which automated rule or manual admin action changed it

This is useful for mock events during development and becomes necessary for real provider events later.

Even as a private person, records should be understandable enough to answer an audit, tax, provider, chargeback, police report, or community-trust question. The public website can show a simplified transparency view, but the admin area needs the full private operational trail with appropriate privacy controls.

## Type-safety Notes

Simulated events should use the same normalized event pipeline as future real events where possible, but the source labels must be part of the type contract.

Prefer discriminated unions over loose strings, for example:

- `kind: "support.simulatedDonation"`
- `kind: "support.platformDerivedEstimate"`
- `kind: "support.providerSandboxPayment"`
- `kind: "support.providerLivePayment"`

The exact names can change when implemented, but the model should make unsafe mixing hard.

## Open Questions

- Should simulated support events ever write to the same ledger tables as real money events, or should they use a separate dev/test ledger store?
- Should the dev UI allow selecting specific real users for test events?
- Should mock support events be replayable from saved stream sessions?
- Which provider sandbox should be tested first once provider research is done?
- Should simulated credits exist before the real credit model is approved?
- How should generated fake viewer profiles be named so they are never mistaken for real community members?
