# Production public copy audit

## Scope and status
This is the durable queue for the completed read-only audit of public production copy. It does not authorize a blind rewrite. It records what to keep, what to fix, and how each page should be reviewed before any material change lands.

## Approved voice
Keep the lines that already sound like Michael. The strongest ones are direct, plain, and honest. That voice should stay the default for public-facing copy.

## Keep list
- `/about`: "I'm Michael." and "Streaming had to stop. The wish to return did not."
- `/about/health`: keep the factual lead. It should stay clear and unsentimental.
- `/plays`: keep the "mixed drawer" feel and "somewhere honest to land."
- `404`: keep "Did you break it, or did I?"
- `/support`, `/affiliates`, `/sponsors`: keep the strong openings. They already sound lived-in instead of manufactured.

## Repeated issues
- Designed headings read like UI labels instead of spoken language. The problem is not structure alone. It is that the page sounds drafted by a system, not said by a person.
- Public copy still leaks implementation jargon. Examples include "topic routing", "live creator-link records", "explicit telemetry allowlist", "eligible catalog API", "visual fixtures", and "private accounting tools". That language belongs in internal notes, not on a public page.
- Policy pages read like future specs. They describe what the system may do later instead of what the page means now.
- Empty states repeat the same mechanical tone. They need fewer placeholders and more actual voice.
- Database-backed copy needs a separate live-record audit. Static copy review is not enough where the text is generated from records that can change underneath it.

## Ranked queue
1. `/`, `/channels`, `/links`, `/plays`
   These are the first pages to tighten. They carry the clearest public voice and the clearest risk when the wording slips into product-speak.
2. `/progress`, `/updates`, `/projects`, `/schedule`, `/games`
   These need the same cleanup pass, plus a check that the structure does not turn into a status dashboard disguised as prose.
3. `/support`, `/affiliates`, `/sponsors`, `/accountability`, `/privacy/analytics`
   These should stay plain and readable. Policy and trust pages need firm language, not future-tense framing.
4. `/community-rules`, `/interactions`, `/music`
   These are smaller, but they still need the same spoken-language standard.
5. `/about` and related personal pages
   Keep the touch light. Preserve the strong lines. AI stays off the existing About pages because it belongs on the separately proposed `/about/ai` page.
6. `404`
   Keep it intact unless a later pass proves a better line.

## Per-page review contract
Before any page changes, review the live page, the source text, and the record-backed parts separately. If the page is driven by database content, confirm the live record first. If the change is only copy-level and bounded, keep it small. If it changes the shape of the page, treat it as a material redesign and require image-first review before approval.

## Working rule
This audit is a queue, not a rewrite. Preserve the approved lines. Strip jargon. Keep the pages sounding like a person who means what they say.
