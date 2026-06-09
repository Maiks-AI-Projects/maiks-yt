# Development Rule Monitoring Automations

## Idea

Create project-local automations that check whether V2 is still following its own rules.

The automation can run at the end of a work session, overnight, or before starting the next session. It records violations so the next work session starts by reviewing and fixing them before continuing.

## Why It Matters

This project has many explicit rules:

- clear file structure
- domain-first folders
- import boundaries
- typed event contracts
- no broad junk-drawer folders
- no unreviewed AI publishing
- minimal analytics
- no direct money features in version one
- low-distraction control panel defaults
- privacy-first defaults

Without automated checks, rules slowly become memory-based and drift happens.

## What It Can Check

Early checks:

- file naming conventions
- forbidden folders such as broad `utils`, `types`, or `models` junk drawers
- app/package import boundaries
- missing tests for domain rules
- unlinked idea cards
- TODO items changed without roadmap updates
- public money feature code added before money prep is complete
- unsafe environment variable usage
- raw dev server exposure in production scripts

Later checks:

- accessibility checks
- overlay layout screenshot checks
- localization missing keys
- privacy/deletion coverage
- analytics event allowlist violations
- AI behavior without approval/draft mode
- role/permission gaps

## Daily Workflow

Suggested workflow:

1. End work session.
2. Run rule checks manually or automatically.
3. Save violations to a local report.
4. Next work session starts by reading the report.
5. Fix or intentionally defer violations before new feature work.

## Data Needed

- rule definitions
- violation records
- severity
- file path
- related checklist item
- first detected time
- last detected time
- status, such as open, fixed, ignored, deferred
- notes explaining intentional exceptions

## Build Requirements

- rule-check script
- violation report file
- optional HTML/Markdown report
- checklist integration
- CI/pre-commit option later
- clear severity levels
- ability to mark intentional exceptions

## Suggested Report Location

```txt
reports/rule-violations.md
```

This file can show the current open issues for the next session.

## Type-safety Notes

Rules can be represented as typed checks with stable IDs. Each violation should include a rule ID so repeated runs can update the same violation instead of creating endless duplicates.

## Open Questions

- Should checks run manually, scheduled, or both?
- Should violations block commits, or only warn during early development?
- Which rules should be enforced first?
- Should the report be committed to git or kept local?
- Should ignored/deferred violations expire and come back later?
