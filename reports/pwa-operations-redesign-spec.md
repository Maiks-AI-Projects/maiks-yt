# PWA Operations Redesign Specification

Updated: 2026-08-27

Grounded against: production branch commit `f1ecd02`

Status: approved product direction; first production UI implementation integrated locally and verified with synthetic desktop, half-screen, touch, and mobile evidence; not deployed or live-verified

Implementation review base: production commit `db7c8af`

Local visual evidence: `reports/visual-qa/production-pwa-redesign/README.md`

## Authority And Scope

This is the canonical specification for the Maiks.yt operational PWAs. It was reconciled against the active production repository, including the current control-panel application, web tool routes, manifests, authentication gates, permissions, APIs, overlay runtime, moderation state, Notifications implementation, and production music system.

The approved corrected mockups are visual references for density, hierarchy, and responsive behavior. They are not generated UI code and do not override the real authorization, API, or runtime contracts documented here.

Operational responsibility, not one page per app or one monitor per app, defines the boundaries. Chat has no sidebar. Moderation and Control have compact internal navigation only. Notifications stays separate. The future AI PWA is separate and deferred. There is no cross-PWA navigation rail or window switcher.

Michael authorized the first UI implementation after approving this specification. That implementation does not authorize migrations, authentication changes, secret or provider configuration changes, deployment, or server changes.

### Status vocabulary

- **Implemented**: present at `f1ecd02` and backed by the named production code/API/runtime.
- **Partial**: useful production behavior exists, but its access, interaction, responsive, or safety contract does not yet meet this specification.
- **Mockup only**: present in the approved visuals but not in production code.
- **Backend/runtime gap**: the UI cannot safely deliver the behavior through the current production APIs or runtime state.
- **Preserve**: working production behavior that the redesign must adapt rather than replace.

## Product Boundaries

### Chat PWA

Chat is Michael's private chat-first operating window. It has no sidebar and no routine links for switching to other PWAs. The feed owns the viewport.

It combines Twitch, YouTube, and Discord messages. Provider distinction is limited to a restrained alpha background in the message area: purple for Twitch, red for YouTube, and blue for Discord. The surrounding application remains neutral dark.

Michael's immediate message controls are **Hide**, **Ban**, and **Options**. They remain hidden until message hover or keyboard focus. **Warn** is inside Options. On touch or another non-hover device, selecting a message reveals one compact Options control; that menu exposes the same allowed actions through a touch-safe flow. Ban always requires explicit confirmation and must name whether the action is Maiks.yt-local or provider-side.

Compact **Emergency clear** remains in a stable top-bar location. It does not dominate the feed. Chat is owner-only, so it is available to Michael after the server confirms `chat:emergency-clear`.

Messages are newest first: new messages appear at the top and older messages continue downward. Live-follow is active while Michael is at the newest-message edge. Scrolling down to older messages pauses live-follow, preserves the item being read, and accumulates a visible new-message count. Resume returns to the top and re-enables follow.

Chat must remain effective full-screen, at approximately 960x1080 beside the future AI PWA, and on a normal single-screen device.

### Moderation PWA

Moderation is for helpers/moderators and for Michael when no helper is available. It opens on Chat and uses the same normalized feed and provider treatment as Chat.

A compact internal sidebar exposes only pages granted by the signed-in user's effective permissions. It collapses to icons. Its pages are Chat, Active Moderation, Applied Rules, Approvals & Queues, User Context, and Audit & History. Actions are permission-derived; the interface must not imply that every moderator has Timeout, Ban, Emergency clear, provider moderation, or rule retraction.

There is no separate Live Helper page in the target architecture. Useful production data currently aggregated by `/admin/live-helper` must move to its responsible Moderation page, the separate Notifications PWA, or an Admin surface before the old page/read model is retired.

At narrower widths, selected-user context becomes a drawer rather than permanently narrowing the feed.

### Control PWA

Control is Michael's live stream-operations PWA. It is a focused multi-page app with a compact collapsible internal sidebar. Its pages are Overview and stream controls, Overlays & Scenes, Actions, Music, and Provider Health & Recovery.

Control excludes the Simulator, fake/local event senders, notification/redeem test tools, raw transport probes, setup/configuration clutter, and routine AI settings. Those belong in explicit development or Admin surfaces. A future emergency AI disable/recovery action may appear only if it is a clearly defined operational failsafe; normal AI configuration belongs to the future AI PWA.

### Notifications PWA

Notifications is a focused, mobile-friendly actionable notification inbox and recovery surface. It is not folded into Chat, Moderation, or Control. It preserves durable notification rows, Web Push, explicit signed-out/forbidden/unavailable states, and network-only private data.

### Future AI PWA

AI will be a separate PWA. It is not designed or implemented in the active phases below. The only active dependency is that Chat remains usable at approximately half-screen. The current inert `/ai` control-origin window is not an approved production boundary and must not remain in routine operational navigation.

## Production Current-State Inventory

### Routes, shells, and manifests

| Surface | Current production route and shell | Manifest/service worker | Status against target |
|---|---|---|---|
| Chat | `/chat` on the control origin. `apps/control-panel/src/main.tsx` exact-path branches to `ChatWindowHeader`, `ChatServiceStatusStrip`, and `StreamerChatViewer`. | `chat-manifest.webmanifest`; id/start/scope are `/chat`. No control-panel service worker is registered. | Partial. It has a separate install identity, newest-first feed, provider tints, moderation controls, provider health, and Emergency clear. Cross-PWA Open controls, always-visible row actions, follow behavior, density, owner authorization, and half-screen layout need work. |
| Moderation | `/moderation` on the control origin. The exact-path branch renders a header plus `ModerationControlWindow`; Chat is its initial in-memory panel and a select changes panels. | `moderation-manifest.webmanifest`; id/start/scope are `/moderation`. No control-panel service worker is registered. | Partial. It is separately installable and receives server-derived action/panel access. It does not have target routes/sidebar/pages, and still exposes Live Helper and AI concepts. |
| Control | `/control` on the control origin; unrecognized paths also fall through to the Control view. One long page contains overlay status/controls, scene designer, optional operations details, Realtime Probe, and Simulator. | `manifest.webmanifest`; id/start/scope are `/control`. No service worker is registered. | Partial. Install identity and many live overlay controls exist. Focused internal pages, compact shell, owner-enforced APIs, Actions/Music integration, and product filtering do not. |
| Notifications | `/tools/notifications` on the web origin, rendered as a standalone tool body without the normal website header. | It points to the shared `/manifest.webmanifest`, whose id/start are `/tools/actions` and whose scope is `/tools/`; Notifications is only a shortcut. `notification-service-worker.js` handles push and notification clicks and has no fetch/cache handler. | Partial. Durable inbox and push work, but it is not its own install identity and its current UI is spacious/light rather than the approved compact dark operations language. |
| Action Panel | `/tools/actions` on the web origin. | It owns the current shared Stream Tools manifest identity. | Implemented working surface. The target Control Actions page should adapt this API/UI behavior; keep the route as a compatibility path until parity and installed-app transition are proven. |
| AI prototype | `/ai` on the control origin. | It receives the normal Control manifest selection. | Existing inert prototype only. Remove it from routine PWA links; retain dev-only or retire until a separately approved AI phase. |

