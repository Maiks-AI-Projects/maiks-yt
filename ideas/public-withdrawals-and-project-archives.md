# Public Withdrawals and Project Archives

## Idea

Make withdrawals public and archive completed projects with a clear record of how the money was spent.

For completed projects, users should be able to see:

- original goal
- amount raised
- withdrawals made
- purchases or payments made
- price changes
- surplus or shortfall
- credits issued from leftover funds
- final project outcome

Archived projects remain visible as a historical record.

## Why It Matters

Public withdrawals and spending records make the funding system credible. People can see that money was used for the stated purpose, and future donors can judge the track record before contributing.

It also creates a natural audit trail without requiring users to ask awkward questions.

## Data Needed

- withdrawal records
- spending records
- receipts or proof links
- project archive state
- project completion summary
- final cost
- raised amount
- surplus handling
- public/private visibility rules
- admin notes

## Build Requirements

- withdrawal ledger entries
- public withdrawal feed or project-level withdrawal list
- spending log per project
- archive workflow
- project completion summary
- optional receipt/proof attachment support
- surplus credit distribution
- public archive page
- admin controls for corrections and notes

## Privacy Notes

Transparency should not require exposing sensitive private details. For example, a public record can show that money was spent on clothes or a subscription without exposing private addresses, order numbers, payment account details, or family information.

## Type-safety Notes

Withdrawals and spending should be ledger events, not free-form edits to a project total. Spending records can reference one or more withdrawals and one or more project items.

## Open Questions

- Should all withdrawals be public immediately, or after they are assigned to a project?
- Should receipt uploads be public, private, or partially redacted?
- Should users be able to comment or ask questions on archived projects?
- How much personal detail should be shown for family-related projects?
- Should ongoing costs be archived per month, per year, or never fully archived?
