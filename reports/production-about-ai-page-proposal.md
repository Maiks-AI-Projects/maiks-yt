# Production `/about/ai` page proposal

Status: revised after independent review, with desktop and mobile image-first candidates ready for Owner review. This document and the generated candidates do not authorize implementation, deployment, links from production navigation, or any public AI runtime behavior.

Date: 2026-08-28

Target provenance:

| Field | Evidence |
| --- | --- |
| Requested worktree | `/home/michael/Documents/Codex/maiks-yt-production` |
| Canonical path | `/home/michael/Documents/Codex/maiks-yt-production` |
| Branch | `production` |
| Current revision | `29aee07` |
| File scope | New report only: `reports/production-about-ai-page-proposal.md` |
| Existing nearby work | `reports/current-work.md`, `reports/production-capability-ledger.md`, `reports/visual-concepts/production-pwa-access-recovery/README.md`, `reports/production-public-copy-and-profile-decisions.md`, and `reports/profile-handle-read-model-schema-proposal.md` already have unrelated changes and must remain untouched. |

## Decision state

Michael approved a dedicated public page about AI use. The earlier paragraph-on-other-About-pages idea is superseded for placement, and the superseded note must remain exactly:

> "use a dedicated page"

This proposal keeps the page short, public, and plain. It does not add the content to `/about`, `/about/health`, or `/about/history`.

The accepted writing voice is direct, warm, and matter-of-fact. The page should use first person, not marketing copy. It should not apologize for using AI, pick a culture-war fight, ask for pity, sound like a manifesto, add fake typos, or hide the real boundaries.

The page should state that the website and stream overlays were built with AI assistance under Michael's direction. It should also explain that AI helps Michael with memory, focus, planning, and stream organization.

The page must keep Michael real. Gameplay, voice, reactions, decisions, live camera, and live footage are Michael's. It must not claim that every visual or audio asset is human-made, because current asset provenance is not fully inventoried. The current homepage workspace hero is generated and temporary.

Production AI runtime is currently inert. Any present-tense stream-assistance wording must describe Michael's own workflow, not a live Maiks.yt AI feature that speaks, posts, moderates, or controls the stream.

## Proposed route and metadata

Route: `/about/ai`

Navigation label: `AI and my work`

About navigation order:

1. `Who I am` -> `/about`
2. `AI and my work` -> `/about/ai`
3. `Medical history` -> `/about/health`
4. `My history` -> `/about/history`

Page metadata:

```ts
export const metadata: Metadata = {
  title: "AI and my work",
  description: "How Michael uses AI assistance on Maiks.yt while keeping the public work under his own direction and responsibility."
};
```

## Exact proposed copy

Public copy length: 215 words, counting the eyebrow, H1, section labels, section headings, body copy, and footer link.

Eyebrow:

```text
AI and my work
```

H1:

```text
I use AI. I stay responsible.
```

Lead:

```text
Maiks.yt, including the website and stream overlays, was built with AI assistance under my direction. I use it much like notes, checklists, search, and code tools: to keep more work reachable.
```

Section 1 eyebrow:

```text
What AI helps with
```

Section 1 heading:

```text
A tool under my direction
```

Section 1 body:

```text
My memory, focus, energy, and planning are not always steady. AI helps me break work down, compare options, draft and rewrite text, remember what changed, and organize streams. I decide what to use, what to change, and what belongs on Maiks.yt.
```

Section 2 eyebrow:

```text
What stays mine
```

Section 2 heading:

```text
The stream is still me
```

Section 2 body:

```text
The gameplay, voice, reactions, decisions, live camera, and live footage are real and mine. AI can help me prepare and organize, but it does not make those choices for me. I am responsible for what I publish and what happens on my stream.
```

Section 3 eyebrow:

```text
Current limits
```

Section 3 heading:

```text
No live AI host
```

Section 3 body:

```text
Today, AI is not speaking on stream, posting as me, moderating viewers, or controlling what viewers see. The current homepage workspace image was generated and is temporary. Other visual and audio assets have not all been inventoried yet.

Some people do not want to use AI or watch AI-assisted work. I respect that choice. I ask for the same respect for mine.
```

Footer link:

```text
Read the medical context ->
```

Destination: `/about/health`

No external link is included in this first public draft. The Linus Torvalds mailing-list sources are useful background for the personal-choice framing, but their broader tone is combative. Add a source link only if Michael explicitly asks for one.

