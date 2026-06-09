# Local Hosting With Cloudflared

## Idea

Run the platform locally while returning to streaming, and also maintain a dev server that automatically builds pushed commits so the platform can be tested through Cloudflare Tunnel / `cloudflared`.

This keeps the platform self-hosted without opening inbound ports on the local network.

## Why It Matters

The streamer wants to avoid expensive third-party stream tooling and keep control of the platform. Local hosting plus Cloudflare Tunnel can make the website, overlays, API, and control surfaces reachable without buying hosting immediately.

## Recommended Shape

Do not expose raw development servers as the normal public setup.

Preferred:

- develop and commit from the local workspace
- push commits to a remote repository
- have the dev server automatically pull/build/restart after pushes
- run local production builds
- expose stable local ports through `cloudflared`
- put Docker services on the server's shared `br187` network with their own `192.168.187.0/24` IP addresses
- use fixed ports only
- use clear hostnames per surface
- keep OBS/local-only surfaces private unless they need public access
- protect non-public surfaces with scoped URL token gates, and require login after the token for privileged pages

Example hostnames:

- `web-dev.maiks.yt` -> dev web app
- `api-dev.maiks.yt` -> dev API/realtime backend
- `overlay-dev.maiks.yt` -> dev overlay app if needed
- `control-dev.maiks.yt` -> dev control panel, protected

Production hostnames can come later when the site is ready for real use.

Use hyphenated dev hostnames instead of nested `*.dev.maiks.yt` names, because the nested shape has caused routing/certificate trouble before.

## Dev Server Auto-build Flow

Suggested workflow:

1. Work locally in this repository.
2. Commit small changes to `main`.
3. Push to the remote repository.
4. Update/push `dev` when a commit should auto-deploy to the dev server.
5. Dev server receives the `dev` push signal or runs a pull/build script.
6. Dev server installs dependencies if needed.
7. Dev server builds the apps.
8. Dev server restarts the services.
9. `cloudflared` exposes the dev services for realistic testing.

This gives a repeatable test environment that behaves more like the eventual hosted setup than raw local development.

The dev server script should keep logs and fail safely. A failed build should not replace the last working dev deployment.

Use the `dev` branch as the dev-server auto-deploy target. Early solo work can still use small direct commits on `main`; `dev` exists specifically so deployment can be controlled without inventing a full branch workflow too early.

Current dev deployment:

- local work is committed on `main`
- `main` is pushed to GitHub
- `main` is mirrored to `dev` when it should deploy
- `/var/projects/maiks-yt-dev/scripts/deploy-dev.sh` pulls `origin/dev`
- Docker Compose rebuilds and force-recreates the `maiks-yt-dev` container
- `.env` remains local to the server and is not tracked by git

## Cloudflared Routing Notes

Cloudflare Tunnel maps public hostnames to local services, such as `https://example.com` to `http://localhost:8080`.

Multiple public hostnames can point to different local services through one tunnel using ingress rules.

On `codex-server-1`, Docker services should use the external `br187` network and a fixed container IP. For the dev stack, route tunnel ingress to `192.168.187.21` rather than relying on host `127.0.0.1` port publishing.

Every tunnel config should have a final catch-all rule, usually `http_status:404`.

## Vite Dev-server Caution

Vite dev servers can be awkward through public tunnels because HMR uses its own connection behavior and the default dev port may not match the public origin.

If we expose Vite during development, use:

- fixed ports
- `server.strictPort`
- explicit allowed hosts
- correct HMR client port/host settings

For actual streaming or public use, prefer built Vite output served by the API/reverse-proxy/static server instead of raw Vite dev mode.

## Realtime Recommendation

Do not hard-code WebSockets or SSE as the only realtime transport before testing.

V1 spent significant time trying to get WebSockets working before switching to SSE, and SSE had its own problems later. V2 should make realtime transport an early spike, not an assumption.

Test through `cloudflared` with:

- WebSockets
- SSE
- OBS browser sources
- control panel
- reconnect behavior
- event replay/catch-up

Whichever transport wins, it needs:

- heartbeat/ping-pong
- automatic reconnect
- last-known-state snapshot
- event replay/catch-up after reconnect
- fallback static overlay state

The app should depend on typed events and a transport abstraction, so switching between WebSocket, SSE, or another transport does not require rewriting features.

## Limitations and Risks

- Local internet outage takes the platform offline.
- PC restart or crash takes the platform offline.
- Dev server outage takes the dev environment offline.
- Bad commits can break the dev environment unless builds are staged safely.
- `cloudflared` restart can drop long-lived realtime connections.
- Cloudflare edge updates can terminate WebSocket connections.
- WebSockets need heartbeats to avoid idle timeouts.
- Public traffic now reaches a local machine, so security must be serious.
- Control panel should be protected strongly with URL token gate, login, roles, and possibly Cloudflare Access.
- Development servers should not expose source code or unsafe dev endpoints.
- Vite HMR through a tunnel can be fragile.
- OBS overlays should handle backend/realtime connection loss gracefully.

## Build Requirements

- fixed local port plan
- dev server deploy script
- automatic pull/build/restart flow after pushes
- failed-build rollback or keep-last-good behavior
- local production run scripts
- cloudflared tunnel config
- hostname-to-service mapping
- realtime transport spike through cloudflared
- transport abstraction
- heartbeat/reconnect logic
- overlay last-known-state fallback
- startup health checks
- local backup strategy
- protected control panel access
- URL token access gates for non-public surfaces
- no raw dev server exposure for normal public use

## Example Port Plan

- `3000` web app
- `3001` API/realtime backend
- `3002` overlay static/server app
- `3003` control panel
- `3306` local MySQL, not exposed through public tunnel

The exact ports can change, but they should be fixed and documented.

Dev container IP:

- `192.168.187.21` for `maiks-yt-dev`

Current public dev hostnames:

- `web-dev.maiks.yt` -> `http://192.168.187.21:3000`
- `api-dev.maiks.yt` -> `http://192.168.187.21:3001`
- `overlay-dev.maiks.yt` -> `http://192.168.187.21:3002`
- `control-dev.maiks.yt` -> `http://192.168.187.21:3003`

These are configured in the `Maiks.yt` Cloudflare Tunnel and proxied DNS records point to the tunnel CNAME.

## Dev Server Script Requirements

- pull the latest commit
- install dependencies with the chosen package manager
- run tests or smoke checks
- build production outputs
- restart only after a successful build
- keep the previous working build if the new build fails
- write deploy logs
- expose health status for quick checks

## Open Questions

- Which machine is the dev server?
- Should deploy trigger from a webhook, scheduled pull, or manual command?
- Should the dev server use Windows services, Docker, or a process manager?
- Should the web app proxy API/realtime paths, or should `api.maiks.yt` be separate?
- Should overlay/control panel be public hostnames or local-only for OBS/control devices?
- Which realtime transport survives `cloudflared` and OBS best?
- Should Cloudflare Access protect the control panel?
- Which surfaces require token plus login, and which only need scoped overlay token?
- Should cloudflared run as a Windows service?
- Should all apps run behind one local reverse proxy instead of multiple tunnel ingress rules?
