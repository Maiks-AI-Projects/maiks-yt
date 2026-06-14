# Overlay Control Panel

## Idea

Create a separate control panel page for managing overlays during a stream. This page can live on a second monitor and update based on which overlay, scene, or stream mode is active.

Possible controls:

- toggle chat overlay
- switch layout
- switch theme
- move camera position
- trigger test notification
- show/hide sponsor spots
- mute AI readouts
- approve center-screen alerts
- activate emergency clean mode
- run local event replay/testing scenarios

## Why It Matters

OBS overlays are often browser sources that need to be controlled quickly while streaming. A separate control panel lets the stream be adjusted without editing OBS live.

The control panel is also the place where automation and manual override meet.

## Data Needed

- active overlays
- overlay connection status
- current scene/layout/theme
- widget visibility state
- sponsor toggle state
- chat safety state
- AI assistant state
- pending notifications
- available control actions
- current control panel complexity mode

## Build Requirements

- URL token access gate before login
- authenticated control page
- real-time connection to overlays
- overlay registration/heartbeat
- active state dashboard
- per-overlay controls
- global emergency controls
- low-distraction control mode
- optional advanced/product mode foundation
- role permissions for moderators or helpers
- state synchronization between OBS browser sources and control panel

## OBS Preload Concern

OBS sometimes needs browser sources to preload so overlays do not begin empty. This may mean active overlays should register themselves and wait in a ready state even when hidden.

It may also be acceptable for an overlay to be empty for a second if the OBS scene-switching view loads the next browser source before switching to it. The system should be designed to try a load-time data dump first, but be prepared to fall back to preloaded or always-connected overlays if OBS behavior is unreliable.

Possible design approaches:

- one master overlay that switches internal layouts
- multiple preloaded overlays that share global state
- separate overlays per scene with a control panel aware of which are connected
- scene-specific overlay URLs with parameters, such as scene, layout, theme, or camera position
- load-time state snapshot so newly loaded overlays can render quickly
- always-on event queue so newly activated overlays can catch up

## Preload Decision

Version one uses one shared master overlay browser source across OBS scenes. Keep that source loaded and connected when it is hidden so live notifications are not missed, but do not create separate preloaded overlay instances for every scene.

The immediate typed snapshot and last-known-good state remain responsible for startup and reconnect recovery. Real OBS testing must still confirm that reusing the source with shutdown-when-hidden disabled switches scenes without a blank frame or stale visual.

## Type-safety Notes

Control actions should be typed commands. Overlay state should be a typed snapshot that the control panel and overlay renderer both understand.

Access tokens should be typed by scope. A token that can load an OBS overlay should not be accepted as a control-panel token.

## Control Complexity Modes

For this project, the default control panel should be low-distraction because high-energy operation is not a realistic personal target.

If this later becomes a product, the foundation can support multiple complexity modes. For example, a simple mode with only critical controls and an advanced mode with analytics, diagnostics, and extra controls.

## Open Questions

- Can scene-specific URL parameters cover most layout/theme differences?
- Should control panel changes persist across streams?
- Should moderators have access to a limited control panel?
- What is the emergency clean mode: hide chat only, or hide chat, alerts, sponsors, and AI?
- Which controls belong in the low-distraction default view?
- Should the control panel always require both URL token and login?
