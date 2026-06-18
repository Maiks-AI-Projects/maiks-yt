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

Development can still test money-adjacent user experience before this decision is complete by using a clearly labeled mock support/payment simulator. Simulated support events may use real dev users for avatar and display-name testing, but the value source must remain explicitly marked as simulated.

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
- define the private admin audit trail needed for support events, allocation changes, reversals, refunds, chargebacks, and anonymization

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

## Admin Audit Trail

The owner/admin area should eventually show the full flow of support value through the system.

This is separate from the public transparency page. Public pages should explain outcomes clearly, while private admin pages need operational detail for support questions, provider disputes, chargebacks, legal/tax questions, abuse reports, and account deletion/anonymization.

The audit trail should answer:

- what event created the value
- whether it came from a live provider, provider sandbox, platform-derived estimate, site credit, restricted credit, or mock simulator
- which account, guest, or anonymized actor it belongs to
- how it was allocated
- who or what changed the allocation
- whether any amount was reversed, refunded, expired, or converted
- what remains unresolved

## Open Questions

- Which payment providers are available and realistic in the Netherlands?
- Can credits legally/technically be used the way we want?
- Are cash payouts/refunds worth supporting in version one?
- Should version one avoid stored credits and only track allocations?
- Should the ledger use double-entry bookkeeping from the start?
- Which value types are currencies, and which are only platform support signals?

Related card: [Mock Support and Payment Simulator](mock-support-payment-simulator.md).
