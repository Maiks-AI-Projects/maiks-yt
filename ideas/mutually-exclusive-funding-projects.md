# Mutually Exclusive Funding Projects

## Idea

Allow some projects to exclude each other. Viewers can vote, like, dislike, and donate toward the version they prefer.

Example:

- Project A: build a custom AI server from parts
- Project B: buy an NVIDIA DGX Spark Founders Edition

Both solve a similar need, so only one should be funded and executed. If people donate to one option, they see a clear warning that funds may be reappropriated to the winning project if another option wins.

If the winning project is cheaper and money remains, the leftover amount becomes user credits.

## Why It Matters

This lets the community help choose between real alternatives without forcing you to manually untangle funding promises later.

It also makes big decisions more transparent: people can see tradeoffs, prices, votes, and consequences before donating.

## Data Needed

- exclusion groups
- projects in each exclusion group
- likes and dislikes
- vote rules
- donation allocations
- winner selection state
- reappropriation records
- leftover credit calculations

## Build Requirements

- exclusion group model
- UI warnings before donation
- voting or preference system
- rules for when a winner is chosen
- ledger entries for reappropriated funds
- credit creation for leftover funds
- admin approval flow before finalizing a winner

## Type-safety Notes

This should use a ledger-style model. Donations, reappropriations, credits, refunds, and purchases should be separate typed transaction records rather than editing old transactions in place.

## Open Questions

- Are likes/dislikes advisory, or do they decide the winner automatically?
- Can you override the winning project manually?
- What deadline or funding threshold triggers the final decision?
- Are donors allowed to withdraw before a winner is selected?
- What exact wording is legally and ethically needed for the warning?
