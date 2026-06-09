# Stream Simulator and Event Replayer

## Idea

Build a local stream simulator that can generate, record, and replay stream events in development.

Possible events:

- chat messages
- raids
- donations
- paid messages
- stream goal progress
- notification bursts
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

## Type-safety Notes

The simulator should use the same typed event contracts as the real system. Fake events should not use separate shapes.

## Open Questions

- Should replay be part of the control panel or a separate dev page?
- Should real stream sessions be recordable for later replay?
- How much sensitive data should be stripped from recorded events?
- Which event storm presets are needed first?