The control-panel Vite app has no route module today. `main.tsx` compares `window.location.pathname` with exact strings, and an unknown path becomes the Control page. The target nested pages therefore need one typed route registry/router with explicit not-found/fallback behavior. Do not extend the current boolean-path pattern.

### Current navigation and presentation

- Chat's `ChatWindowHeader` contains an Open dropdown for Control, Moderation, AI, Notifications, provider Admin, and Live Helper. This is the current cross-PWA switcher and must be removed.
- Moderation's outer header links to Chat and Control; its toolbar links to AI and uses a panel select. These routine cross-PWA links must be removed.
- Control itself has no sidebar and renders one vertically growing dashboard.
- `apps/control-panel/src/styles.css` is dark, but uses relatively large page padding and stacked cards. It already contains the production provider tints.
- The production Admin overhaul in `apps/web/src/app/admin/admin-shell.tsx` and `admin-navigation.module.css` supplies the approved visual reference: dark canvas, compact top bar, grouped internal rail, permission-aware destinations, restrained borders, and responsive mobile navigation. Its Next.js shell is not directly reusable inside the Vite control app; shared tokens/primitives should be extracted without coupling the apps.
- Notifications still uses older light tool styles in `apps/web/src/app/globals.css`; it needs the shared dark operations tokens.

### Authentication and token gates

| Surface/API family | Current production gate | Limitation to address |
|---|---|---|
| Initial control-origin app | A `control:open` URL token is captured into `localStorage`, removed from the URL, and validated. Because Control tokens are defined with `requiresLogin: true`, the client then requests `/account/session`. | The client accepts any valid signed-in session; it does not prove Michael/owner for Chat or Control. Client gating also cannot replace API authorization. |
| Chat messages, provider status/reconnect, and Chat WebSocket | Valid `control:open` token in query/body; the WebSocket token is in its connection URL. | These APIs do not independently require a session, linked domain user, or Chat/owner permission. They must be hardened before Chat can be called owner-only. |
| Moderation access/actions/rules/audit | Valid `control:open` token plus a signed-in linked domain user and effective role permissions. | This is the strongest current operational pattern. Panel/action mapping still needs cleanup, and UI currently shows some denied actions disabled instead of filtering them. |
| Emergency clear | Valid `control:open` token plus `chat:emergency-clear`. | Correctly permission-derived. Preserve this double gate. |
| Other overlay reads/mutations and scene save | Valid `control:open` token only. | Most endpoints do not independently enforce the token's `requiresLogin` metadata or an owner/capability check. Direct API use is broader than the shell implies. |
| Actions | Active auth session, linked domain user, and `action-panel:view`; decisions additionally require `action-panel:decide` or the category-specific decision capability. | Suitable server-authoritative pattern. Cross-origin Control consumption must preserve cookie/session and CORS behavior. |
| Music Admin | Active auth session, linked domain user, and `music:manage` or wildcard. | Working. This is Admin/catalog authority, not automatically live playback authority. |
| Music play-history append | Active auth session, linked domain user, and `music:play-control` or wildcard. | Working narrow playback capability, but there is no player/queue runtime to control yet. |
| Notifications | Active auth session, linked domain user, and `notifications:manage` or wildcard. | Working. Session loss is currently a blocking state with manual recovery. |

The control access token is stored as `maiks.yt.control.accessToken`. The non-production dev bearer is separately stored as `maiks.yt.devAuthToken`. URL access tokens can expire or be revoked, but the UI validates only at initial load and individual endpoint enforcement is inconsistent. These tokens are launch gates, not role/permission substitutes.

### Current permissions and capability behavior

Relevant production capabilities already represented in code are:

- owner wildcard `*`;
- `chat:view`, `chat:hide-message`, `chat:ban-user-local`, `chat:warn-user`, `chat:allow-message`, `chat:provider-moderate`, and `chat:emergency-clear`;
- `moderation-rules:view`, `moderation-rules:retract` in Admin permission management, and `moderators:manage`;
- `action-panel:view`, `action-panel:decide`, and category-specific Action Panel decision capabilities;
- `notifications:manage`;
- `music:manage` and `music:play-control`;
- `provider-integrations:manage` on provider control APIs, while the aggregate provider status API currently requires wildcard.

The seeded moderator ladder grants Chat view, allow, hide, warn, and rule view at every level; level 2 adds Emergency clear and level 3 adds local Ban. It does not grant provider moderation by default. The redesign must continue to derive actions from the access response rather than from a generic “moderator” label.

Production inconsistencies to correct during implementation:

- The standalone Chat component uses a hard-coded all-actions-enabled default. Michael is expected to have wildcard, but the read route is not owner-enforced and the UI default is not a server permission response.
- Moderation uses the server access response, but `showUnavailableActions` deliberately renders denied actions disabled. The approved product hides actions and navigation the actor does not have; explanations belong to a capability/help disclosure, not a misleading permanent action row.
- The moderation backend currently allows rule retraction when the actor has any local hide/ban/warn/allow capability. Admin already names `moderation-rules:retract`; the route and UI should use that explicit capability (wildcard still applies).
- Pending Approvals and the Live Helper panel use manager/fake-local checks that do not line up cleanly with Action Panel decision capabilities. Target projections must use the capability of the underlying action.

### Chat and moderation data/API inventory

| Need | Current production dependency | Current state |
|---|---|---|
| Unified messages | `GET /streamer-chat/messages`, `WS /streamer-chat/live`, `StreamerChatRuntime` | Implemented in memory. New messages are prepended and runtime history is capped. No paused-follow/anchored-reading contract. |
| Provider health/reconnect | `GET/POST /streamer-chat/{twitch,discord,youtube}-{status,reconnect}` | Implemented for read-only intake state and restart attempts. Chat currently exposes clickable recovery; target routine recovery belongs in Control. |
| Local quick moderation | `POST /streamer-chat/moderation/{hide,ban,warn,allow}` | Implemented and permission-gated. Hide/ban/allow current state and audit are durable; runtime state is hydrated for immediate filtering. Ban has no UI confirmation today. |
| Warning delivery | Same `warn` route plus provider warning delivery services | Implemented fail-closed for Discord, Twitch, and YouTube when write credentials/context permit. Local warning applies first; provider delivery reports sent/skipped/failed. |
| Provider moderation | `POST /streamer-chat/moderation/provider-action` | Twitch/Discord delete, 10-minute timeout, and ban are fail-closed behind `chat:provider-moderate` and provider context. YouTube destructive provider actions remain unavailable. |
| Applied rules and audit | `GET /streamer-chat/moderation/rules`, `GET /streamer-chat/moderation/audit`, `POST /streamer-chat/moderation/rules/retract` | Implemented. Current clients poll rules/audit every 10 seconds. Permission mapping for retract needs correction. |
| Active moderation | `moderation_active_states`, `moderation_audit_logs`, moderation store/runtime | Partial. Current rules cover Maiks.yt-local message/author effects and durable history; provider-side state and full policy/strike semantics remain gated. |
| Approvals/queues | Action Panel APIs; event-routing approval data; `/admin/live-helper` read model | Partial. Working data exists, but Moderation needs a permission-safe projection and decision mapping rather than a summary count. |
| User context | Message provider/user identifiers, linked-account/account APIs, moderator grant data | Backend gap for the target. There is no single moderator-safe, redacted selected-user projection. |
| Live Helper summary | `GET /admin/live-helper` and `/admin/live-helper` web page | Implemented read-only compatibility surface containing pending approvals, warnings/critical notifications, active helper grants, simulated history, and fake/local moderation summaries. It mixes responsibilities and includes development-only data; split it rather than copying it into the new sidebar. |