## Claims and qualifications

| Claim | Proposed wording | Qualification | Source or gate |
| --- | --- | --- | --- |
| Dedicated placement | `AI and my work` as a separate `/about/ai` page | Do not add a paragraph to the other About pages. Preserve the superseded note exactly: `"use a dedicated page"`. | `reports/production-public-copy-and-profile-decisions.md`; `reports/current-work.md`; `reports/next-agent-tasks.md`; current request. |
| Website and overlays used AI assistance | `Maiks.yt, including the website and stream overlays, was built with AI assistance under my direction.` | Do not imply AI acted independently or that everything was generated. | Current request. |
| Health-related workflow help | `My memory, focus, energy, and planning are not always steady.` AI helps with task breakdown, comparison, drafting, rewriting, remembering changes, and stream organization. | Keep practical. No pity and no invented medical facts. | Current `/about/health` copy and accepted writing direction. |
| Stream assistance | `AI helps me ... organize streams.` | This describes Michael's workflow. Production AI runtime is inert, with no claim of a live AI feature. | TODO AI gate; current request. |
| Michael remains real | `The gameplay, voice, reactions, decisions, live camera, and live footage are real and mine.` | Do not claim all visuals or audio are human-made. | Current request. |
| Michael remains responsible | `I am responsible for what I publish and what happens on my stream.` | Responsibility covers assisted work. It does not approve automated publishing. | Accepted public writing and AI-gate policy. |
| Asset provenance | `The current homepage workspace hero is generated and temporary.` | Other asset provenance is not fully inventoried, so avoid blanket statements. | `reports/current-work.md`; TODO public page item. |
| Respect for non-users | `Some people do not want to use AI or watch AI-assisted work. I respect that choice.` | Ask reciprocal respect without arguing politics or ethics. | July 14 and July 15 primary-source framing; current request. |
| No public AI runtime | `Today, AI is not speaking on stream, posting as me, moderating viewers, or controlling what viewers see.` | Future public AI output still needs private shadow mode, prompt boundaries, mute/off controls, and public-safety review. | TODO AI Stream Assistant section and Action Panel AI gate. |

## Visual contract for approval image

Candidate v1 is registered in `reports/visual-concepts/production-about-ai/`. Generating the desktop and mobile references does not approve either image, and image approval does not approve implementation. The exact copy in this proposal remains authoritative because image-generated body text is representative layout content.

Desktop approval image: `1536x1100`.

Required desktop view:

- Use the existing About page visual system from `apps/web/src/app/about/about.module.css`.
- Keep the page text-led.
- Use the dark canvas, restrained mint accent, border-separated full-width bands, wide centered content column, and existing About navigation.
- Show the About navigation with `AI and my work` active between `Who I am` and `Medical history`.
- Show the complete three-section copy, respect close, and footer link in the `1536x1100` frame without shrinking the type below the existing About system.
- Use the H1 `I use AI. I stay responsible.` with existing About hero scale and line-height.
- Use alternating bands only where the current About system already does.
- No cards.
- No AI imagery.
- No robot, brain, circuit, magic, prompt, chatbot, model, or generated-glow imagery.
- No gradients or new brand treatment.
- No new logo, color palette, nav shell, ornamental blobs, icons, illustrations, or background image.

Mobile check: `390x844`.

Required mobile behavior:

- The About navigation may scroll horizontally as it does now, with no clipped active item in the intended screenshot position.
- H1 wraps cleanly without letter collisions or horizontal overflow.
- Lead text remains readable and does not overlap the first band.
- Section headings and paragraphs stack in one column using the existing mobile About layout.
- No text is hidden behind navigation, and no line overflows the viewport.
- The page still reads as part of the About family, not as a separate AI campaign page.

## Source references

