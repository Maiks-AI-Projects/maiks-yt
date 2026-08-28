# Navigation, account, and profile visual concepts

This folder contains the image-first approval pass for the combined production public header, account menu, and real profile direction.

Ten candidate images have been generated. None is approved. Images produced from this folder approve visual direction only after explicit Owner approval. They do not approve UI implementation, migration application, live account assignment, account mutation, public provider disclosure, deployment, or live verification.

## Candidate registry

Generation method for every file: built-in image generation with current production references.

Approval state for every file: `Awaiting Owner approval`.

Generated body copy is representative where applicable. The proposal and this README remain the behavior and copy authority. A PNG does not override exact labels, states, routes, visibility rules, privacy rules, or consent gates.

| Candidate | Filename | Dimensions | SHA-256 |
| --- | --- | --- | --- |
| 1 | `candidate-01-desktop-channels-v2.png` | 1536 x 1024 | `a1f564ac7a075b5b232fe4ecbdb61d681bf62d285232cc0c6575aac2692f6637` |
| 2 | `candidate-02-desktop-live-v2.png` | 1536 x 1024 | `43f151a8d021f58762bea1b4dcbe4392581f845d702edaf495c7345ba9f99794` |
| 3 | `candidate-03-desktop-account-v2.png` | 1536 x 1024 | `86635047c0ff4c28e7ee6767d45eec410464ba9839e3e62b717a2ff18266f5f7` |
| 4 | `candidate-04-desktop-account-error-v2.png` | 1536 x 1024 | `e31a443053f1bbccd6d1c14ae244e5c33187107f9962c40feee34fc8d086bd07` |
| 5 | `candidate-05-mobile-signed-out-v1.png` | 853 x 1844 | `4ecf233e47332745273bbbc9431adb860a242d0d20af3342de1755c5f1bc73b7` |
| 6 | `candidate-06-mobile-signed-in-v1.png` | 853 x 1844 | `0c2ec3937b7c469aaae143a617bbb917c79ee7f8e425dc426759cc481a80c8ea` |
| 7 | `candidate-07-desktop-footer-map-v2.png` | 1536 x 1024 | `b051acb8fcdb51313b6b6004243a37eb46976c14d143f352839a40036a47c4bb` |
| 8 | `candidate-08-mobile-footer-map-v2.png` | 853 x 1844 | `370e40a967397ea2d57aea6ef97bac40136b57a707d672f7dfaccf70aa010ab2` |
| 9 | `candidate-09-desktop-public-profile-v2.png` | 1536 x 1024 | `50a4d34f67bbaa3c9f06d00b66ea24ec9811fcadf2300335d66163f7d4c64e12` |
| 10 | `candidate-10-mobile-private-profile-v2.png` | 852 x 1846 | `bf4b413311d3b14ec52da4612e68043efa11ef380289520557b3371533c95c31` |

The retained `v1` files for Candidates 1-4 and 7-10 are superseded review history. They are not part of the approval set.

## Shared visual rules

- Keep the established production dark canvas, mint accent, compact density, strong typography, and restrained borders.
- Do not use gradients, decorative blobs, giant buttons, marketing hero treatment, white developer panels, or cards inside cards.
- Header, drawers, menus, and profile pages should feel like production Maiks.yt, not a new brand.
- Use real route labels and honest states only.
- Do not show email.
- Do not show OAuth/provider identity as the account header.
- Do not show fake activity, fake scarcity, fake provider rows, fake locks that look enabled, or guessed token destinations.
- Do not invent Page Creator titles or paths. Fixed code-owned routes and DB-backed runtime pages must remain visibly distinct.
- Use `Maiks` as the sample stored display name, because that is the chosen public display name in the scenario. Do not show Michael's personal name in the account menu.

## Candidate 1: desktop signed-out header, Channels open

Viewport: desktop, 1440px wide.

Scene:

- Sticky public header on the production dark canvas.
- Brand at left: Maiks.yt icon and `Maiks.yt`.
- Desktop header order: `Channels`, `Live`, `Projects`, `Schedule`, `Games`, `About`, `Build progress`.
- Account control is visually separated at the far right and closed, labelled `Sign in`.
- `Channels` disclosure is open.
- Channels menu contains only:
  - `All channels` with destination `/channels`
  - `MaiksPlays` with destination `/plays`
- No Creator Links in the primary header.
- No inferred Twitch, YouTube, Discord, WoW, Talking, or Coding internal channel routes.

Acceptance focus:

- Clear desktop hierarchy.
- Channels menu is compact and truthful.
- Account is separated without becoming a large call to action.