### Control and overlay data/API inventory

| Need | Current production dependency | Current state |
|---|---|---|
| Overlay status | `GET /overlay/status` | Implemented in the in-memory `OverlayRuntime`: active connections, presentation state, Emergency clear, chat/order, sponsor, top/center, AI mute, and goal state. Polled every five seconds by Control. |
| Live stream controls | Presentation state, Emergency clear, top-bar, center, chat visibility/order, sponsor visibility, and goal endpoints | Implemented and broadcasts snapshots to connected overlay clients. Most mutations are token-only and need an owner/session capability gate. |
| Scene list/edit | `GET /overlay/scenes`; client drag/resize, visibility/aspect controls, validation | Implemented useful geometry/editor foundation. Preserve it. |
| Scene duplicate | Client clones a scene and sends it to `POST /overlay/scenes/save` | Partial. The copy is server-saved immediately into the runtime map, though it is not live unless selected. It is not a server-recognized draft. |
| Scene save | `POST /overlay/scenes/save` | Unsafe for the approved contract. It replaces the in-memory scene definition and immediately broadcasts snapshots; saving the active scene can change live output. |
| Preview | Client-side schematic canvas | Partial. It previews geometry only; it is not a private instance of the real overlay renderer and cannot prove live equivalence. |
| Snapshot/rollback | None | Backend/runtime gap. There are no immutable scene versions, apply operation, pre-apply snapshot, or rollback endpoint. |
| Actions | `GET /actions`; `POST /actions/:id/decision` | Implemented with permission-derived decisions, transaction/optimistic status checks, and recent history. Preserve and adapt. |
| Provider operations | Chat status/reconnect APIs; owner Admin provider status and intake health/control APIs | Partial. Production data and recovery controls exist across APIs, but Control needs a compact owner-operational projection. Raw intake logs/configuration stay in Admin. |
| Runtime durability | `OverlayRuntime` fields and scene map | In-memory. API restart resets scene edits and live operational state to code defaults. This blocks a production-safe rollback guarantee. |

### Production music inventory: preserve, then add live operations

Production does have a substantial music backend and web implementation. The redesign must build on it.

Implemented production foundations:

- Thirteen music tables: provider policies, tracks, sources, immutable license snapshots, blacklist entries, playlists, playlist membership, user ranked picks, anonymous request buckets, track requests, play history, review queue, and review events.
- Rights-aware selection rules for allowed current provider policy, eligible rights, live/VOD safety, blacklist precedence, and fail-closed review states. Spotify is hard-blocked.
- Public `/music` catalog/search/preview/request flow using `GET /music/catalog` and `POST /music/requests`, including a privacy-preserving daily anonymous request bucket.
- Signed-in `/account/music` ranked Top 10 read/update using `GET/PUT /account/music/top-tracks`.
- Owner music Admin split across `/admin/music`, `/admin/music/catalog`, `/admin/music/playlists`, `/admin/music/review`, and `/admin/music/history`.
- Admin APIs for provider policies, catalog tracks, sources, license snapshots, playlists/membership, blacklist/revoke, review queue resolution, and playback history reads.
- Shared searchable track selection and preview player with play/pause/seek on public, member, and Admin surfaces.
- Owner-run YouTube Audio Library export/download plus audio upload and manifest dry-run/apply APIs. It verifies current Attribution-required/CC BY 4.0 evidence, local audio format/checksum, manifest freshness/completeness, provider/source identity, and appends license evidence without deleting history.
- `POST /admin/music/play-control/history`, gated by `music:play-control`, validates live-safe `played-full` or non-public `admin-preview` source selection and records immutable safety/license/source snapshots. Skip/queued-skip outcomes enter review; a normal stop does not.

Genuinely missing live Control music operations:

- no `/music/player` OBS/browser audio source or durable player runtime;
- no `/music/overlay` now-playing/attribution/safety/vote surface;
- no current-track/position/paused/volume state API or real-time player status;
- no operator queue projection for persisted public requests, and no accept/reject/reorder/next commands;
- no play/pause/resume/skip/stop/next/fade controls or idempotent command contract;
- no Control Music page;
- no viewer voting workflow.

The existing request records, catalog, preview player, playlists, and play-history endpoint are foundations, not proof of a live player. The Control Music page should first expose only operations backed by authoritative state. It must never simulate playback or call an Admin preview “live.”

### Notifications inventory

- `GET /admin/notifications` lists up to 100 durable rows and returns unread/critical counts.
- Status mutations mark rows read or archived.
- Push config, subscribe, revoke, and local test UI are implemented; warning/critical rows can dispatch Web Push when configured.
- The page polls every 30 seconds and sorts newest first.
- `actionUrl` supports a related-page recovery link.
- The service worker only handles push/click and same-origin click routing. It does not intercept fetch or cache private responses.
- Current responsive CSS changes cards and controls to one column below 680px, but controls become full-width and the overall light layout is not compact.
- Include-archived is component memory only. No UI scale or other PWA preference is persisted.

### Current device preferences and responsive behavior

- Implemented device persistence: `maiks.yt.control.panelMode`, `maiks.yt.control.accessToken`, and the dev bearer token use `localStorage`.
- Not implemented: UI scale, Control/Moderation sidebar state, selected internal page, Chat live-follow/filter preference, or Notifications filter preference.
- Moderation selected panel and Notifications include-archived reset on reload.
- Control content stacks below 820px; status groups become two columns and scene editor becomes one column. Below 560px, action groups become one column. This is functional but wastes too much feed space for half-screen Chat.
- Chat provider status changes to three full-width rows below 820px. That directly conflicts with the approved single compact half-screen toolbar.
- Existing visual smoke covered 1920x1080, 1600x900, and 1366x768 without horizontal overflow. It did not validate the target 960x1080 layout, installed persistence, hover/focus/touch parity, or the new page architecture.

## Remove, Move, Or Hide Without Losing Useful Work

