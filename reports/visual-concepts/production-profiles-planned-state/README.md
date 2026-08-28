# Production Profiles planned-state concept

## Status

Candidate v1 for Michael's approval. These images do not authorize source implementation, handle persistence, search, image routing, migration, deployment, or live account changes.

The generated navigation labels, footer links, and copyright year are placeholders. The implementation must preserve the exact current production public shell, navigation, footer, logo, and responsive behavior. Approval applies to the body layout, density, copy direction, and private-profile projection only.

## Acceptance direction

- Replace the fake search and static public-profile results with an honest planned state.
- Say plainly that the old examples were not connected to real accounts.
- Do not advertise provider verification, role sync, supporter ranks, donations, contributions, verified games, or perks before those capabilities exist.
- Keep the planned state compact, text-led, and visually consistent with the current public Maiks.yt site.
- Keep the private example searchable in the future, but expose only the account name and `This account is set to private`.
- Render no profile image, provider identity, account metadata, recognition, or other detail for a private account.
- Do not implement real handles, search, image routing, assignment, migration, backfill, or provider-derived identity in this cleanup.

## Artifacts

Desktop planned state:

- File: `reports/visual-concepts/production-profiles-planned-state/profiles-planned-desktop-candidate-v1.png`
- Dimensions: `1672 x 941`
- SHA-256: `59a9d4fa6805a39cb3286ec1b64d80094822d3d2287cfe3760658ae9f39731ab`
- Source: `/home/michael/.codex/generated_images/019ee64d-d00e-7c42-8341-b394df487b64/exec-bc4c83cb-58e8-42c0-a86f-d87514f7f66e.png`

Mobile private profile:

- File: `reports/visual-concepts/production-profiles-planned-state/private-profile-mobile-candidate-v1.png`
- Dimensions: `852 x 1846`
- SHA-256: `03cc91eae265d3e39cc40c3b3dbd3105cb8cd140d8210845f30d13a9210d4988`
- Source: `/home/michael/.codex/generated_images/019ee64d-d00e-7c42-8341-b394df487b64/exec-1592a17d-54c4-4476-a14e-5bd421c495e8.png`

Both were generated with the built-in ImageGen tool on 2026-08-28.

## Gate

Michael must approve or correct both candidates before the Profiles cleanup begins. Approval authorizes only a bounded implementation against this record. Implementation, independent review, deployment, and live verification remain separate delivery states.
