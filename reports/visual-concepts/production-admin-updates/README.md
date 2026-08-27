# Production Admin Updates Concept

## Status

Michael approved `admin-updates-candidate-v1.png` on 2026-08-27 as the implementation direction for `/admin/updates`.

Treat this image as the acceptance reference. Preserve the production admin shell and implement the real behavior against the existing production Updates API. Deployment and live signed-in verification remain separate gates.

## Required behavior represented

- Dense master/detail editor within the established production admin shell.
- Search and draft/published filtering.
- Draft creation and editing.
- Saved public preview before publication.
- Publish and unpublish lifecycle; published records are not edited live.
- Compact pinned-state control.
- No AI drafting, social syndication, raw audit identifiers, example records, or implementation metrics.

## Generation record

- Built-in ImageGen with `reports/visual-qa/games-schedule-read-model/admin-games-1440x1000.png` as the production-style reference.
- Output dimensions: 1505x1045.
- SHA-256: `bc230e7e3b885808b5289fb313ba4c24d82088dc8c9af66ac07bebf6f691ef61`.