| Current production surface/control | Target disposition |
|---|---|
| Chat Open dropdown and Moderation Chat/Control/AI links | Remove routine cross-PWA navigation. A contextual link may appear only when a specific recovery requires Admin or Control. |
| Clickable provider recovery in Chat | Keep compact read-only health in Chat. Move routine retry/recovery to Control Provider Health & Recovery. Chat may show a contextual degraded-state link. |
| Moderation Live Helper panel | Remove. Split real approval data into Approvals & Queues, current effects into Active Moderation, helper/user information into User Context, and history into Audit & History. Notifications stay in Notifications. Do not carry simulated-history summaries into live Moderation. |
| `/admin/live-helper` page/API | Keep temporarily as a compatibility/read-model source. Hide from routine operational navigation, then narrow/retire only after each useful field has a named destination. |
| Control Realtime Probe, Simulator, fake chat sender, top/center/redeem test buttons, and raw API/surface labels | Remove from Control. Retain the underlying development tools/endpoints only in explicit development/testing surfaces until separately retired. `/admin/testing` is already retired; do not propose moving them back there. |
| Routine AI mute and `/ai` links | Remove from Chat/Moderation/Control navigation. Keep the prototype dev-only or retire it. A future emergency-only AI recovery contract requires separate approval. |
| Current one-page Control | Split into focused pages while preserving live overlay status/toggles, scene geometry work, and Action Panel/music systems. |
| `/tools/actions` route and manifest ownership | Preserve as compatibility until `/control/actions` reaches parity. Then deliberately deprecate/redesign its install identity; do not silently break installed links. |
| Shared `/tools/` manifest used by Notifications | Give Notifications a dedicated manifest id/start/scope. Do not let `/tools/actions` launch an installed Notifications app. |
| Scene `Save scene` | Do not expose as a live-operational action. Replace with draft save and explicit Apply live. The current immediate-broadcast endpoint may remain only behind a development compatibility path until callers migrate. |
| Music Admin/catalog/request/history implementation | Preserve. Control consumes narrow live-operational projections; it must not duplicate the Admin authoring UI or replace rights/safety rules. |

## Target Route And Page Matrix

Root routes remain stable for installed apps. Explicit deep links win. Otherwise Control and Moderation may restore the last allowed page stored on that device. If a remembered page is invalid or no longer permitted, fall back to the PWA default without revealing its label or data.

### Chat

| Route | Default landing | Intended roles | Required permission/capability | Critical live data | Available actions | Backend/API dependency | Empty/error/reconnecting behavior | Compact/collapsed behavior |
|---|---|---|---|---|---|---|---|---|
| `/chat` | Yes | Michael only | Valid `control:open`, active session, linked owner/wildcard identity; action booleans still server-derived | Unified messages, source/author/time, compact provider health, live-follow/paused count, Emergency-clear state | Hover/focus Hide, confirmed local Ban, Options; Options contains Warn and only allowed secondary/provider actions; touch Options flow; Emergency clear/Restore; resume follow; compact filter menu | Existing message/WS/status/moderation/overlay APIs plus owner enforcement for Chat reads and socket | Empty: quiet waiting state. Provider loss: keep current in-memory feed visible with compact degraded status. WS loss: bounded retry and deduplicated snapshot. Auth/token loss: clear private state and fail closed with relaunch/sign-in recovery. | No sidebar. One compact top bar. 1920 favors one-line rows; ~960 allows two-line rows. Secondary filters go to overflow before feed width is reduced. |

### Moderation

| Route | Default landing | Intended roles | Required permission/capability | Critical live data | Available actions | Backend/API dependency | Empty/error/reconnecting behavior | Compact/collapsed behavior |
|---|---|---|---|---|---|---|---|---|
| `/moderation` | Yes | Helpers/moderators; Michael fallback | Window access plus `chat:view` or wildcard | Unified chat, provider state, permission map, selected-user summary | Only granted message actions; Warn inside Options; user drawer; Emergency clear only with `chat:emergency-clear` | Existing Chat/Moderation APIs; hardened session/token gate | No messages waits quietly. Provider/WS failures are per-source and reconnect without losing the local reading position. Authorization change removes actions/pages immediately. | Compact collapsible internal sidebar. At 1366, feed plus optional context; at narrower widths context is a drawer. |
| `/moderation/active` | No | Moderators with current-effect visibility; Michael | `moderation-rules:view` initially, or a future narrower view capability | Active local hides/allows/warnings/bans/mutes, source, expiry, last change, enforcement scope | Retract only when `moderation-rules:retract`; inspect user/history | Existing rules/current-state store; may need a richer active-state projection | Empty: “No active moderation.” Poll/realtime failure shows stale-in-memory timestamp but disables mutation until revalidated. | Dense rows; metadata collapses to disclosure; sidebar icons at compact widths. |
| `/moderation/rules` | No | Moderators/helpers allowed to inspect rules; Michael | `moderation-rules:view` | Applied rule, source/user, scope, count/expiry, applied time | Inspect; retract with explicit capability and confirmation | Existing rules/retract APIs; correct backend retract mapping | Empty and 10-second reconnect states are explicit. A failed retract leaves the rule visible and refreshes authoritative state. | Table becomes compact stacked rows; primary rule/scope remains visible. |
| `/moderation/approvals` | No | Helpers/moderators assigned approval work; Michael | `action-panel:view` to view; decision capability for each item; separate event-routing rights where applicable | Pending action/approval, priority, age, category/source, allowed decisions | Approve/reject/defer only when the item contract permits; open context | Existing Action Panel APIs; permission-safe event approval projection still needed | Empty: “No approvals assigned.” Conflicts refresh the item and explain it changed. Network loss disables decisions but preserves in-memory list as stale. | Dense list; filters collapse; detail becomes drawer/sheet. |
| `/moderation/users/:contextId` | No | Moderators explicitly allowed to inspect selected-user context; Michael | `chat:view` plus a new/narrow approved user-context capability or wildcard | Redacted provider identity, linked-account indicator, active effects, recent allowed audit, trust/rank summary | Copy safe identifiers; open allowed history; apply only capabilities already granted elsewhere | New moderator-safe opaque context projection; do not reuse private Admin account payloads | Missing/deleted/unlinked users have explicit minimal states. Partial provider identity is labelled unknown. | Right panel at wide width; full-height drawer at narrow width; direct route remains permission-gated. |
| `/moderation/audit` | No | Moderators/helpers granted audit; Michael | `moderation-rules:view` initially; consider a narrower audit capability only if policy needs it | Durable action/outcome, actor, target, local/provider scope, reason, time | Filter/search; open user/rule context; no mutation | Existing audit API; richer paging/filter projection may be needed | Empty history is valid. Poll failure retains in-memory rows with stale label and retry. | Dense timeline/table; secondary notes collapse. |

The sidebar label for `/moderation/users/:contextId` is **User Context** and opens a neutral search/empty state when no user is selected. There is no Live Helper destination.

### Control

