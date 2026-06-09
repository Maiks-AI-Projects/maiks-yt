# Transparent Money Flow and Donation Revocation

## Idea

Logged-in users should be able to trace what happened to their money after donating.

They should be able to see:

- which project, item, or goal they donated to
- whether their donation was moved because of overflow or project changes
- whether funds were reappropriated to a winning mutually exclusive project
- whether leftover money became credits
- whether credits are payout-eligible or restricted
- when money was spent, reserved, credited, refunded, or reallocated

If a project changes direction in a meaningful way, users may be allowed to revoke or redirect their donation if they strongly disagree.

## Why It Matters

This builds trust. Viewers are more likely to support goals when they can see where their money went and when they know they are not trapped by quiet changes.

It also fits the larger goal of avoiding dark patterns. The system should make support feel voluntary, informed, and respectful.

## UX Principle

Revocation should exist, but it should not be pushed as a casual default action.

The option can be available in donation history, project change notices, or affected-project pages. It should be clear enough for a user who needs it, but not designed to nudge people toward withdrawing support impulsively.

## Data Needed

- donation ledger entries
- allocation history
- project change history
- user-visible money trail
- revocation eligibility
- revocation requests
- redirect requests
- refund or credit outcomes
- payout eligibility per credit source
- project funds already spent or reserved

## Build Requirements

- user donation history page
- per-donation money trail
- project change log
- rules for what counts as a major direction change
- revocation eligibility engine
- redirect-to-another-project flow
- refund-to-credit flow
- optional cash refund request flow
- admin review for disputed cases
- clear user-facing explanations

## Possible Rules

- Users can revoke or redirect only when a project has materially changed.
- Users cannot revoke funds that were already spent on the stated project unless handled manually.
- Users can always see the trail, even when revocation is unavailable.
- Reappropriation rules must be shown before donating to mutually exclusive projects.
- Restricted platform credits cannot become cash-payout credits.

## Type-safety Notes

This reinforces the need for an immutable ledger. A donation should not be edited in place. Instead, the system should create typed events such as `donationReceived`, `fundsAllocated`, `fundsReallocated`, `projectChanged`, `creditsIssued`, `revocationRequested`, `revocationApproved`, and `refundPaid`.

## Open Questions

- What exactly counts as a major project direction change?
- Should revocation be automatic when eligible, or always reviewed?
- Should users receive alerts when a project they donated to changes?
- How long after a major change can a user revoke or redirect funds?
- Should guest donors have any revocation path, or only logged-in users?
- Should revoked funds return as site credits first, with cash payout as a separate request?
