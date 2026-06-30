# Profit-Aware Money Reporting and Dated Rules

## Idea

The money system should make it easy to record every cent that comes in and every cent that goes out, then export clear reports for tax/accounting review.

This is not tax advice and should not calculate official tax liability by itself. The platform should instead keep structured records so Michael can explain income, costs, fees, allocations, and remaining balances without reconstructing the story from payment-provider dashboards later.

## Why It Matters

Michael may owe a very high percentage of profit to the government. That makes accurate profit tracking urgent.

The useful number is not only "how much support came in." The system also needs to show:

- gross income
- provider/platform fees
- payout and withdrawal fees
- transaction costs
- project/item costs
- hosting/software/business costs
- refunds, chargebacks, reversals, and disputes
- money already allocated or spent
- net profit-like remainder after recorded costs

The goal is to avoid accidentally treating money as free income when it was immediately spent on platform costs, project costs, transaction costs, or other stream/business expenses.

## Core Principles

- Record gross amounts before fees.
- Record every fee and cost as its own entry, not as an invisible subtraction.
- Keep immutable source records; use adjustment/correction entries instead of editing history.
- Store money in integer minor units, such as cents.
- Keep reporting private/admin-first until wording and legal/accounting review are ready.
- Make exports useful to an accountant, tax advisor, or government audit.
- Separate bookkeeping records from public transparency summaries.

## Dated Rules

Provider rules and split rules should be versioned by effective date.

This matters because third-party terms can change without warning. For example, a donation platform might suddenly add a 10% cash-out fee that did not exist when earlier donations arrived.

The admin should be able to create dated rule versions such as:

- platform fee percentage from a start date
- fixed transaction fee from a start date
- payout/cash-out fee from a start date
- currency conversion fee from a start date
- platform revenue split estimate from a start date
- streamer share estimate from a start date
- tax/VAT handling note from a start date
- manual override/correction reason

Reports should be able to apply rules by event date, payout date, or manual accounting date depending on the report type.

Retroactive rule application should not silently rewrite history. If a rule is added later, the system should show when it was created, who created it, what period it affects, and which report uses it.

## Data Needed

- raw incoming support/payment records
- offline provider support/payment records
- provider/source id and provider event id
- gross amount and currency
- provider/platform fee records
- payout/withdrawal fee records
- transaction cost records
- currency conversion records
- refunds, chargebacks, reversals, and disputes
- project/item allocation records
- spending/cost records
- receipt/invoice attachment metadata
- dated provider rule versions
- dated split rule versions
- manual correction entries
- report generation metadata
- export files or export audit records

## Build Requirements

- immutable ledger or ledger-like event store
- admin income entry/import view
- admin cost entry/import view
- dated provider rule management
- dated split/fee rule management
- manual adjustment/correction workflow
- private report builder
- report export to CSV at minimum
- period filters, such as month, quarter, year, custom range
- source filters, such as direct donation, Twitch, YouTube, affiliate, sponsorship, wishlist, manual
- project/item filters
- gross/net summaries
- warnings for unmapped income, missing fees, missing cost category, missing receipt, or rule gaps
- audit log for rule changes and report exports

## Example Flow

1. A donation platform receives EUR 100.00.
2. The platform takes EUR 3.50 payment processing fee.
3. Later, cashing out costs another 10%.
4. The system records the gross income, processing fee, payout fee, allocation target, and final net amount as separate entries.
5. If the 10% cash-out rule was only discovered later, Michael can add a dated payout-fee rule and regenerate the report with the new rule clearly marked.

## Reporting Views

Private admin reports should answer:

- What came in during this period?
- What source did it come from?
- What fees were charged?
- What costs were recorded?
- What was allocated to projects or items?
- What was spent, reserved, refunded, reversed, or disputed?
- What remains unallocated or profit-like after recorded costs?
- Which rows are estimates rather than confirmed provider amounts?
- Which rules were applied to this report?

Public transparency pages should stay simpler. They can show project outcomes, public withdrawals, broad spending summaries, and trust-building explanations without exposing private accounting detail, receipts, tax-sensitive notes, or user-private data.

## Safety Boundaries

- Do not present reports as official tax filings.
- Do not auto-calculate tax owed as if it were legal advice.
- Do not silently change historical ledger entries.
- Do not mix simulated/test support with real money reports.
- Do not expose private receipts, provider ids, chargeback details, or personal donor data publicly.
- Do not treat Twitch/YouTube platform support estimates as confirmed direct money unless the provider payout confirms it.
- Do not drop provider support events just because the streamer was offline.

## First Safe Implementation Slice

The first implementation should be private/admin-only and manual-first:

- ledger schema for real income/cost/report rows
- dated rule schema
- manual entry forms for income, fees, and costs
- CSV export for a selected period
- warnings for missing categories/rules

Provider imports, payment checkout, automatic tax logic, public money pages, and provider write actions can come later.

## Open Questions

- Which cost categories are needed for Dutch accounting?
- Should the system support receipt uploads now, or only receipt references first?
- Should reports use event date, payout date, invoice date, or accounting date by default?
- How should platform-derived estimates be corrected once actual payouts arrive?
- Should a tax advisor review the report columns before implementation?
- Which export format is most useful first: CSV, XLSX, PDF summary, or all of them?
- How should shared costs be split across projects, streams, and general platform operations?

Related cards:

- [Payment Provider and Money Reality Check](payment-provider-and-money-reality-check.md)
- [Transparent Money Flow and Donation Revocation](transparent-money-flow-and-revocation.md)
- [Public Withdrawals and Project Archives](public-withdrawals-and-project-archives.md)
- [Mock Support and Payment Simulator](mock-support-payment-simulator.md)