| Route | Default landing | Intended roles | Required permission/capability | Critical live data | Available actions | Backend/API dependency | Empty/error/reconnecting behavior | Compact/collapsed behavior |
|---|---|---|---|---|---|---|---|---|
| `/control` | Yes | Michael | Valid `control:open`, active linked owner/wildcard session; every mutation rechecks authority | Overlay connections, live presentation, Emergency-clear state, provider summary, action/notification counts where authorized, stream-relevant status | Emergency clear/Restore; genuinely live visibility controls; open focused internal page | Existing overlay status/mutations; narrow aggregate projections; owner hardening | Until authoritative state loads, mutating controls are disabled. Per-system failure is isolated. Reconnecting shows last in-memory timestamp, never cached private state. | Collapsible sidebar; compact two-column at 1366, one main column around 960; essential header/status/Emergency clear remain stable. |
| `/control/overlays` | No | Michael | Owner/wildcard plus explicit overlay edit/apply/rollback authorization | Live version, selected draft/revision, validation, private preview connection, snapshot/rollback readiness | Duplicate, edit draft, private preview, Apply live, rollback; presentation selection only through safe live contract | Existing geometry/list work plus new draft/preview/apply/snapshot/rollback backend | Draft save failure never changes live. Ambiguous apply enters verifying. Preview loss does not affect live. Rollback status remains independently reachable. | Wide editor can use canvas/list/properties; 1366 keeps canvas primary; ~960 uses property drawers; mobile is recovery-first and may disable precision editing. |
| `/control/actions` | No | Michael | `action-panel:view`; each decision requires wildcard/decision/category capability | Open/deferred live-safe actions, priority/due time, recent decision history | Approve/reject/defer exactly as current domain contract permits | Existing Action Panel APIs/components adapted to Control shell | Empty is healthy. `409` refreshes changed item. Session/network loss disables decisions; no cached private body. | Dense list/master-detail; detail becomes drawer; primary decision remains reachable. |
| `/control/music` | No | Michael | Owner/wildcard; `music:play-control` for commands/history; `music:manage` is not required for routine live control | Authoritative player state, current track/safety/attribution, queue/request state, next track, provider/player health | When backend exists: play/pause/resume/skip/stop/next, queue accept/reject/reorder, volume/fade, retry; links to Admin only for catalog rights work | Preserve current catalog/request/playlist/history APIs; add player, operator queue, realtime status, and idempotent command APIs; future `/music/player` and `/music/overlay` | Before player exists, show catalog/request foundation status and a precise “live player not available” state—no fake buttons. Command ambiguity re-queries operation/player state. Unsafe tracks fail closed with reason. | Current track and safety remain fixed; queue/detail collapses first; mobile is recovery/control first. |
| `/control/providers` | No | Michael | Owner/wildcard; retry actions use their existing provider authority or a new narrow live-recovery capability | Twitch/YouTube/Discord intake state, last activity, suppression/config state, last safe error, overlay/API reachability | Retry/start where safe; acknowledge suppression; open Admin setup only when configuration/consent is required | Existing Chat status/reconnect, provider status, provider intake health/control APIs; compact operational projection needed | Each provider fails independently. Retry has bounded pending state. Auth/config errors stop automatic loops and give exact recovery destination. | Dense provider rows; disclosure for diagnostics; raw event payloads and setup forms never enter Control. |

### Notifications

| Route | Default landing | Intended roles | Required permission/capability | Critical live data | Available actions | Backend/API dependency | Empty/error/reconnecting behavior | Compact/collapsed behavior |
|---|---|---|---|---|---|---|---|---|
| `/tools/notifications` | Yes | Michael; another role only if explicitly granted | Active linked session plus `notifications:manage` or wildcard | Unread/critical counts, severity/source/time, title/body, recovery action, push state | Open recovery action, mark read, archive, refresh, subscribe/revoke push; filters in overflow | Existing notification APIs and push-only service worker; dedicated manifest required | Empty inbox is healthy. Offline/transient loss may retain current in-memory rows marked stale but never service-worker cache them. Focus/online triggers immediate retry; normal recovery occurs within one minute. Auth loss clears private display and offers sign-in. | No sidebar. Dark one-column mobile-first list. Severity/title/action remain before metadata; touch targets remain at least 44px without making every control full-width on tablet. |

### Future AI

`/ai` is reserved conceptually for a separate future PWA but is outside every active phase in this report. The existing inert route is not evidence of implemented AI operations. Do not add AI navigation, APIs, settings, or mock pages as part of this redesign.

## Shared Visual And Shell Contract

- Dark mode only. Use the production Admin overhaul's dark canvas/surface/mint language as the reference, with denser operations spacing.
- Compact typography, restrained borders, minimal card framing, and no oversized page titles or marketing-style introductory copy.
- Known status and emergency controls stay in stable semantic positions across page changes.
- Chat and Notifications never gain a sidebar. Control and Moderation sidebars collapse to icons and never become cross-PWA navigation.
- Secondary descriptions, metadata, filters, and history collapse before live status or primary actions.
- Layouts use available width and do not assume one monitor per PWA. No fixed-wide dashboard is acceptable.
- A compact scale control is reachable from each PWA's local toolbar/menu but does not dominate it.
- Do not use generated game/avatar artwork as UI assets. Runtime provider/user images may appear when available; otherwise use neutral initials/provider glyphs. The overlay editor previews the selected scene, not generated concept art.

## Interaction Contracts

### Message actions: pointer, keyboard, and touch

1. An idle pointer row shows no action buttons.
2. `:hover` or `:focus-within` reveals **Hide**, **Ban**, and **Options** only if the actor has those capabilities. Revealing controls must not move the message text or adjacent columns.
3. Every row has a keyboard-focusable action trigger with an accessible name that includes the author. Tab/focus reveals the same controls; Escape closes Options and returns focus to its trigger.
4. On touch/non-hover devices, tapping/selecting the row exposes one compact **Options** trigger. The opened sheet/menu includes Hide and confirmed Ban when granted, followed by Warn and other granted actions. There is no hover-only action.
5. **Warn** never appears as a permanent primary button.
6. Denied actions are absent. An optional “Available actions” explanation may describe missing rights without presenting disabled destructive controls as normal choices.

### Ban and provider action confirmation

- Ban opens a confirmation naming the user, provider/source, and exact scope.
- “Ban from Maiks.yt stream surfaces” and “Ban on Twitch/Discord” are distinct actions and confirmations.
- The current primary Ban remains local unless the product explicitly changes its label/scope. Provider Ban stays inside Options and only appears with `chat:provider-moderate` plus provider support/context.
- A failed/ambiguous provider action keeps the message and reports safe sent/skipped/failed state. It never claims success from the local action alone.

### Permission-derived navigation and actions

- The server returns effective page/action capability booleans for the active identity. The client does not infer access from role names.
- Direct routes enforce the same permission as navigation. Hiding a link is not authorization.
- Permission refresh occurs on foreground/reconnect and after a `401`/`403`. Revocation closes drawers/menus, removes unavailable pages/actions, and falls back to the default allowed page.
- Michael's owner wildcard may grant every operational action, but sensitive actions such as Emergency clear, Apply live, rollback, and provider moderation still use explicit UI confirmation/safety contracts.

### Emergency clear

- Chat and Control keep Emergency clear in the top-bar emergency slot. Moderation shows it only when `canEmergencyClear` is true.
- The state is read from `/overlay/status`; the label is **Emergency clear** when off and **Restore overlay** when on.
- Activation must confirm server success before changing the authoritative state indicator. Failure leaves the prior state visible with an error.
- After reconnect or uncertain response, re-read status before permitting another toggle. Emergency clear does not erase the underlying live scene and Restore returns to it.

