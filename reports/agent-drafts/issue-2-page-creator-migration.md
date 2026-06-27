# Issue #2 Chunk 23: Page Creator Persistence Migration

Worker: B
Branch: `dev`
Date: 2026-06-26

## Outcome

Generated, but did not apply, the Page Creator persistence migration for path-owned manual website pages.

Generated migration:

- `packages/database/drizzle/0013_lowly_justin_hammer.sql`

## Changed Files

- `packages/database/src/database.schema.ts`
- `packages/database/drizzle/0013_lowly_justin_hammer.sql`
- `packages/database/drizzle/meta/0013_snapshot.json`
- `packages/database/drizzle/meta/_journal.json`
- `reports/agent-drafts/issue-2-page-creator-migration.md`

## Schema Shape

Added `content_pages` with:

- `title`
- inert/default `route_scope` locked to `primary`
- `normalized_path`
- `status` as `draft` or `published`
- `visibility` as `hidden` or `public`
- `seo_title` and `seo_description`
- `body`
- `created_by_user_id` and `updated_by_user_id`
- `published_at`, `created_at`, and `updated_at`

The `route_scope` plus `normalized_path` uniqueness leaves a direct path toward later host plus path ownership without enabling host/subdomain routing in this slice.

## Indexes And Checks

Added:

- `content_pages_route_key_uidx` on `route_scope`, `normalized_path`
- `content_pages_public_lookup_idx` on `route_scope`, `normalized_path`, `status`, `visibility`
- `content_pages_admin_listing_idx` on `status`, `visibility`, `updated_at`
- `content_pages_created_by_user_idx` on `created_by_user_id`
- `content_pages_route_scope_check`
- `content_pages_normalized_path_check`
- `content_pages_draft_visibility_check`
- `content_pages_published_at_check`

Safety defaults:

- New rows default to `draft` and `hidden`.
- Draft rows cannot be `public`.
- Published rows require `published_at`; draft rows require `published_at` to be null.
- `route_scope` is constrained to `primary` so this migration does not introduce host/subdomain behavior.

## Checks Run

- `corepack pnpm --filter @maiks-yt/database db:generate`
- `corepack pnpm --filter @maiks-yt/database typecheck`
- `node scripts/check-architecture.mjs`
- `git diff --check`

## Skipped Checks

- Migration application was intentionally skipped.
- Runtime route/admin/API/browser checks were out of scope because this slice adds no runtime behavior.

## Suggested Tracker Updates

- Mark Chunk 23 as generated/unapplied once reviewed.
- Keep Page Creator runtime admin, public catch-all routing, host/subdomain routing, Cloudflare/DNS/Docker/deploy work, auth changes, AI, and money/legal workflow gated for later scoped chunks.

## Unresolved Risks

- Reserved/code-owned route collision enforcement still needs future runtime/admin validation before any public route serving.
- Later host/subdomain routing will need a separate reviewed schema/runtime slice; this migration only preserves a route-scope extension point.
