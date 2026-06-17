# Manual Admin Content Tools

## Idea

Create owner/admin pages for manually managing the website's core content before adding AI-assisted workflows.

The first admin surfaces should cover:

- projects
- milestones
- non-monetary project items
- Creator Hub links
- basic update/blog drafts
- schedule entries later
- affiliate/context/accountability pages later

## Why It Matters

Seed files are useful for development, but the site should not depend on code edits or AI prompts to update normal content.

AI can help draft text, summarize notes, or suggest structure later, but Michael needs a clear manual workflow first. That keeps the platform trustworthy and understandable, and it avoids accidentally letting generated content become the source of truth.

## Build Requirements

- authenticated owner/admin access
- URL-token gate if the page is considered a privileged tool surface
- role permission checks
- forms for creating and editing records
- explicit publish/unpublish controls
- preview before public visibility changes
- action/audit history for important changes
- validation shared with public read models where possible
- mobile-safe layout for small emergency edits

## First Version Scope

Start with simple manual admin pages for non-money project content:

- create/edit project basics
- mark project public/private
- create/edit milestones
- create/edit non-monetary project items
- reorder milestones and items
- no donations, funding, ledgers, credits, or wishlist provider integrations

Creator Hub link editing can follow as a second admin slice.

## AI Boundary

AI assistance should start as draft-only:

- generate suggested copy
- summarize raw notes
- suggest categories or milestones
- never publish without explicit owner approval
- never make money/support/legal changes automatically

## Open Questions

- Should admin pages live under `/admin/*`, `/tools/*`, or both?
- Should project admin require a URL token plus login, or login plus owner role only?
- Which edits should create Action Panel review items?
- Which admin changes should appear in public accountability history?