### Newest-first live-follow

- Messages are sorted newest first and older messages extend downward.
- At the top-edge threshold, an incoming message appears at the top and the viewport remains at the newest edge.
- Scrolling below the threshold pauses follow. Incoming items are inserted without moving the currently anchored message and increment a “new messages” counter.
- Resume scrolls to the top, clears the count, and re-enables follow. Returning manually to the top does the same.
- Socket reconnect deduplicates by message id and reconciles a snapshot without jumping a paused reader.
- The current in-memory cap remains bounded; if an anchored item is evicted, show an honest history-limit notice rather than silently jumping.

### Provider tint tokens

Use provider RGB tokens and alpha layers rather than opaque provider surfaces:

```css
--chat-provider-twitch: 145 70 255;
--chat-provider-youtube: 255 48 48;
--chat-provider-discord: 88 101 242;
--chat-provider-bg-alpha: 0.12;
--chat-provider-bg-focus-alpha: 0.17;
--chat-provider-edge-alpha: 0.72;
```

Apply the tint only to the message content area and a narrow provider edge/marker. User-selected/focused state may increase alpha slightly. Text, toolbar, sidebar, drawers, and page background remain neutral. Contrast checks, not the exact initial alpha, decide the final token values.

### Device-persistent preferences

- Store versioned, validated, per-PWA local preferences in `localStorage`: UI scale, sidebar collapsed state for Control/Moderation, last selected internal page, and low-risk local filters.
- Chat may remember compact display/filter choices, but newest-first is fixed. Live-follow paused state and unread counts are session-only.
- Notifications may remember include-archived/filter choices. Push subscription remains browser/API state, not a UI preference.
- Scale uses a small supported set, initially 75%, 80%, 90%, 100%, 110%, 125%. Clamp/ignore invalid stored values and expose Reset.
- Page restore occurs only after current permissions load. Never store message bodies, moderation context, notification bodies, provider tokens, auth sessions, overlay drafts, or other private records as UI preferences.
- Existing access-token storage is not part of the preference helper and must not be copied between PWAs.

### Private-data caching

- No service worker may cache Chat, Moderation, Control, Actions, music operations, Notifications, account/session, Admin, provider, overlay-control, or moderation API responses.
- The Notifications worker remains push/click-only unless a separately reviewed static-shell cache is introduced with explicit deny rules.
- In-memory continuity during a transient reconnect is allowed. It is visibly stale and is discarded on sign-out, authorization failure, or app close/reload.
- Static icons/fonts/shell assets may be considered later, but installability does not require private offline data.

## Overlay Editing And Live-Safety Contract

### Current production behavior versus target

| Step | Production at `f1ecd02` | Required target | Gap |
|---|---|---|---|
| Duplicate | Client clones the selected scene and calls `/overlay/scenes/save`; runtime stores it immediately | Server creates a draft from an identified source live/layout version | Partial; no draft identity/revision |
| Edit | Client edits a local scene object with drag/resize/numeric/visibility/aspect controls and layout warnings | Preserve these controls, but save only a server-recognized draft | Partial |
| Preview | Schematic client canvas | Isolated private preview using the real overlay renderer/data contract, clearly labelled **NOT LIVE** | Backend/preview transport gap |
| Apply live | Save can broadcast a changed active definition immediately; presentation-state change is a separate direct live mutation | One explicit apply validates the draft, snapshots current live state, atomically applies, and returns the confirmed live version | Backend/runtime gap |
| Snapshot | None | Mandatory immutable snapshot immediately before apply | Backend/runtime/persistence gap |
| Rollback | None | One-click restore of the last confirmed pre-apply snapshot | Backend/runtime/persistence gap |

### Required state model

- **Live version**: immutable identifier for the exact scene/layout currently selected for overlay clients.
- **Draft**: mutable copy with id, source live version, owner, revision/etag, validation state, and updated time. Draft writes never broadcast to OBS/live clients.
- **Private preview**: authenticated preview connection bound to a draft revision, visibly NOT LIVE, and unable to join the live broadcast channel.
- **Snapshot**: immutable pre-apply live version sufficient to restore exact prior output.
- **Apply operation**: idempotency key/operation id, draft revision, previous live version, snapshot id, resulting live version, operator, timestamps, and result.
- **Rollback operation**: idempotent operation identifying source snapshot and resulting live version.

The storage lifetime is an open decision below. A client-only copy cannot be called a safe draft, and an in-memory-only snapshot cannot be called production-safe across restart.

### Proposed API responsibilities

Names can be refined during API review, but responsibilities stay separate:

- `POST /overlay/scene-drafts`: duplicate an identified scene/live version.
- `GET /overlay/scene-drafts/:id`: load draft, revision, validation, and source version.
- `PATCH /overlay/scene-drafts/:id`: save a revision with optimistic concurrency.
- private preview connection or `GET /overlay/scene-drafts/:id/preview`: render that revision without touching live clients.
- `POST /overlay/scene-drafts/:id/apply`: validate, snapshot, atomically apply, and return confirmed live/snapshot/operation ids.
- `GET /overlay/live-safety`: current live version, last safe snapshot, pending/unknown operation, and rollback readiness.
- `POST /overlay/live-safety/rollback`: restore the last confirmed snapshot and return the new confirmed live version.

All reads and mutations require the valid Control launch token plus Michael's active linked owner session. Apply and rollback are audited independently. A launch token alone is insufficient.

### UI and failure behavior

- The first workflow starts with **Duplicate**. Blank-scene creation is secondary and may remain Admin/deferred.
- The header shows distinct LIVE and DRAFT identities plus private-preview state.
- One sticky safety bar is the only final-action location. It contains save state, snapshot readiness, **Apply draft live**, and **Rollback to last live**. Do not duplicate Apply/Rollback at the top and bottom.
- Apply is disabled for validation blocks, stale revision, unknown live version, missing snapshot readiness, active operation, or lost authorization.
- Network failure before server acceptance leaves live unchanged.
- If the response is lost after possible acceptance, UI state is **verifying**. Re-query operation/live version before another Apply or rollback.
- Validation and snapshot failure abort before any broadcast. The server never partially mutates live state.
- After confirmation, connected overlay clients receive one coherent version; reconnecting clients receive the current confirmed version.
- Rollback remains reachable if the draft canvas/property panel fails. It reports server restore separately from individual overlay client reconnection.

## Responsive Acceptance Matrix

