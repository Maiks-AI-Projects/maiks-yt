# Stream Simulator and Event Replayer

## Idea

Build a local stream simulator that can generate, record, and replay stream events in development.

Possible events:

- chat messages
- raids
- donations
- simulated support/payment events
- paid messages
- stream goal progress
- notification bursts
- notification queue pressure
- sponsor toggles
- layout/theme switches
- chat spam waves
- bot commands
- AI assistant triggers

## Why It Matters

Real-time stream systems are hard to test safely while live. A simulator lets the overlay, control panel, AI assistant, chat filters, and event queues be tested without risking a production stream.

It also helps test event storms, such as a raid arriving during donations while chat is moving quickly.

## Data Needed

- event fixtures
- recorded event sessions
- replay speed
- event timestamps
- event source
- target overlay/control state
- expected outcomes

## Build Requirements

- fake event generator
- event recording support
- event replay support
- controls in the control panel or dev panel
- replay speed controls
- event storm presets
- test scenarios for overlays and chat
- local-only safety controls

## Off-the-shelf Building Blocks

Use existing tools where they fit instead of building every test helper from scratch.

Useful candidates:

- Twitch CLI for mock EventSub events and mock WebSocket EventSub testing
- YouTube LiveChatMessages API fixtures or unlisted test live events for YouTube chat behavior
- Playwright for browser testing of website, overlays, and control panel
- Vitest for domain/event/unit tests
- MSW or similar request mocking for HTTP API/provider responses
- Storybook or a simple internal component preview if UI state previews become useful

These tools can test pieces of the system, but the project still needs a custom stream scenario layer because our combined events are specific to Maiks.yt.

Examples:

- Twitch raid plus fake YouTube chat burst plus project milestone update
- donation alert plus center-screen notification plus sponsor visibility toggle
- simulated support event using a real dev user's avatar and display name
- multiple top notifications arriving faster than they can display
- backend reconnect while overlay keeps last-known state
- private-message AI preamble while public chat continues

Related card: [Mock Support and Payment Simulator](mock-support-payment-simulator.md).

## Custom Layer

The custom part should be thin:

- normalize external/mock provider events into Maiks.yt typed events
- define reusable stream scenarios
- replay recorded event sequences
- generate event storms
- drive overlay/control-panel tests

The goal is not to build a fake Twitch or fake YouTube. The goal is to test how Maiks.yt reacts to realistic combined event sequences.

## Type-safety Notes

The simulator should use the same typed event contracts as the real system. Fake events should not use separate shapes.

## Open Questions

- Should replay be part of the control panel or a separate dev page?
- Should real stream sessions be recordable for later replay?
- How much sensitive data should be stripped from recorded events?
- Which event storm presets are needed first?
- Which notification queue scenarios should be tested first?
