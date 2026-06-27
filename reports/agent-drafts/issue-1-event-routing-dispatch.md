# Issue 1: Safe Simulated Event Routing Dispatch

Worker: A
Branch: `dev`
Chunk: 21B

## Summary

Added the dev/test-only simulated Event Routing dispatch path for `/dev/test-console`.

The new path:

- accepts only `test/system` dispatches or explicitly simulated website/provider-style events
- rejects real provider intake, real website production events, and real money before history writes
- validates routing-rule safety before persistence
- writes safe history rows with `is_test`, `is_simulated`, `test_resettable`, and `is_real_money = false`
- queues approval-required simulated events in `event_approval_queue`
- checks opt-out/cooldown gates before stream-visible simulated outcomes
- reports `publicPlayback: false` and does not emit overlay/control playback

## Changed Files

- `packages/domain/src/events/event-routing-dispatch.types.ts`
- `packages/domain/src/events/event-routing-dispatch.rules.ts`
- `packages/domain/src/events/index.ts`
- `packages/domain/test/event-routing-rules.test.ts`
- `apps/api/src/event-routing/event-routing-dispatch.types.ts`
- `apps/api/src/event-routing/event-routing-dispatch.service.ts`
- `apps/api/src/event-routing/event-routing-dispatch-store.service.ts`
- `apps/api/src/event-routing/event-routing-dispatch.route.ts`
- `apps/api/src/event-routing/index.ts`
- `apps/api/src/main.ts`
- `apps/api/test/event-routing/event-routing-dispatch-api.test.ts`
- `apps/web/src/app/dev/test-console/test-console-client.tsx`

## Suggested Tracker Updates

- Mark Chunk 21B as worker-implemented and ready for coordinator review.
- Record that simulated dispatch remains dev/test-only and does not open real provider, real website production, money, moderation, auth, overlay/control playback, deployment, or server-state gates.
- Record that user-facing opt-out settings UX is still not implemented; the dispatch path blocks stream-visible opt-out-aware simulated events if it cannot safely identify a user to check.

## Gates Left Closed

- Real provider intake stays closed.
- Real website production dispatch stays closed.
- Real money, ledger, credits, refunds, and provider payments stay closed.
- Moderation enforcement stays closed.
- Auth and permission changes stay closed.
- Migrations and schema changes stay closed.
- Overlay/control playback stays closed.
- Deployments, server changes, commits, and pushes stay closed.