| Surface | 1920x1080 | Approximately 960x1080 | 1366x768 | Narrow tablet/mobile |
|---|---|---|---|---|
| Chat | One compact bar; dense mostly single-line rows; maximum feed; hover/focus controls do not move content | One compact bar; compact two-line rows; filters/sort in overflow; viable beside future AI | Single/two-line rows by measured space; no horizontal page scroll; stable Emergency clear/follow/scale | Short title, provider summary, Emergency clear, follow state, scale/overflow survive. Touch selection exposes Options. No persistent action column. |
| Moderation Chat | Remembered expanded/collapsed sidebar; feed plus optional context | Icon sidebar; selected context drawer; feed stays primary | Compact sidebar and optional context fit without horizontal overflow | Overlay/icon navigation; full-height context drawer; destructive confirmations use sheets/dialogs. |
| Moderation other pages | Dense table/list and internal sidebar | Icon sidebar; filters/details collapse | Dense rows and permission-derived primary action | Single-column list; secondary metadata disclosed; no hover-only action. |
| Control Overview | Compact status/controls with internal sidebar; no giant dashboard | Icon sidebar; one main column; essential top state/Emergency clear stable | Compact two-column where it fits | Recovery-first; secondary preview/details collapse; critical status/actions stay reachable. |
| Control Overlays | Wide canvas/list/properties plus sticky safety bar | Icon sidebar; canvas first; list/properties as drawers; sticky safety bar | Canvas primary with compact property panel/drawer; no duplicated final actions | Live status and rollback remain usable. Precision editing may be unavailable on phone with an explicit explanation. |
| Control Actions | Dense list/master-detail | Dense list with detail drawer | List and allowed decisions without horizontal overflow | Single-column cards; allowed decisions remain reachable. |
| Control Music | Current track, safety, queue, controls | Current track fixed; queue/detail collapses | Compact current-track and queue layout | Playback/recovery controls first; never show fake enabled controls. |
| Control Providers | Dense provider rows with safe details | Provider rows; details disclosed | Status, last activity, retry, suppression visible | Single-column provider rows; retry/setup recovery remains reachable. |
| Notifications | Compact inbox and push state | One/two-column only when content benefits | Dense inbox without website chrome | Primary target: one-column, severity/title/action first, metadata later, safe-area padding and 44px touch targets. |

Across every size:

- Essential live status and emergency/recovery actions keep stable semantic locations.
- Secondary explanations, history, filters, and metadata collapse first.
- No horizontal page overflow at 100% or any supported in-app scale.
- Browser zoom to 200% remains operable through the narrow-mode contract.
- Sidebars never make their page unusable and are never added to Chat or Notifications.

## Reviewable Implementation Sequence

Future AI implementation is excluded. Each phase preserves production systems and is independently reviewable.

### Phase 1: Shared dark operations foundation

Scope:

- Extract/adapt the Admin dark visual language into cross-app operations tokens without importing the Admin shell into the control-panel Vite app.
- Add compact top bar, internal sidebar, status dot, danger action, scale control, drawer/sheet, sticky safety bar, and compact empty/error/reconnecting primitives.
- Add typed per-PWA route registries and versioned safe preference helpers.
- Add no-private-cache assertions.

Disjoint worker scopes: shared tokens/preferences; control-panel shell primitives; Notifications token consumption after shared contracts stabilize.

Acceptance:

- Dark-only tokens render consistently on both control and web origins.
- Chat/Notifications consume a top bar without a sidebar; Control/Moderation consume internal sidebars only.
- Scale/sidebar/page preferences validate bad stored values and never contain private records.
- No cross-PWA window-switcher component exists and no private caching is introduced.

Narrow checks:

```bash
pnpm --filter @maiks-yt/ui typecheck
pnpm --filter @maiks-yt/control-panel typecheck
pnpm --filter @maiks-yt/web typecheck
node scripts/check-architecture.mjs
git diff --check
```

### Phase 2: Chat PWA

Scope:

- Harden Chat reads/status/reconnect/WebSocket to require Michael's linked owner session plus the Control launch token.
- Preserve the production `StreamerChatRuntime`, provider intake/status, provider tints, moderation services, and Emergency-clear endpoint.
- Implement compact toolbar, hover/focus/touch action disclosure, confirmed Ban, Warn inside Options, and paused newest-first live-follow.
- Remove Open/window switching and move routine provider recovery to Control.

Disjoint worker scopes: Chat feed/interaction UI; API/WebSocket access hardening; Emergency-clear/reconnect tests.

Acceptance:

- A launch token without Michael's active owner session cannot read Chat or open its socket.
- Idle rows show no actions; pointer, keyboard, and touch reach the same granted actions.
- Hide/Ban/Options are the only primaries; Warn is only in Options; Ban confirms exact scope.
- Paused history does not jump during new messages/reconnect.
- 1920x1080 and ~960x1080 meet the matrix.

Narrow checks:

```bash
pnpm --filter @maiks-yt/api test -- streamer-chat
pnpm --filter @maiks-yt/api typecheck
pnpm --filter @maiks-yt/control-panel typecheck
node scripts/check-architecture.mjs
git diff --check
```

### Phase 3: Moderation PWA

Scope:

- Replace panel select/cross-window links with a permission-filtered internal sidebar and explicit routes.
- Preserve existing moderation access, local/provider actions, durable current state, audit, and runtime hydration.
- Correct explicit rule-retract authorization.
- Split useful Live Helper data into responsible pages; add a moderator-safe User Context projection; do not carry simulated/test summaries into live work.

Disjoint worker scopes: shell/routing/sidebar; existing Chat/rules/audit integration; approvals projection; User Context privacy/API review.

Acceptance:

- Chat is default and direct routes enforce the same rights as the sidebar.
- No Live Helper or AI destination remains.
- Denied message/Emergency/provider actions are absent, not presented as routine controls.
- A moderator without Ban/Timeout never receives those active controls.
- 1366x768 and narrow drawer behavior meet the matrix.

Narrow checks:

```bash
pnpm --filter @maiks-yt/domain test -- moderation
pnpm --filter @maiks-yt/api test -- streamer-chat live-helper actions
pnpm --filter @maiks-yt/api typecheck
pnpm --filter @maiks-yt/control-panel typecheck
node scripts/check-architecture.mjs
git diff --check
```

### Phase 4: Control shell and focused pages

Scope:

- Build owner-only Control route/sidebar shell and Overview, Actions, Music, and Provider Health & Recovery pages.
- Move existing live overlay status/toggles into Overview and harden their API authorization; do not rewrite the overlay runtime in this phase.
- Adapt the existing Action Panel API/components while keeping `/tools/actions` working.
- Build Music from the production catalog/request/playlist/history foundation. The first page may be read-only/status-only until authoritative player/queue APIs exist; it must accurately distinguish working catalog systems from unavailable live playback.
- Add the narrow live music player/queue command contract as a separately reviewed backend slice, preserving `music:manage` versus `music:play-control` boundaries.
- Build a compact provider operational projection from existing status/recovery APIs.
- Remove/hide Simulator, fake event tools, notification/redeem tests, raw probes, setup clutter, and routine AI UI from Control.

Disjoint worker scopes: Control shell/Overview; Actions adapter; Music operational API/UI (after contract review); provider projection/UI. Music catalog/Admin/importer files remain owned by the existing music system unless a narrow adapter change is required.

Acceptance:

- `/control` lands on Overview or the last allowed Control page.
- Every read/mutation requires both valid launch state and Michael's active owner authority.
- Existing overlay controls, Action Panel decisions, music safety rules, and provider recovery keep working through adapters.
- Music never reports catalog/request infrastructure as absent and never reports preview playback as live playback.
- No dev simulator/fake sender/raw probe/routine AI/cross-PWA switcher remains.