| Source | What it supports |
| --- | --- |
| Current request, 2026-08-28 | Binding acceptance criteria, exact output file, no implementation, approved decisions, visual constraints, and verification command. |
| `AGENTS.md` in `/home/michael/Documents/Codex/maiks-yt-production` | Production is the sole forward-development line; reports and app changes must stay scoped; image-first rule applies before material visual implementation. |
| `reports/current-work.md` | Current public writing and AI-page decision state; production worktree policy; generated temporary homepage hero; About pages already deployed and public-HTTP verified. |
| `reports/next-agent-tasks.md` | Dedicated `/about/ai` proposal gate; keep Linus reference minimal; implementation and deployment are not authorized by the choice alone. |
| `reports/production-public-copy-and-profile-decisions.md` | Submitted choices: direct, warm, matter-of-fact writing; short dedicated public AI-use page; superseded note `"use a dedicated page"`; separate approval gates. |
| `TODO.md` public page and AI sections | Current AI runtime is inert; public AI output must start with private shadow mode, prompt boundaries, mute/off controls, and public-safety review. |
| `apps/web/src/app/about/page.tsx` | Current first-person About tone and page structure. |
| `apps/web/src/app/about/health/page.tsx` | Current medical wording, practical health context, and no-pity boundary. |
| `apps/web/src/app/about/history/page.tsx` | Current factual first-person history tone and incomplete-record wording. |
| `apps/web/src/app/about/about-navigation.tsx` and `about.module.css` | Existing About navigation, page layout, dark visual system, mobile behavior, and text-band pattern. |
| July 14 Linus Torvalds message, `CAHk-=wi4zC+Ze8e+p3tMv8TtG_80KzsZ1syL9anBtmEh5Z40vg@mail.gmail.com` | Source for the practical framing that AI is a useful tool and that anti-AI preference should not block others from using it. |
| July 15 Linus Torvalds follow-up, `CAHk-=wi7KN9_DYdmaE2chC92EhTrO=Wtx1bPBER-EQfAZ8FREg@mail.gmail.com` | Source for the personal-choice framing and vegetarian/vegan analogy. This proposal uses the idea, not the combative tone. |

Primary source URLs:

- https://lore.kernel.org/linux-media/CAHk-%3Dwi4zC%2BZe8e%2Bp3tMv8TtG_80KzsZ1syL9anBtmEh5Z40vg%40mail.gmail.com/
- https://lore.kernel.org/linux-media/CAHk-%3Dwi7KN9_DYdmaE2chC92EhTrO%3DWtx1bPBER-EQfAZ8FREg%40mail.gmail.com/

The July 14 and July 15 messages were used as background only. The proposed public page should stay in Michael's words. It should not quote Linus, invoke Linux authority, or link either thread unless Michael explicitly wants that in a later draft.

## Verification plan for this proposal

Required now:

```bash
git -C /home/michael/Documents/Codex/maiks-yt-production diff --check -- reports/production-about-ai-page-proposal.md
```

Expected result: no whitespace errors.

No GUI, browser, screenshot, image generation, app code, commits, deployment, tracker updates, or other report edits are part of this proposal task.

## Gates before implementation

Implementation may start only after all of these are true:

1. Michael approves the proposed copy or gives exact edits.
2. Michael approves whether the first page draft should remain unlinked from the two Linus sources.
3. Michael approves the registered desktop and mobile visual references, or gives exact corrections.
4. The implementation task explicitly owns app files, tests, and any report updates it needs.
5. The implementation keeps to the current About visual system with no new brand, gradients, cards, AI imagery, or generated assets.
6. The implementation does not add public AI runtime behavior, automated publishing, public speech, paid-message readout, moderation decisions, provider writes, money behavior, migrations, secrets, Cloudflare/Docker changes, or deployment config changes.

## Gates before deployment

Deployment is not approved by this report. If a later implementation is approved and reviewed, deployment still needs:

1. Exact target provenance for the production worktree, branch, and source revision.
2. Focused Web tests for route metadata, navigation order, active About nav state, and copy boundaries.
3. Production Web build.
4. Shared review gate, normally `pnpm check:review`, unless the coordinator records a narrower accepted gate for a copy-only page.
5. Visual verification against the approved `1536x1100` and `390x844` references.
6. Text checks confirming no forbidden claims: no live AI host, no automated Maiks.yt AI feature claim, no blanket human-made asset claim, no apology, no manifesto, no culture-war framing, no pity framing, and no marketing filler.
7. Live public HTTP verification after deployment for `/about/ai`, `/about`, `/about/health`, `/about/history`, Home, API health, Control, Overlay, and a synthetic missing route.
8. Confirmation that no schema, migration, provider credential, secret, Cloudflare/Docker config, account, money, moderation, or stream-output behavior changed.

## Remaining approval gate

Michael must approve or correct the registered desktop and mobile candidates and exact copy, then explicitly approve implementation. Until those gates pass, `/about/ai` remains proposed only.
