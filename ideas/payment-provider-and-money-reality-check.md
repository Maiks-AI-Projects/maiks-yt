# Payment Provider and Money Reality Check

## Idea

Before building money features too deeply, choose realistic payment providers and confirm what they support.

This affects:

- direct donations
- refunds
- credits
- payout eligibility
- chargebacks
- guest donations
- recurring support
- platform-derived support
- currency handling
- multi-currency support
- transaction fees

## Why It Matters

Some donation ideas may be limited by payment providers, laws, fees, chargeback rules, or platform terms. It is better to discover those limits early than after designing the whole system around impossible flows.

## What This Means

This does not mean the idea is bad. It means the money system needs a practical check against providers such as Stripe, PayPal, Ko-fi-like flows, bank transfer options, or other processors available in the Netherlands.

## Build Requirements

- compare provider options
- check refund support
- check partial refund support
- check platform fees
- check chargeback handling
- check recurring payment support
- check terms around credits
- check payout/refund restrictions
- check multi-currency behavior
- decide how Bits, subs, memberships, credits, and euros are represented
- decide direct donation provider for version one

## Multi-currency and Platform Support

The system should be designed for multiple value sources from the start, even if public money features arrive later.

Examples:

- euros
- site credits
- restricted credits
- Twitch Bits converted to estimated streamer cut
- Twitch subs converted to estimated streamer cut
- YouTube memberships converted to estimated streamer cut
- Patreon support converted to actual or estimated value

Bits and subs should not be treated as raw money. They should be converted into estimated money value based on the streamer cut and platform rules, then clearly labeled as platform-derived support.

## Double-entry Consideration

A double-entry ledger should be considered for money and credit flows. This may be especially useful once multiple currencies and restricted credits exist.

The goal is to prevent value from appearing or disappearing without a matching entry.

## Open Questions

- Which payment providers are available and realistic in the Netherlands?
- Can credits legally/technically be used the way we want?
- Are cash payouts/refunds worth supporting in version one?
- Should version one avoid stored credits and only track allocations?
- Should the ledger use double-entry bookkeeping from the start?
- Which value types are currencies, and which are only platform support signals?
