# Page Creator and Route Admin

## Idea

Create an owner/admin page creator so Michael can create and edit normal website pages without programming each page.

Each page should be assignable to a URL path, and later possibly a host/subdomain plus path, for example:

- `maiks.yt/privacy`
- `maiks.yt/context`
- `maiksmc.maiks.yt/`
- `maiksmc.maiks.yt/rules`
- future channel or project landing pages

The first version should assume DNS, Cloudflare, and reverse-proxy/subdomain pointing are handled manually. Automating subdomain setup can be a later infrastructure feature.

## Why It Matters

Michael needs to update the site as a creator platform, not as a codebase every time. Some pages will be core platform pages, some will be channel-specific, some will be policy/context pages, and some may be temporary campaign or project pages.

A page creator keeps normal content changes in the admin UI and preserves the pattern already used for projects, links, schedules, and project updates: manual owner control first, AI assistance later.

## First Version Scope

Start with manual, owner-gated page records:

- page title
- slug or path
- optional host/subdomain selector or plain host field
- body/content sections
- status: draft or published
- visibility/publish toggle
- preview-before-publish
- simple SEO title/description
- updated/published timestamps

Public rendering should only show published/visible pages.

## Boundaries

Do not start by editing every existing hardcoded route. Some platform pages should remain code-owned if they contain important app behavior.

Good candidates for page-admin ownership:

- channel landing pages
- hobby/game pages
- simple policy/context pages
- campaign pages
- static informational pages
- future custom project landing pages

Code-owned or special-case pages for now:

- account/auth pages
- admin pages
- control panel/tools
- overlay pages
- API routes
- money/legal pages until wording and approval rules are clear
- pages with complex live data until a block/component model exists

## Route Ownership Rules

The page creator needs route collision rules before implementation:

- reserved paths cannot be claimed by page records
- admin/tool/API/overlay paths are reserved
- host plus path should be unique
- draft pages should not publicly claim a route unless previewed through admin
- public page routing should fail closed when ambiguous

## Future Subdomain Automation

Later, the platform could help provision subdomains through Cloudflare or deployment config.

That is not first-version scope.

For now, Michael can point subdomains manually, then the page admin can decide which page responds for that host/path.

## AI Boundary

AI can later help draft, summarize, or suggest page sections, but manual admin editing and preview-before-publish should exist first.

AI should not publish pages automatically.

## Open Questions

- Should first version store pages as rich text, Markdown, or structured blocks?
- Should host routing be in the first migration, or should first version only support paths under `maiks.yt`?
- Which current hardcoded pages should remain code-owned permanently?
- Should page changes create Action Panel review items or audit history?
- Should page records support reusable blocks/components later?
