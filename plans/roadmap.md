# Maiks.yt Project Roadmap

This roadmap outlines the phased development of the Maiks.yt ecosystem, covering infrastructure, identity, dynamic content, financial transparency, gaming integration, and stream engagement.

## Phase 1: Foundation & Identity (Infrastructure, WorkOS, Basic Profiles)
*Focus: Establish the core architecture, authentication, and basic user data models.*
- [ ] Initialize Next.js App Router monorepo or project structure in `/var/projects/maiks-yt-dev`.
- [ ] Configure Docker Compose for Web (Next.js), MariaDB, and Redis.
- [ ] Implement Subdomain Routing logic using Host header detection.
- [ ] Integrate WorkOS for OAuth 2.0 (Google, Discord, GitHub, etc.).
- [ ] Design and implement the initial Prisma schema for Users and Profiles.
- [ ] Develop the "Maiks-YT ID" generation and linking system.
- [ ] Set up the dynamic theme system (CSS Variables + Tailwind CSS) foundation.
- [ ] Configure Cloudflared Tunnels for secure public access to `dev.maiks.yt`.

## Phase 2: Subdomain Ecosystem (Routing, Dynamic Skinning, Hobby Metadata)
*Focus: Create unique, branded experiences for all 13 initial hobbies.*
- [ ] Create 13 initial hobby landing pages (mc, ht, sf, talking, wow, me, 3dp, prog, bd, tech, ai, out, oj).
- [ ] Implement unique CSS/Tailwind themes for each hobby (e.g., pixelated for `mc`, industrial for `sf`).
- [ ] Define and implement hobby-specific metadata (Server status, blueprints, etc.).
- [ ] Build the central `maiks.yt` landing page that acts as a directory for all subdomains.
- [ ] Implement a server status component (e.g., Minecraft/Satisfactory server health) for relevant subdomains.
- [ ] Create a blueprint/code repository for the `prog`, `3dp`, and `sf` channels.

## Phase 3: The "Life History" (Prisma, Donations, Nested Projects, Public Ledger)
*Focus: Build a transparent, hierarchical project and donation system.*
- [ ] Implement the "Pots" (Nested Projects) hierarchy in the database.
- [ ] Define "Parts" (Items) and "Actions" (Work) models for granular project tracking.
- [ ] Develop the Public Ledger for real-time, transparent donation logging.
- [ ] Implement Income/Expense tracking logic with budget category separation (Tech vs. Personal).
- [ ] Create a "Proof of Purchase" upload system for receipts and screenshots.
- [ ] Build the "Hardware Transparency" view (parts list, store links, funding progress).
- [ ] Implement automated refund and mothballing logic for cancelled or paused projects.

## Phase 4: Verification & Gaming (Minecraft/HyTale OAuth, UUID Verification, Character Badges)
*Focus: Link gaming identities and provide verifiable proof of ownership.*
- [ ] Implement Minecraft account ownership verification (server-side command or skin check).
- [ ] Architect the HyTale account linking system (future-proofed for the official API).
- [ ] Create multi-platform verification badges (Discord, Twitch, YouTube, etc.).
- [ ] Implement the "Verified Game Characters" section on user profiles.
- [ ] Add "Badge Tiers" based on platform activity and duration of verification.
- [ ] Build a "Server Listing" view for users to see which game servers they are whitelisted on.

## Phase 5: The "Living Room" Overlays (Real-time WebSockets, Reusable Overlay Components, Control Panel)
*Focus: Enhance the streaming experience with interactive, real-time components.*
- [ ] Develop modular overlay components (Goal bars, alert boxes, event lists).
- [ ] Implement scene-specific layouts (In-Game, Talking, BRB/Intro/Outro).
- [ ] Build the "Unified Control Panel" for managing stream elements in real-time.
- [ ] Set up WebSockets (Socket.io or SSE) for low-latency notification and overlay updates.
- [ ] Create a "Combined Chat" interface (integrating YouTube, Twitch, etc.).
- [ ] Add "Engagement Triggers" (animations/sounds) controllable from the dashboard.

## Phase 6: AI Safety & Moderation (AI-checked Profile content, Code submissions, automated chat moderation)
*Focus: Leverage AI to ensure a safe community and verify content.*
- [ ] Integrate AI models (e.g., Gemini or OpenAI) for screening usernames, images, and messages.
- [ ] Implement automated chat moderation logic within the control panel.
- [ ] Develop AI-assisted verification for hardware usage and project milestones.
- [ ] Add content tagging and verification for user-submitted blueprints and code snippets.
- [ ] Establish automated enforcement of community safety guidelines.

## Phase 7: Production Launch & Synchronization (Merge dev -> main, auto-deploy verification)
*Focus: Finalize the deployment pipeline and launch the full ecosystem.*
- [ ] Finalize the "Stage-to-Production" lifecycle (dev.maiks.yt -> maiks.yt).
- [ ] Implement automated merge scripts (git merge dev -> main).
- [ ] Configure the production auto-update watcher in `/var/projects/maiks-yt`.
- [ ] Perform a comprehensive security audit (RBAC, data encryption, API security).
- [ ] Launch the full ecosystem and monitor system performance and stability.

---
*Generated by Neural Bridge Planner*
