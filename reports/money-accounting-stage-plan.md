# Money Accounting Stage Plan

Updated: 2026-07-09

## Purpose

Design the private money/accounting foundation before public payment behavior exists.

The first goal is not public donations. The first goal is to record every cent in and out, preserve why each amount exists, keep real money separate from simulated/test value, and generate exportable private reports for accounting review.

This is planning only. It does not approve payment provider integrations, checkout, donation buttons, provider settlement, public money pages, production behavior, secrets, migration generation/application, commits, pushes, or deploys.

## Principles

- Store amounts as integer minor units with an explicit currency or value source.
- Record gross income, fees, costs, payouts, allocations, refunds, reversals, disputes, and corrections as separate ledger facts.
- Keep source records immutable; correct with append-only correction entries.
- Separate real money from provider sandbox, simulated support, and local test rows at schema and report-filter level.
- Treat platform-derived support such as Bits, subs, memberships, boosts, or Patreon-style values as estimated support until provider payout confirms actual money.
- Version fee, split, and estimate rules by effective dates and audit when the rule was created.
- Keep reports private/admin-first and avoid presenting any report as official tax advice or an official tax filing.
- Keep public transparency summaries separate from private accounting detail.

## Stage Plan

### Phase C2: Generated Migration Only

Generate the database migration for the private accounting foundation, then stop for coordinator review.

The migration should cover:

- append-only ledger transactions and ledger lines
- real/test/simulated/provider-sandbox separation
- source references for manual entries, provider intake rows, future provider payment ids, projects, items, reports, and corrections
- dated fee/split/estimate rule versions
- report/export audit metadata
- warning state for unmapped or incomplete accounting rows
- receipt/invoice attachment metadata only, not file upload behavior

No runtime API, UI, imports, checkout, donation buttons, provider settlement, public reports, production behavior, secrets, Cloudflare/Docker config, commit, push, or deploy.

### Phase C3: Private Manual Admin Entry

After the migration is reviewed and applied by the coordinator, add owner-only manual entry screens.

First screens:

- `/admin/money/ledger`: dense ledger list with source, money mode, amount, currency, category, status, correction state, and warnings.
- `/admin/money/income`: manual gross income, fee, payout, refund, reversal, dispute, and platform-derived estimate entry.
- `/admin/money/costs`: manual costs, receipts/references, project/item allocation, and hosting/software/general platform costs.
- `/admin/money/rules`: dated provider fee, payout fee, currency conversion, platform split, streamer share, and estimate rule versions.
- `/admin/money/corrections`: append-only correction workflow with required reason and linked original row.

Keep it private/admin-only. No public donation/support behavior.

### Phase C4: Private Reports And Exports

Add private report builder and CSV export first.

Reports should support:

- month, quarter, year, and custom period filters
- source filters such as manual, direct donation, Twitch, YouTube, Discord, affiliate, sponsorship, wishlist, and provider-derived estimate
- money-mode filters that default to real money only
- project/item/category filters
- gross income, fees, costs, payouts, allocations, refunds, disputes, and profit-like remainder
- estimated versus confirmed values
- warnings for unmapped income, missing fees, missing cost category, missing receipt/reference, missing allocation, rule gaps, mixed money modes, and unconfirmed platform estimates
- export audit records that store filters, generation time, rule versions used, warning counts, and file metadata or checksum

Do not claim official tax liability. The report is an accounting review aid.

### Phase C5: Provider Imports And Reconciliation

Only after manual entry and reports work, add imports or provider reconciliation.

Possible safe order:

1. CSV import preview with no write until owner confirms mapping.
2. Provider intake row linking for already logged support events.
3. Provider payout import or manual payout confirmation.
4. Estimate-to-actual reconciliation for platform-derived support.

Payment checkout, provider settlement, refunds through provider APIs, recurring support management, public pages, and provider write actions remain separate gates.

### Phase C6: Public Donation/Support Gate

Public donation/support behavior can start only after the hard gates below are complete.

The first public slice should still be small: approved support destination and wording, private ledger write path, previewed terms/refund copy, and fail-closed reporting separation.

### Phase C7: Public Transparency, Revocation, And Archives

After real money behavior exists and is proven privately, public surfaces can show simplified transparency:

- project-level raised/spent/withdrawn summaries
- public withdrawals without private provider ids, receipts, addresses, or donor-sensitive details
- completed project archives
- user donation history and money trail
- revocation or redirect requests when project direction materially changes

This must not expose private accounting rows directly.

## Minimal Phase C2 Schema Shape

The migration should stay minimal but complete enough that later runtime code does not need to rewrite money history.

### `money_ledger_transactions`

Purpose: one immutable accounting event or correction envelope.

Suggested fields:

- `id`
- `transaction_type`: income, fee, payout, cost, allocation, refund, reversal, dispute, conversion, correction, report_adjustment
- `money_mode`: real, provider_sandbox, simulated, test
- `source_kind`: manual, provider_intake, provider_payment, provider_payout, project, item, report, correction
- `source_provider`: nullable Twitch, YouTube, Discord, Stripe, PayPal, Ko-fi-like, bank, manual, other
- `source_id` and `source_event_id`: nullable external/internal references
- `posting_status`: draft, posted; posted rows are immutable
- `occurred_at`, `accounting_at`, `created_at`, `created_by_user_id`
- `corrects_transaction_id`: nullable link to the original row when this is a correction
- `correction_reason`: required for correction rows
- `notes_private`

### `money_ledger_lines`

Purpose: the amount rows that make each transaction auditable and reportable.

Suggested fields:

- `id`, `transaction_id`
- `line_kind`: gross_income, provider_fee, payout_fee, transaction_cost, platform_split, streamer_share_estimate, cost, payout, allocation, refund, chargeback, reversal, currency_conversion, correction_delta
- `direction`: in, out, neutral
- `amount_minor`
- `currency`: ISO currency for real money rows
- `value_source`: eur, site_credit, restricted_credit, twitch_bits_estimate, twitch_sub_estimate, youtube_membership_estimate, discord_boost_estimate, other_estimate
- `is_estimate`
- `category_key`
- `project_id`, `project_item_id`, or future allocation target references
- `rule_version_id`: nullable dated rule applied to the line
- `receipt_reference_id`: nullable
- `notes_private`

Reports must reject or loudly warn when a single report mixes incompatible `money_mode` values or treats estimates as confirmed cash.

### `money_rule_versions`

Purpose: dated provider fee, payout, split, conversion, and estimate rules.

Suggested fields:

- `id`
- `rule_kind`: platform_fee, fixed_transaction_fee, payout_fee, currency_conversion_fee, platform_split, streamer_share_estimate, tax_or_vat_note, manual_override
- `provider`
- `value_source`
- `effective_from`, `effective_until`
- `applies_to_date_basis`: event_date, payout_date, accounting_date
- `percentage_bps`, `fixed_amount_minor`, `fixed_currency`, or structured rule payload
- `created_at`, `created_by_user_id`
- `change_reason`
- `supersedes_rule_id`

Rules are not a license to rewrite old ledger rows silently. Reports may apply a later-created rule to a historical period only when the report metadata records that fact.

### `money_receipt_references`

Purpose: attachment/reference metadata without file storage behavior.

Suggested fields:

- `id`
- `reference_type`: receipt, invoice, provider_statement, bank_statement, note
- `storage_kind`: external_url, local_reference, future_upload
- `label`
- `private_reference`
- `created_at`, `created_by_user_id`

### `money_report_exports`

Purpose: audit each generated report/export.

Suggested fields:

- `id`
- `report_kind`: accounting_summary, source_breakdown, project_breakdown, tax_review_export, warning_review
- `period_start`, `period_end`
- `filters_json`
- `rule_version_ids_json`
- `warning_counts_json`
- `file_kind`: csv, xlsx, pdf_summary, none
- `file_reference` or `file_checksum`
- `generated_at`, `generated_by_user_id`

### `money_accounting_warnings`

Purpose: review queue for incomplete or risky accounting rows.

Suggested fields:

- `id`
- `target_kind`: transaction, line, rule, report
- `target_id`
- `warning_kind`: unmapped_source, missing_fee, missing_category, missing_receipt, missing_allocation, rule_gap, estimate_unconfirmed, mixed_money_mode, provider_payout_missing, correction_needed
- `severity`: info, warning, blocking
- `status`: open, acknowledged, resolved
- `created_at`, `resolved_at`, `resolved_by_user_id`

## Hard Gates Before Public Donation/Support

- Michael approves the payment provider choice and Netherlands-specific provider reality check.
- Refunds, partial refunds, chargebacks, disputes, recurring support, credits, and payout restrictions are documented.
- Public donation/support terms and refund/revocation wording are reviewed.
- The private ledger migration is reviewed, applied by the coordinator, and tested with manual entries.
- Reports and CSV exports show gross income, fees, costs, payouts, allocations, profit-like remainder, and warnings.
- Real money reports exclude simulated/test/provider-sandbox rows by default and cannot silently mix them.
- Dated rules can be created, audited, and applied in reports without mutating historical ledger entries.
- Correction entries are append-only and require reason, actor, and original-row links.
- Provider-derived estimates are clearly labeled until actual payout data confirms them.
- Backup/export/restore expectations are documented before storing production money history.
- Owner/admin permission boundaries are reviewed so helpers/moderators cannot access private accounting by accident.
- Public pages have approved wording and expose only summary-safe transparency, not private provider ids, receipts, chargebacks, tax notes, or donor-sensitive data.

## Phase C2 Non-Goals

- No payment provider integration.
- No checkout.
- No public donation/support button.
- No provider settlement or refund API calls.
- No credits/balances runtime.
- No public money pages.
- No real production behavior.
- No secrets, Cloudflare, Docker, deployment, auth, or moderation changes.
