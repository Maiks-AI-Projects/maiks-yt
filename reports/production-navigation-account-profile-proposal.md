# Production navigation, account, and profile proposal

Date: 2026-08-28
Target proved before writing: `/home/michael/Documents/Codex/maiks-yt-production`, branch `production`, remote `https://github.com/Maiks-AI-Projects/maiks-yt.git`.

This is a production proposal and acceptance contract only. It does not approve UI implementation, image generation, migration application, live handle assignment, account mutation, provider disclosure, deployment, or live verification.

## Outcome

Build one image-first direction for the public header, signed-in account menu, and real profile direction before source implementation starts.

The accepted design must keep the site compact and useful. It should feel like Maiks.yt: dark production canvas, mint accent, strong type, restrained borders, tight density, and real destinations. No marketing hero treatment, no white developer panels, no gradients, no decorative blobs, no cards inside cards, no fake locks pretending a feature works, and no menu dominated by email.

## Proven current behavior

Source checked in the production worktree on branch `production`.

- `apps/web/src/app/site-navigation.tsx` renders a flat public header: `Schedule`, `Games`, `Projects`, `Updates`, `Creator links`, `Build progress`, `About`.
- `apps/web/src/app/layout.tsx` puts the account control after the public nav and uses a small footer with `Build progress`, `About Michael`, `Community rules`, `Accountability`, and `Privacy`.
- `apps/web/src/app/oauth-login-panel.tsx` renders the current account dropdown. Signed-in state shows a provider-shaped identity, a message, the provider email, `Refresh`, and `Sign out`. It has no destinations.
- `apps/api/src/account/account-response-projection.service.ts` exposes `/account/session` as provider name, provider email, and provider image. This is not acceptable for the new account-menu identity.
- `apps/api/src/account/account-domain.route.ts` and `apps/api/src/account/account-profile.route.ts` expose safer account-domain data: stored display name, profile visibility, managed avatar URL, linked-account count, profile update, managed image upload/removal, and provider-profile copy into the managed profile.
- `apps/web/src/app/authenticated-navigation.tsx` always includes `/tools/notifications` for any signed-in user, then adds `/admin` by probing `/admin/provider-integrations/status`. This incorrectly exposes Notifications to users who may not have `notifications:manage`, and it uses an owner-status proxy rather than an authoritative navigation projection.
- `apps/api/src/control-panel/control-panel-navigation.route.ts` already proves the right pattern for another surface: it combines a Control URL token, signed-in session, active role permissions, and `projectControlPanelPages`.
- `packages/domain/src/security/control-panel-navigation.rules.ts` currently maps Control pages from active permissions: core `overview`, `stream`, `overlays`; `action-panel:view` adds `actions`; `music:play-control` adds `music`; `chat:view` adds provider health; `*` adds all current Control pages.
- `packages/domain/src/notifications/notification.rules.ts` gates notification management with `*` or `notifications:manage`.
- `apps/web/src/app/profiles/page.tsx`, `apps/web/src/app/profiles/michael-public/page.tsx`, and `apps/web/src/app/profiles/michael-private/page.tsx` are static mocks. `/profiles` says every query returns two static Michael examples. There is no Web route for `/profiles/[handle]`.
- The current profile mocks show provider/social/game/activity examples from static files. They are useful evidence for rejected directions, not real profile behavior.
- `packages/domain/src/identity/public-profile-projection.rules.ts` currently contains projection rules for public/private profile shapes. Private profile detail and search projection return only account name plus the exact text `This account is set to private`.
- `packages/domain/src/identity/profile-public-identifier.rules.ts` allows canonical handle routes such as `/profiles/maiks`.
- `packages/domain/src/identity/profile-handle-normalization.rules.ts` reserves `maiks` as assignable by the Owner path. Commit `fcf1c8f` contains the reviewed generated migration/schema files. They are not applied-production evidence and no handle is reserved or assigned.
- Public Music exists at `/music` and API `GET /music/catalog` plus `POST /music/requests`. Signed-in account Music exists at `/account/music` with `GET /account/music/top-tracks`, `GET /account/music/catalog`, and `PUT /account/music/top-tracks`.
- No public or member TTS destination exists. TTS appears only as future event-routing language and private local-agent audio capability.
- Public Schedule exists at `/schedule` and API `GET /schedule`. Public schedule entries include `status`, `channelKey`, `startsAt`, `endsAt`, title, topic, focus, and public game links. `live` is a public status.
- `/channels` exists and reads the live Creator Links records, but the only current internal channel page that can be named truthfully from source is `/plays`.
- `/plays` exists and only verifies MaiksPlays Twitch and YouTube external links from Creator Links. It is not proof that every external creator link has an internal channel route.
- `apps/web/src/app/[...path]/page.tsx` serves published DB-backed Page Creator content at non-reserved paths. It resolves one requested path through `GET /pages/public?path=...`. The current public API is a single-page lookup, not a public page listing.
- Page Creator publication requires the primary route scope, `published` status, `public` visibility, a publication timestamp, and a valid non-reserved path. Code-owned route prefixes are reserved from Page Creator ownership.