## Candidate 2: desktop header, Live open

Viewport: desktop, 1440px wide.

Scene:

- Same header order as Candidate 1.
- `Live` disclosure is open.
- Main image state shows loaded empty copy: `No channels live`.
- Include a small Retry-free empty state. Empty is not an error.
- Also define a small alternate note in the image margin or design annotation for the failure state:
  - `Live status unavailable`
  - `Retry`
- Also define one live-row variant in the brief:
  - channel label from public schedule `channelKey`
  - stream title
  - destination `Open schedule` unless a real channel route exists

Acceptance focus:

- Live is derived from public schedule, not provider links.
- Empty, unavailable, and live are visually distinct.

## Candidate 3: desktop signed-in ordinary account menu

Viewport: desktop, 1440px wide.

Scene:

- Header closed except Account menu.
- Account trigger uses the managed profile image if available and text `Maiks`.
- Account panel is open on the right.
- Identity header shows only:
  - managed image or neutral fallback
  - `Maiks`
- No email.
- No provider logo or provider image as identity.
- Ordinary links:
  - `Account settings`
  - `Profile`
  - `Connections`
  - `Privacy`
  - `Stream appearance`
  - `Music`
  - `Sign out`
- No `My profile` yet.
- No `Admin`, `Actions`, `Notifications`, `Control`, `Chat`, `Moderation`, or `Music player` in this ordinary state.

Acceptance focus:

- The menu feels useful without leaking identity.
- Links scan quickly.
- Sign out is present but not visually dominant.

## Candidate 4: desktop signed-in account menu, privilege unavailable

Viewport: desktop, 1440px wide.

Scene:

- Same account trigger as Candidate 3.
- Account menu open.
- Identity-service state shows:
  - neutral image
  - `Maiks.yt account unavailable`
  - `Retry`
- Ordinary safe links remain visible because the signed-in session is still known:
  - `Account settings`
  - `Profile`
  - `Connections`
  - `Privacy`
  - `Stream appearance`
  - `Music`
  - `Sign out`
- Privileged section shows a quiet unavailable state, not links:
  - `Privileged links unavailable`
  - `Retry`

Acceptance focus:

- Error state does not fall back to provider name, image, or email.
- Privileges fail closed.
- The user can still reach ordinary account pages.

## Candidate 5: mobile signed-out drawer

Viewport: mobile, 390px wide.

Scene:

- Header collapsed into one coherent drawer or sheet.
- Explicit close control.
- Focused touch targets are at least 44px.
- Groups appear in this order:
  - `Channels`
  - `Live`
  - primary public links
  - `Account`
- Channels group shows only `All channels` and `MaiksPlays`.
- Live group shows `No channels live`.
- Public links include `Projects`, `Schedule`, `Games`, `About`, `Build progress`, and `Music`.
- Account group shows:
  - `Sign in`
  - configured OAuth actions such as `Continue with Google`
  - locked previews:
    - `Personalize your profile` with `Account required`
    - `Save your Music Top 10` with `Account required`
    - TTS omitted unless the real destination exists

Acceptance focus:

- One drawer, not competing menus.
- Signed-out discovery is truthful and quiet.
- No `/signup` route.

## Candidate 6: mobile signed-in drawer

Viewport: mobile, 390px wide.

Scene:

- Drawer open with focus containment implied by the design.
- Account group shows stored managed identity:
  - managed image or neutral fallback
  - `Maiks`
- Ordinary account links:
  - `Account settings`
  - `Profile`
  - `Connections`
  - `Privacy`
  - `Stream appearance`
  - `Music`
- Privileged section appears only when projected. Show this candidate with projected privileges:
  - `Admin`
  - `Actions`
  - `Notifications`
- Sign out row at the bottom:
  - `Sign out`

Acceptance focus:

- Mobile remains dense but readable.
- Privileged links are separated from ordinary account links.
- No token-bearing tool URLs appear.

## Candidate 7: desktop full shell with fixed map and runtime Pages state

Viewport: desktop, 1440px wide. Use a full-page or stitched shell view tall enough to show the closed header and the complete footer in one candidate.

Scene:

