# File Structure and Code Organization

## Goal

The codebase should be easy to navigate. A developer should be able to find the relevant file for a feature or concept in one minute or less.

The structure should feel familiar enough for someone who likes Java or C#, while still using TypeScript's strengths.

## Preferred Shape

Use a TypeScript monorepo with separate apps and shared packages.

```txt
apps/
  web/
  overlay/
  control-panel/
  api/

packages/
  domain/
  events/
  integrations/
  themes/
  ui/
  config/
  testing/
```

## App Responsibilities

```txt
apps/web/
```

Public website, landing pages, profiles, projects, blog, links hub, schedules, policies, and normal user/admin pages.

```txt
apps/overlay/
```

OBS browser-source overlay renderer.

```txt
apps/control-panel/
```

Live stream control surface for overlays, emergency clean mode, test events, AI mute, chat visibility, and stream-time controls.

```txt
apps/api/
```

Backend/API server if the chosen framework does not already provide this inside `web`.

## Package Responsibilities

```txt
packages/domain/
```

Core business types and rules. Examples: users, projects, money, profiles, schedules, safety, policies.

```txt
packages/events/
```

Typed events used by overlays, chat, stream goals, notifications, AI, simulator, and control panel.

```txt
packages/integrations/
```

External platform adapters. Examples: Twitch, YouTube, Discord, Patreon, OAuth providers, stores, wishlist providers.

```txt
packages/themes/
```

Theme contract, theme metadata, and CSS theme files.

```txt
packages/ui/
```

Shared UI components used by the website, admin/action panel, and control panel.

```txt
packages/config/
```

Shared config, environment parsing, constants, and feature flags.

```txt
packages/testing/
```

Fake events, event replay fixtures, local stream simulator helpers, and shared testing utilities.

## Domain-first Folder Rule

Inside packages, organize by domain first, not by technical file type.

Preferred:

```txt
packages/domain/src/projects/
  project.types.ts
  project-category.types.ts
  milestone.types.ts
  project.rules.ts
  project.service.ts
  project.test.ts

packages/domain/src/identity/
  user.types.ts
  linked-account.types.ts
  provider-capability.types.ts
  identity.rules.ts
  identity.service.ts
```

Avoid:

```txt
packages/domain/src/types/
packages/domain/src/services/
packages/domain/src/models/
packages/domain/src/utils/
```

Those folders become junk drawers too quickly.

## TypeScript Style

Use TypeScript in a data-first, type-safe style.

Prefer:

- `type` and `interface` for data shapes
- discriminated unions for event types, project types, and ledger entries
- plain functions for business rules
- runtime validation for external/untrusted input
- service classes or service objects only when dependencies/state matter

Avoid:

- making every concept a class
- one giant shared `types.ts`
- broad utility files
- circular imports between domains
- magic strings for important event/type names

## Naming Rules

Use predictable file names:

- `*.types.ts` for TypeScript types and interfaces
- `*.schema.ts` for runtime validation schemas
- `*.rules.ts` for pure business rules
- `*.service.ts` for dependency-aware operations
- `*.events.ts` for event definitions
- `*.test.ts` for tests
- `index.ts` only as a small public export surface

Examples:

```txt
project.types.ts
project.schema.ts
project.rules.ts
project.service.ts
project.test.ts
```

## Import Boundaries

Rules should be strict:

- apps can import packages
- packages should not import apps
- `domain` should not import UI
- `events` should not depend on app code
- integrations can depend on domain/events types, but domain should not depend on integrations
- UI components should receive typed props and avoid knowing business rules

## Automation Idea

Create a rule checker later that verifies:

- files follow naming rules
- domains do not import forbidden layers
- no giant `utils` or `types` folder appears
- public exports are intentional
- event names come from typed definitions
- package boundaries are respected

This can start as lint rules and simple scripts, then become stricter over time.

The rule checker should also support a daily workflow: record violations in a report, then start the next work session by reviewing that report before new feature work.

Suggested report:

```txt
reports/rule-violations.md
```

## Git Strategy

Recommended start:

1. Initialize git after the planning docs are in place.
2. Make the first commit the planning baseline.
3. Scaffold the actual monorepo in a second commit.
4. Commit one small feature or foundation step at a time.

Do not create many empty code files just to have a structure commit. Empty files make the repository look organized without proving the structure works.

For early solo development, commit directly to `main` with small, focused commits. Branches are not required while the site is not live or in testing.

Start using branches when:

- the site is live
- the site is in serious testing
- real users or real data are involved
- a change is risky, experimental, or long-running
- a change may leave the project broken for more than one commit

Once branches are introduced, use pull-request-style reviews even if the review is self-review.

## Open Questions

- Should `api` be a separate app, or part of the web framework?
- Should `control-panel` and admin/action panel live in one app or separate apps?
- Which monorepo tool should be used?
- Which architecture rule checker should be used first?