## Rejected directions

- Do not keep the current flat header.
- Do not leave Creator Links in the primary header. Move it to the footer.
- Do not infer internal channel pages from Twitch, YouTube, Discord, or other external Creator Links.
- Do not show provider email anywhere in the account menu.
- Do not use OAuth/provider name, image, or email as the signed-in identity header.
- Do not expose Notifications unless the current active grants include `notifications:manage` or `*`.
- Do not infer Michael or Owner status from account name, email, provider, profile handle, or display name.
- Do not hardcode Michael's personal name. The stored public display name may be `Maiks`, and that is what the UI shows.
- Do not guess token-bearing URLs for Control, Chat, Moderation, Music player, overlays, or local-agent paths.
- Do not keep `/profiles/michael-public` or `/profiles/michael-private` as the product direction.
- Do not show provider/auth rows, operational IDs, emails, fake connection history, fake activity, fake ranks, or unreviewed provider disclosures on public profiles.
- Do not treat the fixed code-owned route list as a complete inventory of public URLs. Do not invent Page Creator titles or paths for navigation.
- Do not add a `/signup` route. The app does not have one. Use configured OAuth provider actions.

## Approved future behavior

### Public header

Desktop order:

1. `Channels` disclosure
2. `Live` disclosure
3. `Projects`
4. `Schedule`
5. `Games`
6. `About`
7. `Build progress`, only while the main build remains active
8. Visually separate account control

Mobile uses one coherent drawer or sheet. `Channels`, `Live`, and `Account` remain distinct disclosures inside it.

`Channels` currently includes only:

- `All channels` -> `/channels`
- `MaiksPlays` -> `/plays`

`Live` derives current live rows from public schedule entries whose `status` is `live`. It must not invent a live channel from external links, planned rows, or cached provider status. If there are live rows, each destination links to the safest current public route for that channel. If a channel-specific route is not implemented, link to `/schedule` with clear copy rather than inventing a URL.

Live empty state:

`No channels live`

Live failure state:

`Live status unavailable`

Retry action:

`Retry`

Music appears because `/music` is real. Anonymous public catalog/request remains `/music`; signed-in account Top 10 remains `/account/music`.

TTS is omitted until there is a real public or account destination. Once there is a real destination, TTS must remain discoverable in all account states with separate destination states:

- signed out: `Account required`
- signed in without entitlement: `Locked`
- signed in and entitled: normal destination
- service unavailable: `Unavailable`

### Footer

The footer becomes the public discovery map. It has two different sources: fixed code-owned routes and published DB-backed Page Creator routes. The fixed list alone is not the complete public URL inventory.

Required fixed code-owned footer links:

- `Updates` -> `/updates`
- `Creator links` -> `/links`
- `Community rules` -> `/community-rules`
- `Accountability` -> `/accountability`
- `Analytics privacy` -> `/privacy/analytics`
- `Context` -> `/context`
- `Interactions` -> `/interactions`
- `Languages` -> `/languages`
- `Sponsors` -> `/sponsors`
- `Support` -> `/support`
- `Affiliate disclosure` -> `/affiliates`
- `Profiles` -> `/profiles`, until the real profile search replaces the static mock
- `RSS` -> `/feed.xml`

Keep `Projects`, `Schedule`, `Games`, `About`, `Build progress`, `Channels`, `MaiksPlays`, and `Music` reachable through header, footer, page links, or both. No fake or empty footer links.

Published Page Creator routes need a separate `Pages` footer section. The current `GET /pages/public?path=...` endpoint can resolve only a path the caller already knows, so it cannot supply navigation safely. Before implementation, add a public listing projection that returns only approved navigation labels and normalized paths for pages that still satisfy the published-public projection rules. It must not return page IDs, body content, SEO fields, publication metadata, creator IDs, or draft/hidden entries.

The runtime `Pages` section has these states:

- loaded: exact title/path links returned by the public listing projection
- empty: `No published pages listed`
- unavailable: `Published page list unavailable` with `Retry`

An exact Owner-approved policy may instead exclude every Page Creator route from global navigation and leave those pages discoverable by direct link only. That policy must be recorded as a deliberate exclusion. Silent omission is not approval. Until the listing projection or that exclusion exists, the visual candidates show the unavailable `Pages` state and no fabricated page links.

### Signed-in account menu

The account menu replaces the current provider-centered dropdown with a role-aware menu backed by authoritative account and navigation data.

Identity header:

- Uses only the stored chosen public display name.
- Uses only the chosen managed profile image.
- Never uses provider name, provider image, provider email, or OAuth email.
- If the stored display name is `Maiks`, show `Maiks`. Do not hardcode why.

Unconfigured fallback:

- Neutral image
- `Set up your profile`
- Primary destination: `/account/profile`
- Secondary destination: `/account`

Identity-service error:

- Header text: `Maiks.yt account unavailable`
- Action: `Retry`
- If the signed-in session is still known, keep safe ordinary links available.
- Do not fall back to provider identity.

Every signed-in user sees:

- `Account settings` -> `/account`
- `Profile` -> `/account/profile`
- `Connections` -> `/account/connections`
- `Privacy` -> `/account/privacy`
- `Stream appearance` -> `/account/stream`
- `Music` -> `/account/music`
- `Sign out`

Add `My profile` only after the API provides a real owner-view profile path. It must appear once. It should not duplicate `Profile`, and it should not point to a mock route.

Privileged destinations:

- `Admin` appears only from active `*`.
- `Actions` appears only from active `action-panel:view` or `*`.
- `Notifications` appears only from active `notifications:manage` or `*`.
- Token-bearing `Control`, `Chat`, `Moderation`, `Music player`, `Overlay`, and local-agent URLs must not be shown unless an authoritative projection returns a safe destination for the current session. Never assemble these URLs client-side from env vars, old launch tokens, or remembered query strings.

The runtime needs one authoritative navigation projection for the main site. The menu must re-evaluate active grants on:

- menu open
- window focus return
- reconnect after offline or failed fetch
- grant mutation events or local broadcast after role changes
- explicit Retry

### Profiles

The first planned/empty profile candidates and the current static Michael mock direction are rejected and superseded.

Approved real examples:

- `/profiles/maiks`
- `/profiles/maiks-private`

Both are DB-backed examples. Use standard labels:

- `Public`
- `Private`

Public `maiks` is a rich safe example. It may show services, accounts, social links, games, profile identity, and recognition only when each field has:

- a reviewed public projection
- an explicit disclosure boundary
- consent or Owner-reviewed source authority
- no provider/auth row leakage
- no raw operational identifiers
- no emails
- no fake activity

