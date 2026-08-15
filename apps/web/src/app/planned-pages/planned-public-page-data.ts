import type { RoadmapStatus } from "../progress/roadmap-status-data";

export type PlannedPublicPageDefinition = {
  currentState: string;
  description: string;
  eyebrow: string;
  href: string;
  id: string;
  plannedFeatures: readonly string[];
  status: RoadmapStatus;
  title: string;
};

export const profilesPagePlan: PlannedPublicPageDefinition = {
  currentState: "A static Michael profile design mock is available now. Account, identity-linking, and stream-visibility foundations exist, but the public profile is not connected to live user or provider data yet.",
  description: "Privacy-controlled profiles, linked Twitch, YouTube, Discord and gaming identities, verified game names, perks, and optional supporter recognition.",
  eyebrow: "Identity and community",
  href: "/profiles",
  id: "profiles-and-recognition",
  plannedFeatures: [
    "Optional public profiles with clear privacy controls",
    "Linked provider and gaming identities",
    "Public username and profile-image choices",
    "Opt-in recognition and community participation"
  ],
  status: "building",
  title: "Profiles, linked accounts, and recognition"
};

export const channelsPagePlan: PlannedPublicPageDefinition = {
  currentState: "The shared Maiks.yt website shell exists. Individual channel and hobby destinations have not been designed yet.",
  description: "Distinct entry pages for Minecraft, other games, technology, AI, outdoors, and future channels while keeping one shared platform.",
  eyebrow: "Channels and interests",
  href: "/channels",
  id: "channel-and-hobby-pages",
  plannedFeatures: [
    "Focused pages for different channels and interests",
    "Shared identity and navigation across every page",
    "Relevant streams, projects, updates, and schedules",
    "Manual editing without programming each page"
  ],
  status: "later",
  title: "Channel and hobby landing pages"
};

export const musicPagePlan: PlannedPublicPageDefinition = {
  currentState: "No public music participation or live playback system is active.",
  description: "Viewer suggestions and voting from an approved catalog, with Michael retaining full playback, safety, and OBS control.",
  eyebrow: "Stream-safe music",
  href: "/music",
  id: "stream-safe-music",
  plannedFeatures: [
    "An approved catalog before anything can play",
    "Viewer suggestions routed through review",
    "Now-playing information and required attribution",
    "Separate OBS audio and overlay surfaces"
  ],
  status: "later",
  title: "Stream-safe music participation"
};

export const interactionsPagePlan: PlannedPublicPageDefinition = {
  currentState: "Provider chat intake, event routing, test interactions, and private moderation foundations exist. The visitor-facing interaction experience is not ready.",
  description: "Unified public chat presentation, stream bot commands, approved website actions, profile recognition, optional notifications, and a later free website TTS interaction with visibility controls.",
  eyebrow: "Website and stream",
  href: "/interactions",
  id: "live-chat-and-interactions",
  plannedFeatures: [
    "Provider-neutral chat and event presentation",
    "Website actions with approval and cooldown controls",
    "User opt-outs for stream-visible profile activity",
    "A later limited free website TTS interaction"
  ],
  status: "planned",
  title: "Live chat and website-to-stream interactions"
};

export const supportPagePlan: PlannedPublicPageDefinition = {
  currentState: "Public support destinations and real payment behavior remain disabled. Private accounting foundations are being developed separately.",
  description: "Donation goals, project allocation, fees, changes, refunds or redirection, public spending context, and support history without dark patterns.",
  eyebrow: "Money and transparency",
  href: "/support",
  id: "transparent-support-and-goals",
  plannedFeatures: [
    "Clearly described goals and intended allocation",
    "Visible fees, splits, corrections, and changes",
    "Public progress without exposing private records",
    "Documented refund or redirection rules"
  ],
  status: "planned",
  title: "Transparent support and goals"
};

export const sponsorsPagePlan: PlannedPublicPageDefinition = {
  currentState: "No sponsor campaigns or advertising placements are published.",
  description: "Clearly labelled sponsor spots, campaign context, basic delivery reporting, and a visible distinction between advertising, affiliates, recommendations, and products Michael actually uses.",
  eyebrow: "Commercial transparency",
  href: "/sponsors",
  id: "sponsors-and-advertising",
  plannedFeatures: [
    "Visible sponsor and advertising labels",
    "Campaign context and basic delivery records",
    "Separation from affiliates and personal recommendations",
    "Public corrections when a relationship changes"
  ],
  status: "later",
  title: "Sponsors and advertising transparency"
};

export const languagesPagePlan: PlannedPublicPageDefinition = {
  currentState: "English is the current public language. The codebase has an English-default, Dutch-ready localization foundation.",
  description: "English remains the default while the structure stays ready for Dutch UI and translated public content.",
  eyebrow: "Language support",
  href: "/languages",
  id: "english-and-dutch",
  plannedFeatures: [
    "English as the default language",
    "Dutch interface and public-page translations",
    "Clear handling when a translation is unavailable",
    "Shared terminology across the website and stream tools"
  ],
  status: "partial",
  title: "English and Dutch"
};
