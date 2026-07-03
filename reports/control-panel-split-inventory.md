# Control Panel Split Inventory

Updated: 2026-07-03

Purpose: keep `apps/control-panel/src/main.tsx` and nearby control-panel modules small enough to review. Splits should stay behavior-preserving, one concern at a time, with `pnpm --filter @maiks-yt/control-panel build`, `node scripts/check-architecture.mjs`, and `git diff --check` after each chunk.

## Current State

- `apps/control-panel/src/main.tsx`: app shell, route detection, auth gate, manifest route updates, and top-level panel composition.
- `apps/control-panel/src/chat/`: standalone chat window header, service status strip, streamer chat viewer, and chat helper services/types.
- `apps/control-panel/src/moderation/`: moderation shell, applied-rules window, helper summary panel, and moderation types.
- `apps/control-panel/src/overlay/`: overlay status/control component, presence hook, presentational status sections, and overlay API/types.
- `apps/control-panel/src/scene-designer/`: scene designer component, presentational sections, layout helpers, and scene designer types.
- `apps/control-panel/src/realtime/`: realtime probe panel.
- `apps/control-panel/src/simulator/`: simulator panel.
- `apps/control-panel/src/operations/`: small operations panel.

## Completed Splits

- Chat status strip extracted from `main.tsx`.
- Streamer chat window header and viewer extracted.
- Moderation control window extracted, then split into shell, applied rules, info panel, and types.
- Realtime probe extracted.
- Simulator panel extracted.
- Operations panel extracted.
- Surface status extracted, then split into types/constants, presence hook, and presentational sections.
- Scene designer extracted, then split into types, layout helpers, and presentational sections.
- Streamer chat viewer helper/types extracted.

## Remaining Opportunities

### Overlay Actions Hook

Candidate files:

- `apps/control-panel/src/overlay/SurfaceStatus.tsx`
- new `apps/control-panel/src/overlay/useSurfaceStatusActions.tsx` if this is worth doing

Notes:

- This is the largest remaining control-panel file.
- It is mostly cohesive overlay POST/action handling now.
- A hook split would be reasonable, but it should be done carefully because it would pass many state setters and derived values.

### Scene Designer Runtime Hook

Candidate files:

- `apps/control-panel/src/scene-designer/SceneDesigner.tsx`
- new scene runtime hook or save/load service

Notes:

- The remaining component owns drag/resize/save state.
- Further splitting is possible, but the current file is already under 500 lines and has one main state machine.

### Streamer Chat Viewer Rows

Candidate files:

- `apps/control-panel/src/chat/StreamerChatViewer.tsx`
- optional chat-row component

Notes:

- A row/options component could remove render density.
- Keep moderation action execution in the viewer or a reviewed hook so permissions remain obvious.

## Suggested Stop Line

The high-value behavior-preserving splits are complete. Future splits should be tied to new feature work or reviewer pain rather than done mechanically.