No approved consented or Owner-authorized public-profile dataset was supplied for the current visual pass. Candidate 9 therefore uses a neutral avatar or placeholder and unavailable states for every optional profile section. It must not show a managed image or populated service, account, channel, game, social, or recognition row. A later candidate may show those only when its generation task supplies the exact approved projection data and its consent or Owner-authorization evidence.

Private `maiks-private` remains searchable and shows only:

- account name
- exact text: `This account is set to private`

Private profile search result and detail must show no image, no biography, no provider row, no social row, no game row, no activity, no badges, no counts, and no hint of hidden fields.

While there are fewer than 100 users, Michael's example profiles rank first in search. This is ranking behavior, not an account-privilege signal.

Migration files may be generated for review only when the assigned schema task authorizes it. This proposal does not authorize applying a migration, assigning a live account, reserving a handle in production, backfilling users, exposing provider data, or mutating account ownership.

### Signed-out discovery and FOMO

Signed-out users may see truthful previews and locked states for real account benefits:

- profile personalization
- Music Top 10
- TTS after a real destination exists

The preview explains what an account unlocks and offers real configured OAuth sign-in/create-account actions. It must use `/account/login/providers` and the existing provider sign-in action. There is no `/signup` route.

Signed-in users see actual entitled or runtime controls only. No fake scarcity, fake activity, invented perks, misleading countdowns, or faux-enabled controls.

Allowed labels:

- `Locked`
- `Account required`
- `Unavailable`

## Route, permission, and visibility matrix

