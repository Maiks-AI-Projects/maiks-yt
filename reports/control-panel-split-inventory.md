# Control Panel Split Inventory

Updated: 2026-07-03

Purpose: keep `apps/control-panel/src/main.tsx` splits behavior-preserving and predictable. Move one chunk at a time, run `pnpm --filter @maiks-yt/control-panel typecheck`, `node scripts/check-architecture.mjs`, and `git diff --check` after each chunk.

## Current State

- `apps/control-panel/src/main.tsx`: 3039 lines after extracting `ChatServiceStatusStrip`.
- `apps/control-panel/src/chat/ChatServiceStatusStrip.tsx`: provider service-dot status strip for Twitch, YouTube, and Discord.
- `apps/control-panel/src/chat/chat-time.service.ts`: shared chat time formatter.

## Proposed Destinations

### Chat Window

Destination folder: `apps/control-panel/src/chat/`

Move next:

- `StreamerChatViewer`
- `ChatWindowHeader`
- chat moderation response types used only by chat row actions
- chat source labels if no other panel needs them

Keep shared:

- `formatChatTime` stays in `chat-time.service.ts`.
- Moderation rule labels may move later only if `ModerationRulesWindow` moves with them.

Notes:

- This should be the next useful split because `/chat` and `/moderation` both depend on the combined chat viewer.
- Keep API calls and URL-token behavior unchanged.

### Moderation Window

Destination folder: `apps/control-panel/src/moderation/`

Move after chat:

- `ModerationRulesWindow`
- `ModerationInfoPanel`
- `ModerationControlWindow`
- `ModerationPanelKey`
- moderation access/rules response types not needed by chat

Notes:

- Chat-first moderation UX should stay unchanged.
- Keep permission-filtered panels and signed-in plus control-token behavior unchanged.

### Overlay Controls

Destination folder: `apps/control-panel/src/overlay/`

Move after chat/moderation:

- `SurfaceStatus`
- overlay status/goal/chat-order/presentation response types
- overlay goal draft helpers
- overlay WebSocket URL helpers if only used by overlay controls

Notes:

- This is riskier than chat because it owns many control buttons and status polling.
- Keep scene designer separate from general overlay controls.

### Scene Designer

Destination folder: `apps/control-panel/src/scene-designer/`

Move as its own chunk:

- `SceneDesigner`
- `createSceneSlotStyle`
- `formatSlotLabel`
- `cloneScene`
- `clamp`
- `slotsOverlap`
- `getSceneLayoutWarnings`
- `createSceneCopyKey`
- drag/resize state and scene warning types

Notes:

- This is a large self-contained chunk.
- Run `pnpm --filter @maiks-yt/control-panel typecheck`; browser smoke is useful if this gets deployed.

### Realtime Probe

Destination folder: `apps/control-panel/src/realtime/`

Move:

- `RealtimeProbe`
- probe status types
- WebSocket URL helper if not moved with overlay controls
- `appendProbeMessage`

Notes:

- This is small and safe, but lower priority than chat/moderation.

### Simulator Panel

Destination folder: `apps/control-panel/src/simulator/`

Move:

- `OperationsPanel`
- `SimulatorPanel`
- `delay`
- `postReplayEvent`
- `playReplaySession`
- replay result types
- event-storm presets if only used there

Notes:

- Keep `@maiks-yt/testing` imports near this module once moved.

### App Shell

Destination folder: keep in `apps/control-panel/src/main.tsx` until the end, or move later to `apps/control-panel/src/app/App.tsx`.

Keep for now:

- `apiBaseUrl`
- route detection for `/chat` and `/moderation`
- auth gate/bootstrap
- manifest route update
- root render
- top-level panel composition

Notes:

- Do not move the app shell until the feature panels are split; it is easier to review once it mostly wires modules together.

## Suggested Order

1. Extract chat viewer and chat header.
2. Extract moderation window panels.
3. Extract realtime probe or simulator panel, whichever is smaller at that point.
4. Extract overlay controls.
5. Extract scene designer.
6. Reduce `main.tsx` to app shell and route composition.