Narrow checks:

```bash
pnpm --filter @maiks-yt/domain test -- actions music
pnpm --filter @maiks-yt/api test -- actions music provider-integrations overlay
pnpm --filter @maiks-yt/api typecheck
pnpm --filter @maiks-yt/control-panel typecheck
node scripts/check-architecture.mjs
git diff --check
```

### Phase 5: Overlay editor safety

Scope:

- Preserve geometry validation and editor interactions.
- Add server-recognized drafts, isolated real-renderer preview, mandatory pre-apply snapshot, atomic explicit apply, live-version verification, sticky safety controls, and one-click rollback.
- Require a separate schema gate before any migration for durable drafts/snapshots.

Disjoint worker scopes after state-model review: backend draft/live/snapshot contract; private preview transport; editor UI; independent high-risk runtime/reconnection review.

Acceptance:

- Draft edits never broadcast to live overlay clients.
- Apply cannot complete without validation, snapshot, and confirmed live version.
- Lost responses enter verifying; idempotency prevents double apply/rollback.
- Rollback remains reachable and restores the last confirmed snapshot.
- Restart behavior meets the approved durability contract.

Narrow checks:

```bash
pnpm --filter @maiks-yt/events test
pnpm --filter @maiks-yt/events typecheck
pnpm --filter @maiks-yt/api test -- overlay
pnpm --filter @maiks-yt/api typecheck
pnpm --filter @maiks-yt/control-panel typecheck
pnpm --filter @maiks-yt/overlay typecheck
node scripts/check-architecture.mjs
git diff --check
```

### Phase 6: Notifications PWA

Scope:

- Give `/tools/notifications` a dedicated manifest identity and compact dark mobile-first shell.
- Preserve durable list/read/archive, action URLs, polling, and Web Push.
- Add device-local filter/scale preferences plus foreground/online retry and sub-minute recovery.
- Keep the worker push/click-only unless a static-only cache plan is independently reviewed.

Disjoint worker scopes: manifest/install identity; inbox UI/preferences; session/push/recovery and cache tests.

Acceptance:

- Installing Notifications opens Notifications, not Actions.
- No website or cross-PWA navigation appears.
- Mobile prioritizes severity, title, and recovery action.
- Private response bodies are never cached.
- A valid session recovers after transient failure immediately on focus/online and otherwise within the 30-second poll window.

Narrow checks:

```bash
pnpm --filter @maiks-yt/domain test -- notification
pnpm --filter @maiks-yt/api test -- notification
pnpm --filter @maiks-yt/api typecheck
pnpm --filter @maiks-yt/web typecheck
pnpm --filter @maiks-yt/web build
node scripts/check-architecture.mjs
git diff --check
```

### Phase 7: Integration and visual QA

Scope:

- Cross-PWA authorization, permission-revocation, reconnection, preferences, installed manifests, and no-cache tests.
- Screenshots at 1920x1080, ~960x1080, 1366x768, and narrow mobile/tablet sizes.
- Real installed-window pass in addition to headless screenshots.
- Verify older broad Control installs and document one-time reinstall steps if needed.

Acceptance:

- Every responsive matrix cell passes without horizontal overflow or hidden essential actions.
- Permission changes fail closed across direct routes and already-open windows.
- Chat remains usable beside an empty half-screen neighbor; no AI implementation is introduced.
- Apply/rollback and Emergency clear are exercised only against a non-production test overlay.
- No private service-worker cache entry exists.

Checks:

```bash
pnpm check:review
pnpm test:readiness -- --visual
```

## Genuine Open Decisions And Risks

### PWA session/token resilience and sub-minute recovery

This is a separate security/reliability dependency, not permission to weaken authorization.

Current risks:

- Control-origin APIs inconsistently enforce session/role authority after initial client load.
- A Control URL token persists locally while the auth session may expire or be revoked independently.
- Chat WebSocket/provider recovery and most overlay mutations currently accept the token without a session.
- Cross-origin installed windows cannot assume another PWA can silently repair their cookie/session.

Required outcome:

- Every private read/mutation independently validates the required launch token, session, linked identity, and owner/permission status.
- Transient network/API loss uses bounded backoff and immediate retry on `online`/foreground.
- With a still-valid session/token, live data recovers in under one minute without reload under normal transient failure.
- Expired/revoked auth fails closed with a direct sign-in/relaunch path. It never falls back to token-only access or cached private data.
- Implementation review must choose between existing session refresh, a small PWA bootstrap/session-status contract, or another reviewed mechanism. Copying launch tokens between PWAs is not acceptable.

### Overlay draft/snapshot durability

The current overlay runtime is in memory. Decide the smallest durable version/snapshot model, retention count, and cleanup rules before Phase 5. A schema change requires its own schema gate and generated migration review. Until a rollback point survives the agreed failure/restart model, the workflow cannot be called production-safe.

### Private preview transport

Choose a preview-only WebSocket/channel using the real overlay renderer or another isolated renderer contract. It must prove that draft updates cannot reach live OBS clients and that preview output is equivalent enough to trust Apply.

### Live music player and operator queue contract

The catalog, rights/safety model, public requests, playlists, preview player, history persistence, Admin tooling, and importer are already implemented. The unresolved work is the live runtime boundary: where the OBS audio player runs, who owns authoritative queue/current-track state, command idempotency, reconnect/takeover behavior, volume/fade semantics, request resolution, and how attribution/now-playing are projected. Resolve this without replacing the production music domain or weakening fail-closed selection.

### Moderation User Context privacy projection

Define the minimum redacted fields and source-of-truth joins for provider identity, linked Maiks.yt account indicator, active moderation, trust/rank, and history. `chat:view` alone must not expose private profile/admin/provider data. Decide the narrow capability and retention/paging behavior with a moderation/privacy review.

### Action Panel compatibility transition

Choose the compatibility window after `/control/actions` reaches behavior parity. Existing `/tools/actions` links/installations need a deliberate redirect or deprecation screen. They must not silently disappear when Notifications receives its own manifest.

### Existing installed-scope cleanup

Older Control installations may still claim a broader pre-split scope. Final rollout needs uninstall/reinstall tests and concise one-time guidance so Chat, Moderation, Control, and Notifications remain independently installable.

## Canonical Acceptance Summary

- Standalone boundaries match operational responsibility, not page count or monitor count.
- Chat is owner-only, has no sidebar, and works at half-screen.
- Moderation and Control use compact permission-appropriate internal navigation only.
- Notifications stays separate, dark, mobile-friendly, actionable, and network-only for private data.
- AI is not implemented in these phases.
- No routine cross-PWA navigation/window switcher remains.
- Server authorization is authoritative; session resilience is improved without weakening it.
- Existing production moderation, Action Panel, provider, overlay geometry, Notifications, and music systems are preserved and adapted.
- Music is correctly treated as a working catalog/request/Admin/history foundation with missing live player/queue operations, not as an absent backend.
- Overlay editing cannot change live output until explicit Apply live, and rollback is a real server/runtime capability rather than a visual promise.
- Development/testing/setup surfaces leave live Control without discarding useful test/runtime work.