| Destination | Current source state | Future placement | Visibility rule | Data or permission source | Gate |
| --- | --- | --- | --- | --- | --- |
| `/` | Web page exists | Brand/home link | Public | Web route | None |
| `/channels` | Web page exists, reads Creator Links | Channels dropdown and footer | Public | Creator Links read model for external channel list | Only list internal routes that exist |
| `/plays` | Web page exists | Channels dropdown and footer | Public | Web route plus verified MaiksPlays external href allowlist | Do not infer other channel routes |
| `/music` | Web page exists | Header or footer discovery, signed-out preview | Public | `GET /music/catalog`, `POST /music/requests` | Catalog may be empty or unavailable |
| `/account/music` | Web page exists | Account menu ordinary link | Signed-in | `GET /account/music/top-tracks`, `GET /account/music/catalog`, `PUT /account/music/top-tracks` | Do not show as a public playback control |
| TTS destination | No public/member route exists | Omit for now | None yet | Future route and entitlement projection | Must be added only after real route exists |
| `/projects` | Web page exists | Header and footer | Public | `GET /projects` | None |
| `/projects/[slug]` | Web dynamic route exists | Linked from project lists | Public for public slugs | `GET /projects/:slug` style read route | Slug only, no raw IDs |
| `/schedule` | Web page exists | Header, Live fallback, footer | Public | `GET /schedule` public DTO | Live menu derives only `status: live` |
| `/games` | Web page exists | Header and footer | Public | `GET /games` | Slug is public identity |
| `/updates` | Web page exists | Footer, optionally secondary public nav | Public | `GET /updates` | Header no longer needs it |
| `/updates/[slug]` | Web dynamic route exists | Linked from updates | Public for public slugs | Public Updates read model | Slug only |
| `/links` | Web page exists | Footer | Public | `GET /links` | Move out of primary header |
| `/about` | Web page exists | Header and footer | Public | Web route | None |
| `/about/health` | Web page exists | About page links and footer group | Public | Web route | Keep privacy-trimmed health boundary |
| `/about/history` | Web page exists | About page links and footer group | Public | Web route | Keep address privacy |
| `/about/ai` | Web page exists in current source | About page links and footer group | Public | Web route | Approval for exact page is separate evidence |
| `/progress` | Web page exists | Header while main build active and footer | Public | Roadmap data | Remove from header only after main build is no longer active |
| `/community-rules` | Web page exists | Footer | Public | Web route | Preserve |
| `/accountability` | Web page exists | Footer | Public | Web route | Preserve |
| `/privacy/analytics` | Web page exists | Footer as `Analytics privacy` | Public | Web route | Preserve |
| `/context` | Web page exists | Footer | Public | Web route | Add to footer |
| `/interactions` | Web page exists | Footer | Public | Web route | Add to footer |
| `/languages` | Web page exists, planned-page wrapper | Footer | Public | Planned-page definition | Add to footer |
| `/sponsors` | Web page exists | Footer | Public | Web route | Add to footer |
| `/support` | Web page exists | Footer | Public | Web route | Add to footer |
| `/affiliates` | Web page exists | Footer as `Affiliate disclosure` | Public | Web route | Add to footer |
| `/feed.xml` | Route exists | Footer as `RSS` | Public | Public Updates feed | Preserve |
| Published Page Creator paths through `/[...path]` | Web catch-all and single-path public API exist | Separate footer `Pages` runtime section | Only pages that remain published, public, timestamped, and non-reserved | Current `GET /pages/public?path=...`; future public navigation projection | Current API cannot enumerate; use no links until a safe listing exists or the Owner approves direct-link-only exclusion |
| `/profiles` | Static mock page exists | Footer until real search ships | Public | Current static Web route | Replace, do not polish the mock as final |
| `/profiles/michael-public` | Static mock page exists | Do not promote | Public mock | Static files | Superseded by `/profiles/maiks` |
| `/profiles/michael-private` | Static mock page exists | Do not promote | Public mock | Static files | Superseded by `/profiles/maiks-private` |
| `/profiles/maiks` | Domain route path is allowed, Web route missing | Future profile detail | Public | DB-backed profile projection | Needs API, route, data, image approval, and assignment gate |
| `/profiles/maiks-private` | Web route missing | Future profile detail | Public searchable private projection | DB-backed profile projection | Needs API, route, data, image approval, and assignment gate |
| `/account` | Web page exists | Account menu ordinary link | Signed-in for management, signed-out prompt allowed | `/account/session`, `/account/domain` | Menu identity cannot use provider fields |
| `/account/profile` | Web page exists | Account menu ordinary link | Signed-in | `/account/domain/profile`, image routes, provider copy action | Menu setup fallback points here |
| `/account/connections` | Web page exists | Account menu ordinary link | Signed-in | Auth accounts, linked accounts, configured provider list | No provider email in account-menu header |
| `/account/privacy` | Web page exists | Account menu ordinary link | Signed-in | `/account/domain/profile-visibility` | Real profiles still separate |
| `/account/stream` | Web page exists | Account menu ordinary link | Signed-in | `/account/stream-visibility-preferences` | Controls only website stream-visible identity moments |
| `/tools/notifications` | Web tool page exists | Account menu privileged link only | `notifications:manage` or `*` | Active grants from authoritative projection | Current account subnav is wrong |
| `/actions` | Web page exists and API is signed-in/permission-gated | Account menu privileged link | `action-panel:view` or `*` | Active grants from authoritative projection | No token guessed |
| `/tools/actions` | Standalone PWA page exists | Not a normal header link | Same as Actions if projected | Active grants plus route policy | Use only if projection chooses this destination |
| `/admin` | Web admin exists | Account menu privileged link | `*` only for this menu | Active grants from authoritative projection | Do not infer via owner name/email |
| `/control`, `/chat`, `/moderation`, `/music/player` | Routes or surfaces exist, but access depends on tokens/session/runtime | Do not show unless projected | Projection-owned | Authoritative safe-destination projection | Never construct token URLs |

## Required data and API work before UI implementation

