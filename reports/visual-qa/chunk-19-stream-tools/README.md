# Dev Stream Tools Visual QA Fallback

Date: 2026-06-22

## Scope

Checked the deployed dev stream-tool surfaces at 1920x1080, 1600x900, and 1366x768:

- `https://web-dev.maiks.yt/tools/actions`
- `https://control-dev.maiks.yt/`
- `https://overlay-dev.maiks.yt/`
- `https://web-dev.maiks.yt/dev/test-console`

Private token values came from the ignored main-repo `reports/usable-urls.md` file and are redacted from `summary.json`.

## Tooling

- Computer Use was not exposed in this worker thread.
- The in-app Browser plugin was attempted first and failed during setup with: `privileged native pipe bridge is not available; browser-client is not trusted`.
- Fallback used local headless Chromium through the DevTools Protocol.
- This is not true installed-window/browser-chrome-free coverage.

## Findings

- `/tools/actions` rendered as a standalone tool surface at all target sizes with no normal website navbar, no horizontal overflow, and readable action cards.
- `control-dev` token-missing state rendered clearly at all target sizes with no normal website navbar and no horizontal overflow.
- `control-dev` authenticated state rendered clearly at all target sizes with no normal website navbar and no horizontal overflow.
- `control-dev` scene designer section rendered clearly at all target sizes after scrolling to the section. The 16:9 canvas preview and right-side slot controls stayed aligned with no horizontal overflow or obvious overlap.
- `overlay-dev` loaded at all target sizes with no normal website navbar and no horizontal overflow. The current ready state was visually blank because no live overlay/chat content was present during this no-server-state pass.
- `/dev/test-console` was readable at all target sizes and clearly labeled `DEV-ONLY TEST CONSOLE`, `Simulated Event Preview`, and `Local preview only`.
- `/dev/test-console` showed the normal website navbar. This was recorded in `summary.json`, but it is not a standalone stream-tool route under `/tools/*`.

## Limitations

- True installed-window QA remains open until Computer Use, an installed PWA window, or a trusted browser-control bridge is available.
- The authenticated control-panel fallback injected the redacted dev owner bearer into `api-dev.maiks.yt` requests through DevTools request interception. This verifies layout after authentication, but it is not a normal user login/session flow.
- Live overlay/chat content was not mutated in this pass to avoid touching dev server state. Prior Chunk 12 fallback covered fake/local chat visibility with server interaction.

## Artifacts

- Machine-readable summary: `reports/visual-qa/chunk-19-stream-tools/summary.json`
- Screenshots: `reports/visual-qa/chunk-19-stream-tools/*.png`