- Header is closed and shows the approved desktop order: `Channels`, `Live`, `Projects`, `Schedule`, `Games`, `About`, `Build progress`, then the separate account control.
- `Creator links` does not appear in the primary header.
- Keep the page body short, neutral, and unframed. It exists only to show the relationship between the header and footer, not as a marketing hero.
- Footer is fully visible and groups the fixed code-owned public destinations without empty or invented links.
- The fixed shell map shows these destinations across the header and footer:
  - Maiks.yt brand/home -> `/`
  - `All channels` -> `/channels`
  - `MaiksPlays` -> `/plays`
  - `Music` -> `/music`
  - `Projects` -> `/projects`
  - `Schedule` -> `/schedule`
  - `Games` -> `/games`
  - `About` -> `/about`
  - `AI` -> `/about/ai`
  - `Health` -> `/about/health`
  - `History` -> `/about/history`
  - `Build progress` -> `/progress`, while the main build remains active
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
  - `Profiles` -> `/profiles`
  - `RSS` -> `/feed.xml`
- After the fixed groups, show a separate section labelled `Pages` for DB-backed Page Creator routes.
- This candidate uses the truthful unavailable state because no public listing projection or approved current-page dataset exists:
  - `Published page list unavailable`
  - `Retry`
- Show no Page Creator title or path in this candidate.
- A later loaded-state image may show links only when the generation task supplies the exact title/path list from the public navigation projection. Its empty state is `No published pages listed`.
- If the Owner later approves direct-link-only exclusion, replace the unavailable state only with the approved copy: `Published pages are available by direct link`.

Acceptance focus:

- `Creator links` is visibly in the footer and absent from the primary header.
- The header and footer account for every listed fixed code-owned destination.
- The separate `Pages` state makes the DB-backed runtime boundary visible without fabricating links.
- Dense footer groups remain legible and do not become nested cards.

## Candidate 8: mobile full shell with fixed map and runtime Pages state

Viewport: mobile, 390px wide. Use a full-page or stitched shell view tall enough to show the closed header and the complete footer in one candidate.

Scene:

- Mobile header is closed with its drawer trigger visible.
- `Creator links` is not promoted beside the mobile header trigger and is not treated as a primary item outside the drawer.
- Keep the page body short, neutral, and unframed.
- Footer is fully visible below the page body, separate from the closed drawer.
- Use the same exact fixed destination labels and routes listed in Candidate 7, arranged as compact stacked groups.
- Footer links have at least 44px touch targets, visible keyboard focus treatment, and enough spacing to prevent accidental taps.
- `Creator links` -> `/links` is clearly present in the footer group.
- After the fixed groups, show the separate `Pages` section with `Published page list unavailable` and `Retry`.
- Show no Page Creator title or path. Loaded, empty, and Owner-approved direct-link-only variants follow the exact Candidate 7 rules.
- Do not collapse the footer map into an unlabeled overflow menu or hide destinations behind fake disabled controls.

Acceptance focus:

- The mobile shell preserves the complete fixed code-owned destination map at 390px.
- The runtime `Pages` section remains distinct and truthful.
- Footer placement remains clear when the navigation drawer is closed.
- Long labels such as `Affiliate disclosure` and `Analytics privacy` fit without clipping or overlap.

## Candidate 9: desktop real public profile, `/profiles/maiks`

Viewport: desktop, 1440px wide.

Scene:

- Real DB-backed direction for `/profiles/maiks`.
- Label: `Public`.
- Account name displayed as `Maiks`.
- Use a neutral avatar or image placeholder. Do not show a managed profile image in this candidate.
- Show these optional section labels with an `Unavailable` state only:
  - `Profile`
  - `Channels`
  - `Games`
  - `Social links`
  - `Recognition`
- Do not show a populated service, account, channel, game, social, or recognition row.
- A managed image or populated row requires the generation task to supply the exact approved public projection data and its consent or Owner-authorization evidence. No such dataset is approved for this candidate.
- Do not show provider/auth rows, operational IDs, emails, fake account history, fake activity, raw platform IDs, or unreviewed entitlement claims.

Acceptance focus:

- Public profile looks like a real account page, not a mock full of promises.
- Every optional section is visibly unavailable in this image pass.
- The profile does not leak provider data.

## Candidate 10: mobile real private profile, `/profiles/maiks-private`

Viewport: mobile, 390px wide.

Scene:

- Real DB-backed direction for `/profiles/maiks-private`.
- Label: `Private`.
- Account name visible.
- Exact text visible: `This account is set to private`.
- No image.
- No provider rows.
- No social rows.
- No games.
- No recognition.
- No counts.
- No hint of hidden sections.

Acceptance focus:

- The private profile is searchable but private in presentation.
- The page does not invite guessing what is hidden.

## Approval rule

The ten registered images await Owner review. A later image pass may replace a candidate, but it must update this registry. Implementation starts only after Michael approves all ten candidates, the approved image set exists, and the implementation task names that set as the visual acceptance reference.