1. Add a main-site navigation projection. It should return one finite, strict DTO for the current session and ordinary public state. Suggested route name: `GET /account/navigation`, but the final name is an implementation decision.
2. The projection must combine session state, domain user state, managed display name, managed avatar, configured provider actions, active role grants, and safe destinations. It must not return provider email, provider image, raw auth user ID, raw domain user ID, role IDs, linked-account IDs, provider account IDs, token values, or permission arrays as browser-facing data.
3. The server projection must report only authoritative current-session and account availability states: `signed_out`, `signed_in`, `unconfigured`, `expired`, `identity_unavailable`, and `privilege_unavailable`.
4. The browser owns interaction states that exist only while it fetches or performs sign-out: `checking`, `sign_out_busy`, and `sign_out_error`. These states wrap server responses and must not appear in the server projection DTO.
5. Privileged menu items must be server-projected from active grants. The client should render the returned menu. It should not derive privileges from names, provider state, or successful owner-only endpoint probes.
6. The projection must re-read grants on menu open, focus return, reconnect, grant mutation, and Retry. Cache only short-lived positive data, and fail closed for privileges while preserving ordinary signed-in links when the session is known.
7. Add a public header schedule helper that derives live channels from the public schedule DTO. It must handle loaded live, loaded empty, and unavailable states without creating durable data.
8. Add a public Page Creator navigation projection before the footer can list runtime pages. A suggested route is `GET /pages/public/navigation`, but the final name is an implementation decision. It returns an ordered list of `title` and normalized `path` only for primary-scope pages accepted by the existing published-public projection rules. It must exclude IDs, body, SEO fields, timestamps, creator/editor IDs, drafts, hidden pages, and reserved paths.
9. The Page Creator navigation projection must distinguish loaded, empty, and unavailable results. The browser may offer `Retry` for unavailable results and must replace links after publication mutations or the next projection refresh. It must never preserve an unpublished page as a stale footer link.
10. An Owner-approved direct-link-only exclusion may replace the listing projection. The approval must either cover all current and future Page Creator publications or enumerate the exact excluded paths and the rule for newly published pages. It must also define the footer copy. Without that approval, missing runtime-page links remain an unresolved data gate.
11. Add a real profile search/detail API before replacing `/profiles`. It must use DB-backed handle/profile projection, rank Michael's examples first while there are fewer than 100 users, and enforce the private projection exactly.
12. Add a real owner-view profile path before adding `My profile` to the account menu.
13. Add a reviewed public projection for each rich public-profile section before showing it on `/profiles/maiks`.
14. Add a real TTS destination and entitlement/runtime projection before TTS appears in navigation.

## Copy contract

Header labels:

- `Channels`
- `Live`
- `Projects`
- `Schedule`
- `Games`
- `About`
- `Build progress`
- `Account`

Channels menu:

- `All channels`
- `MaiksPlays`

Live menu:

- Empty: `No channels live`
- Failure: `Live status unavailable`
- Action: `Retry`
- Live row fallback destination text: `Open schedule`

Runtime Pages footer section:

- Section label: `Pages`
- Empty: `No published pages listed`
- Failure: `Published page list unavailable`
- Action: `Retry`
- Direct-link-only policy, only after exact Owner approval: `Published pages are available by direct link`

Signed-out account menu:

- Trigger: `Sign in`
- Status while loading: `Checking...`
- Empty provider state: `Sign-in providers are not available right now.`
- Benefit: `Personalize your profile`
- Benefit: `Save your Music Top 10`
- Future benefit, only after route exists: `Send TTS when available`
- Locked label: `Account required`
- Action labels come from configured provider labels, for example `Continue with Google`.

Signed-in account menu:

- Identity fallback: `Set up your profile`
- Identity error: `Maiks.yt account unavailable`
- Retry: `Retry`
- Ordinary links: `Account settings`, `Profile`, `Connections`, `Privacy`, `Stream appearance`, `Music`
- Future owner-view link: `My profile`
- Privileged links: `Admin`, `Actions`, `Notifications`
- Sign out idle: `Sign out`
- Sign out busy: `Signing out...`
- Sign out error: `Sign-out failed. Try again.`

Profiles:

- Public label: `Public`
- Private label: `Private`
- Private text: `This account is set to private`
- Static mock warning while old pages remain: `Design mock`
- Real search empty state: `No profiles found`
- Real search unavailable state: `Profile search unavailable`
- Real profile missing state: `Profile not found`

Locked and unavailable:

