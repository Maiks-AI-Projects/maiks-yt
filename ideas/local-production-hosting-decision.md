# Local Production Hosting Decision

## Decision

The first production deployment will remain self-hosted on `codex-server-1` and exposed through the existing `Maiks.yt` Cloudflare Tunnel.

The production shape will use Docker Compose on the existing `br187` network with fixed container addresses. Public surfaces keep separate hostnames for clear security boundaries:

- `maiks.yt` for the website
- `api.maiks.yt` for API and realtime traffic
- `overlay.maiks.yt` for OBS browser sources
- `control.maiks.yt` for streamer control tools

Development continues on the `*-dev.maiks.yt` hostnames and the separate V2 development database.

## Operational Rules

- Production runs built application outputs, not Next.js or Vite development servers.
- Cloudflare Tunnel targets the container network directly; application ports do not need public host bindings.
- MariaDB is never exposed through Cloudflare.
- Overlay URLs use scoped overlay tokens.
- Control and private admin surfaces use a scoped URL-token gate followed by authenticated role checks.
- Deployments build and test before replacing the running production containers.
- The previous successful image remains available for rollback.
- Database migrations and backups run before an application release that depends on schema changes.

## Why Separate Hostnames

Separate hostnames keep OBS, API, website, and privileged controls independently configurable in Cloudflare. They also avoid Vite/Next routing collisions and make token scope and CORS rules easier to reason about.

## Deferred Until Release Preparation

- final production IP allocation on `br187`
- production Compose file
- clean OAuth credentials and secrets
- Cloudflare Access decision for privileged surfaces
- automated rollback implementation
- uptime monitoring and backup alerts
