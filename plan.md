# Maiks.yt Project Plan

## 1. Project Overview
Maiks.yt is a multi-purpose ecosystem designed to centralize gaming, streaming, and community-driven hobbies. It aims to provide a unified platform with subdomain-specific experiences, unified authentication, and integrated stream management.

- **Primary Site:** [maiks.yt](https://maiks.yt)
- **Development Site:** [dev.maiks.yt](https://dev.maiks.yt)

## 2. Detailed Project Plans
Detailed documentation for specific project components can be found in the [`plans/`](./plans/) directory:
- [**Channel Vision**](./plans/channels.md): Subdomain-specific hobbies (13 total), unique skinning, and server access.
  - [**Individual Channels**](./plans/channels/): Detailed plans for each hobby (Minecraft, HyTale, AI, etc.).
- [**Donation System**](./plans/donations.md): 'Pots', transparency vision (income/expense), and usage verification.
- [**Project Logic**](./plans/projects.md): Nested projects, parts (items), actions (work), and refund/mothballing logic.
- [**Stream Overlays**](./plans/overlays.md): Reusable components, scene-specific layouts, and comprehensive control panel.
- [**Viewer Profiles**](./plans/profiles.md): Customization (images/characters), donation history, and AI safety checks.
- [**OAuth & Auth**](./plans/oauth.md): Refined strategy (WorkOS/alternatives), multi-platform verification badges, and cross-platform auth.

## 3. Current Status
- **Production Readiness:** The `main` branch in `/var/projects/maiks-yt` is production-ready and features an auto-update watcher for seamless deployment.
- **Development Environment:** [dev.maiks.yt](https://dev.maiks.yt) is live and pointing to the Docker container at `192.168.187.21:3000`.

## 4. Technology Stack
- **Frontend Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS + CSS Variables (to support dynamic skinning/theming)
- **State Management:** React Context / Zustand
- **Database:** MariaDB (Production) / SQLite (Development local)
- **ORM:** Prisma
- **Authentication:** WorkOS (for OAuth 2.0 / SSO) or self-hosted alternatives.
- **Backend/API:** Next.js API Routes (Node.js)
- **Real-time:** Socket.io or Server-Sent Events (SSE) for overlays
- **Infrastructure:** Docker, Docker Compose, Cloudflared Tunnels
- **Network:** br187 Mesh Network (IP Range: 192.168.187.0/24)

## 5. Architecture & Infrastructure
- **Containerization:** Every service (Web, DB, Redis, Overlays) will run in Docker containers.
- **Routing:** A central reverse proxy (likely Nginx or Traefik) will manage subdomain routing based on Host headers.
- **Connectivity:** Cloudflared will expose the application to the public internet securely without opening local ports.
- **Inter-service Communication:** Will occur within the `br187` mesh network.

## 6. Feature Roadmap

### Phase 1: Core Foundation (Expanded)
- Setup Next.js mono-repo or project structure.
- Implementation of Subdomain Routing logic.
- Basic Theme system (Dynamic CSS Variables) for all 13 initial hobbies.
- Reusable overlay components and basic control panel.

### Phase 2: Authentication & Identity
- Integration with WorkOS or alternative OAuth providers.
- Identity verification system (linking Minecraft UUIDs, HyTale accounts, etc.).
- Global profile system with character badges and multi-platform verification.
- AI-driven safety checks for custom profile content.

### Phase 3: Donation & Financial Transparency
- "Pots" system (Nested pots for specific goals like Hardware, Servers, etc.).
- Detailed project parts (items) and actions (work) tracking.
- Public ledger with income/expense tracking and proof-of-purchase verification.
- Stripe/PayPal integration for automated processing.

### Phase 4: Stream Overlays & Engagement
- Real-time notification system (using WebSockets).
- Animated overlay cards for donations and milestones.
- Combined YouTube/Twitch chat interface for streamers.
- Comprehensive moderation actions directly from the control panel.

## 7. Deployment & Development Workflow
The project follows a standard "Stage-to-Production" lifecycle:

1. **Development:** All features are initially built and tested in `/var/projects/maiks-yt-dev`.
2. **Testing:** Verified on `dev.maiks.yt`.
3. **Merge:** After successful verification, changes are merged into the production branch in `/var/projects/maiks-yt`.
4. **Production Release:** The production Docker containers are rebuilt and deployed to `maiks.yt`.

---
*Created by Neural Bridge Planner*