- `Locked`
- `Account required`
- `Unavailable`
- `Not available yet`

## Accessibility and interaction contract

- Desktop and mobile must each have open and closed states.
- `Channels`, `Live`, and `Account` are separate disclosures. Opening one closes the others unless the mobile drawer intentionally contains them as separate groups.
- `Enter` and `Space` open the focused disclosure.
- `Escape` closes the open disclosure and restores focus to the trigger.
- Outside click closes the open disclosure.
- Tab order follows the visual order.
- `aria-current="page"` appears on the active destination where applicable.
- Mobile drawer or sheet has one explicit close control, focus containment while open, focus restoration after close, and 44px minimum touch targets.
- Text contrast is at least 4.5:1.
- Controls and focus indicators are at least 3:1 in normal, hover, focus, disabled, and error states.
- The current normal account trigger and admin focus-border treatment fail this acceptance bar and must be corrected in the implementation design.
- Disabled, locked, unavailable, and error controls must be visually distinct without relying on color alone.
- Loading text must not resize buttons or shift adjacent controls.

## Required candidate images

The images approve visual direction only. They do not approve implementation, migration application, live account assignment, public provider disclosure, deployment, or live account/provider/server changes.

The exact generation briefs live in `reports/visual-concepts/production-navigation-account-profiles/README.md`.

Required candidates:

1. Desktop signed-out public header with `Channels` open and account preview closed.
2. Desktop public header with `Live` open in the empty state, plus a variant note for one live row.
3. Desktop signed-in ordinary account menu for a configured user named `Maiks`.
4. Desktop signed-in account menu with privilege projection unavailable but ordinary links retained.
5. Mobile signed-out drawer with `Channels`, `Live`, `Music`, real OAuth actions, and locked account benefits.
6. Mobile signed-in drawer for `Maiks`, with ordinary account links and a separate privileged section.
7. Desktop full-shell public page with the closed header, complete fixed code-owned route map, and truthful unavailable runtime `Pages` section visible. It proves `Creator links` is in the footer and absent from the primary header without fabricating Page Creator links.
8. Mobile full-shell public page with the closed drawer trigger, complete stacked fixed route map, and the same unavailable runtime `Pages` section at 390px.
9. Desktop real `/profiles/maiks` public example with a neutral avatar and unavailable optional sections only. No approved projection dataset exists for populated rows in this visual pass.
10. Mobile real `/profiles/maiks-private` private example with no image and only the exact private text.

## Acceptance gate for the next implementation task

Implementation may start only after Michael approves all ten required candidate images generated from these briefs.

The implementation task must:

- preserve the complete fixed code-owned route map and keep published Page Creator routes as a separate runtime source
- list Page Creator routes only from the safe public navigation projection, or apply an exact Owner-approved direct-link-only exclusion; never invent current entries
- keep Creator Links out of the primary header
- avoid provider identity in the account-menu identity header
- use an authoritative server navigation projection for signed-in and privileged menu state
- fail closed for privileges while preserving ordinary signed-in account links when session state remains known
- remove Notifications from ordinary signed-in subnav exposure unless projected by active grants
- omit TTS until a real route exists
- replace static profile mocks only with real DB-backed routes and projections
- keep private profiles searchable but visually private
- run the narrow source checks and browser/accessibility checks assigned by the implementation scope

Unresolved gates:

- Main-site navigation projection does not exist yet.
- Public Page Creator navigation listing does not exist, and no Owner-approved direct-link-only exclusion is recorded yet.
- Real owner-view profile path does not exist yet.
- Real Web routes for `/profiles/maiks` and `/profiles/maiks-private` do not exist yet.
- Rich public-profile section projections are not reviewed yet.
- TTS has no public/member destination.
- Migration generation is complete at `fcf1c8f` as reviewed, unapplied files. Applying it and assigning live handles remain separate gates.
- Public provider disclosure and any provider-backed public profile row require separate review and consent.
- Token-bearing tool destinations require projection-owned safe URLs before they may appear.
