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

Start with manual, owner-gated page records for normal website content on the primary site path space. Version one should be path-only under the existing public web host, with host/subdomain routing stored for later only if the schema shape makes that cheap and non-operational.

- page title
- canonical path, normalized to a leading `/`
- body/content stored as simple structured sections or Markdown plus a short, typed section kind list
- status: draft or published
- visibility/publish toggle
- preview-before-publish
- simple SEO title/description
- updated/published timestamps

Public rendering should only show published/visible pages.

The first safe workflow is:

1. Owner creates a draft page under `/admin/pages`.
2. Owner edits title, path, SEO fields, and content sections.
3. Admin preview renders the page through an explicit preview URL or preview mode that never becomes the public route.
4. Owner publishes only after preview. Public routing then serves the page if, and only if, the route has a single published/visible page record and does not collide with a code-owned route.
5. Owner can unpublish without deleting the record.

## Boundaries

Do not start by editing every existing hardcoded route. Some platform pages should remain code-owned if they contain important app behavior.

Good candidates for page-admin ownership:

- channel landing pages
- hobby/game pages
- simple policy/context pages
- campaign pages
- static informational pages
- future custom project landing pages
- future about/contact-style pages that do not need special app behavior

Code-owned or special-case pages for now:

- home page until the route priority model is reviewed
- account/auth pages
- admin pages
- control panel/tools
- overlay pages
- API routes
- dev/test routes
- links hub, schedule, project list/detail, and project update routes while they depend on typed read models
- money/legal pages until wording and approval rules are clear
- pages with complex live data until a block/component model exists

Existing code-owned static pages can be migrated later one by one after the page renderer and route collision rules are proven. Migration should be explicit, not automatic.

## Route Ownership Rules

The page creator needs route collision rules before implementation:

- reserved paths cannot be claimed by page records.
- `/admin`, `/api`, `/tools`, `/dev`, `/overlay`, auth/account paths, service-worker/manifest assets, and static framework asset paths are reserved.
- known code-owned public routes stay reserved until a coordinator explicitly opens them for page-record ownership.
- version one public routing is path-only on the current website host; later routing can use host plus path.
- route uniqueness should be enforced by normalized host scope plus normalized path, with path-only records scoped to the primary host.
- draft pages do not publicly claim a route; preview must use an admin-only preview path, token, or mode.
- if zero published records match, public routing falls through to code-owned routes or 404.
- if more than one published record could match, public routing fails closed instead of guessing.
- route matching should be exact in version one. Wildcards, nested catch-alls, redirects, and aliases are later features.

The route lookup order should be conservative:

1. Hardcoded reserved/code-owned routes win.
2. Page-record routes can serve only non-reserved paths.
3. Ambiguity returns a closed error/404 and should be visible in admin validation.

Admin validation should warn before save and block publish when the proposed public path is reserved, duplicated, malformed, or ambiguous.

## Minimal Schema Gate

A future implementation likely needs a generated migration before code work. Do not generate it until the coordinator approves the shape.

Minimal path-only schema shape:

- `content_pages`: `id`, `title`, `path`, `status`, `is_visible`, `seo_title`, `seo_description`, `content`, `created_at`, `updated_at`, `published_at`
- optional `route_scope` or `host` field defaulting to the primary website host if the coordinator wants to avoid a later route-key migration
- unique normalized route key for published/active records, preferably scoped so later host routing can extend it without changing public behavior
- audit/update metadata only if it matches the established admin-content pattern

The first migration should not include Cloudflare zone IDs, DNS records, deployment configuration, reverse-proxy configuration, redirect automation, AI generation state, payment/legal approval state, or provider integration fields.

## Future Subdomain Automation

Later, the platform could help provision subdomains through Cloudflare or deployment config.

That is not first-version scope.

First version should not rely on host/subdomain automation. Michael can keep DNS, Cloudflare, and reverse-proxy pointing manual while page routing proves itself on primary-site paths.

Later host/subdomain support can add:

- host plus path route ownership
- explicit allowed-host records
- manual "this host is already pointed here" confirmation
- eventual Cloudflare automation after a separate infrastructure/security review

## AI Boundary

AI can later help draft, summarize, or suggest page sections, but manual admin editing and preview-before-publish should exist first.

AI should not publish pages automatically.

AI must not finalize money, legal, abuse-policy, privacy, support, or sponsor wording without explicit owner approval.

## Out Of Scope For First Version

- authentication or role model changes
- Cloudflare, DNS, Docker, reverse-proxy, or deployment changes
- migration generation/application during this design gate
- production route behavior changes
- AI auto-publishing
- money/legal final wording or support-destination approval
- redirect management, wildcard routes, aliases, or subdomain provisioning
- reusable block marketplace or complex live-data components

## Open Questions

- Should content be stored as Markdown with typed front matter, or as a small structured section JSON field?
- Should the first migration include an inert/default host field for future uniqueness, or stay strictly path-only?
- Which current hardcoded static pages should be first candidates for explicit migration after the renderer exists?
- Should page publish/unpublish changes create Action Panel review items, audit history, or both?
- Should reusable blocks/components wait until after several real manual pages exist?
