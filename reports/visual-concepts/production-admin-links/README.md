# Production Creator Links admin concept

## Status

Approved as the source-level acceptance reference. Implementation is still pending.

Michael approved `admin-links-candidate-v1.png` for the production Creator Links admin surface on 2026-08-28. The image is the source-level acceptance reference; implementation is not complete yet.

## Visual scope

- Preserve the production admin shell.
- Use a compact master/detail Creator Links editor.
- Keep ordering in the inventory only.
- Show the selected draft in the editor.
- Add a local draft preview that uses the public Creator Links row presentation.
- Keep the saved `/links` preview authoritative.
- Require the exact draft title to confirm deletion.
- Keep Funding/support protected and unavailable.

## Current behavior

The production Creator Links workflow already uses database-backed owner admin controls for create, edit, inventory ordering, and publish state. New links follow the persisted maximum order. Selection and publish actions protect dirty edits, icon and purpose feedback appears before save, drafts stay out of public `GET /links`, and the saved `/links` view remains authoritative. Funding/support remains protected and unavailable.

## Proposed next behavior

Implement the exact approved image by reorganizing the existing workflow into the compact master/detail presentation shown in the candidate. Add a local unsaved preview using the same row presentation as the public page, without exposing drafts through public `GET /links`. Add owner-only deletion for unpublished drafts with exact-title confirmation. Funding/support remains protected and unavailable.

## Artifact record

- Source: `/home/michael/.codex/generated_images/019ee64d-d00e-7c42-8341-b394df487b64/exec-c3cd52e6-b6c5-49da-bacf-957d44eb45b4.png`
- Stored as: `reports/visual-concepts/production-admin-links/admin-links-candidate-v1.png`
- Dimensions: `1505 x 1045` pixels
- SHA-256: `d6510f81877ba2c5fe17398575e685ab1974735636d48737148285dd7e1cea7e`

## Change boundary

This registration changes documentation and preserves the generated PNG byte-for-byte. It changes no code/runtime, migration, deployment, server, GUI/browser, or live state.
