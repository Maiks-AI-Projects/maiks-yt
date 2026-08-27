# Production PWA redesign visual QA

Date: 2026-08-27

This is local synthetic verification of the first production implementation of the approved Chat, Moderation, Control, and Notifications redesign. It did not connect to production providers, accounts, OBS, or server state.

## Approved references

- Chat: `/home/michael/.codex/generated_images/01a01614-cba1-7c60-a437-47c1096a7981/exec-a100d88f-4515-4dc4-b24a-08a75454e6bd.png`
- Moderation: `/home/michael/.codex/generated_images/01a01614-cba1-7c60-a437-47c1096a7981/exec-58deae1e-871d-409f-a045-fa00e301f855.png`
- Overlay controls: `/home/michael/.codex/generated_images/01a01614-cba1-7c60-a437-47c1096a7981/exec-7e4936cc-52f2-4c22-99d2-061e06bc305b.png`

## Captures

- `chat-1920x1080.png`
- `chat-960x1080.png`
- `moderation-1366x768.png`
- `moderation-mobile-768x1024.png`
- `control-overview-1366x768.png`
- `control-overlay-1366x768.png`
- `control-overlay-960x1080.png`
- `control-music-1366x768.png`
- `control-music-720x900.png`
- `control-navigation-owner-1366x768.png`
- `control-navigation-helper-1366x768.png`
- `notifications-390x844.png`

## Findings

- Chat keeps the feed as the main content, preserves newest-first operation, provider tinting, compact health state, Emergency clear, attention controls, and half-screen usability.
- Desktop chat actions remain hidden until hover or keyboard focus. Focus reveals Hide, Ban, and Options. Options opens the complete allowed action list.
- Touch emulation exposes one Options control after selecting a row, then reveals Warn, Hide, Ban, note, provider, and allow actions.
- Moderation uses its own permission-derived internal navigation and a selected-message context panel without adding cross-PWA navigation.
- Control separates Overview, Stream Controls, Overlays & Scenes, Actions, Music, and Provider Health. The compatibility scene editor warns that saving can update connected master-overlay Browser Sources, shows only working controls, and stacks cleanly at half-screen width without horizontal overflow.
- Music uses authoritative playback state, human-readable status copy, and a compact playback-output indicator. It does not expose a placeholder Browser Source URL or token-shaped setup copy. Both captured widths fit without horizontal overflow.
- The owner Control navigation shows all six permitted pages. A synthetic helper projection shows only Overview, Stream Controls, and Overlays & Scenes; a direct `/control/music` load resolves to `/control`, Provider Health is absent, and neither view has horizontal overflow.
- Notifications has its own compact dark mobile layout and install manifest.

The implementation follows the approved density and hierarchy. Chat retains one extra compact status and attention row because those working production controls need to remain reachable.

## Blocked proof

Installed-PWA authentication, provider data, real moderation effects, overlay changes, music output, and notification actions were not verified against production. The initial redesign pass was captured while `codex-server-1` was unreachable and all production origins returned Cloudflare `530`; the later Music captures use local credential-free request interception. These screenshots and interaction checks prove the local implementation only.
