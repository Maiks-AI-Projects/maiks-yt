import {
  channelsPagePlan,
  interactionsPagePlan,
  languagesPagePlan,
  musicPagePlan,
  profilesPagePlan,
  sponsorsPagePlan,
  supportPagePlan
} from "../planned-pages/planned-public-page-data";
import type { RoadmapStatus } from "./roadmap-status-data";

export type RoadmapItem = {
  title: string;
  description: string;
  status: RoadmapStatus;
  href?: string;
  id?: string;
};

export const publicRoadmap: readonly RoadmapItem[] = [
  {
    title: "Homepage",
    description: "The first production design is live as the new front door, with writing and imagery still open to revision.",
    status: "building",
    href: "/"
  },
  {
    title: "About Michael",
    description: "Three pages: who Michael is now, an open medical history, and a full vertical life timeline including the difficult parts.",
    status: "partial",
    href: "/about"
  },
  {
    title: "Stream schedule",
    description: "Upcoming streams, changes and cancellations, local times, games, projects, and the reason behind schedule changes.",
    status: "partial",
    href: "/schedule"
  },
  {
    title: "Projects and public updates",
    description: "Project categories, milestones, items, blockers, updates, archives, and clear separation between plans and completed work.",
    status: "partial",
    href: "/projects"
  },
  {
    title: "Creator hub and open feeds",
    description: "Official links, current destinations, community entry points, and open RSS feeds for people who do not want another account or algorithm.",
    status: "partial",
    href: "/links"
  },
  {
    title: "Game library and play plans",
    description: "The live public library, reviewed visitor suggestions, and schedule-linked play plans are usable now. Published game records, richer gifted-game history, and provider/store links are still being filled in.",
    status: "usable",
    href: "/games"
  },
  {
    title: "Community participation",
    description: "The public participation guide and shared rules are usable now. Optional accounts, visible warning and appeal records, ranks, and consistent provider enforcement remain in progress.",
    status: "partial",
    href: "/community-rules",
    id: "community-participation"
  },
  profilesPagePlan,
  {
    title: "Posts, recaps, and announcements",
    description: "A backend-backed public archive and RSS feed now support posts, recaps, and announcements. The first records are labelled examples; manual publishing and selected social syndication remain in progress.",
    status: "partial",
    href: "/updates"
  },
  channelsPagePlan,
  musicPagePlan,
  interactionsPagePlan,
  supportPagePlan,
  {
    title: "Affiliates, products, and wishlists",
    description: "Clearly disclosed affiliate links, recommendation status, product price history, project-item links, and selected wishlist integrations.",
    status: "later",
    href: "/affiliates"
  },
  sponsorsPagePlan,
  {
    title: "Privacy, legal, and account controls",
    description: "Plain-language analytics boundaries, retention rules, account deletion, required policies, disclosures, and exportable personal data controls.",
    status: "partial",
    href: "/privacy/analytics"
  },
  languagesPagePlan
] as const;

export const platformRoadmap: readonly RoadmapItem[] = [
  {
    title: "Content and Page Creator system",
    description: "Manual page ownership, drafts, previews, publishing, updates, and safe route management.",
    status: "partial"
  },
  {
    title: "Projects system",
    description: "Projects, milestones, items, updates, categories, stream focus, archives, and later funding relationships.",
    status: "partial"
  },
  {
    title: "Financial system",
    description: "Private accounting, dated fee and split rules, receipts, corrections, warnings, imports, exports, and later transparent public support flows.",
    status: "partial"
  },
  {
    title: "Overlay and scene system",
    description: "OBS overlays, scenes, top and center notifications, themes, fallbacks, chat display, and creator-controlled routing.",
    status: "partial"
  },
  {
    title: "Schedule and game system",
    description: "Stream planning, cancellations, project or game focus, provider publishing, and a connected game library.",
    status: "partial"
  },
  {
    title: "Accounts, identity, and community system",
    description: "OAuth-heavy identity, account linking, profiles, privacy choices, ranks, permissions, recognition, and no-signup public access.",
    status: "partial"
  },
  {
    title: "Chat and moderation system",
    description: "Unified chat, quick actions, warnings, active rules, moderator roles, appeals, audit history, and provider-side enforcement.",
    status: "partial"
  },
  {
    title: "Provider integration system",
    description: "Always-on Twitch, YouTube, and Discord intake, event normalization, multi-channel routing, and carefully permissioned write actions.",
    status: "partial"
  },
  {
    title: "Events and notification system",
    description: "Internal event history, routing rules, approvals, cooldowns, OBS notifications, and important private alerts on installed devices.",
    status: "partial"
  },
  {
    title: "Creator control tools",
    description: "Separate installable control, moderation, chat, and notification surfaces designed for multiple screens and low-friction live use.",
    status: "partial"
  },
  {
    title: "AI stream assistant",
    description: "Private-first assistance, drafting, transcript context, moderation suggestions, and explicit human approval before public output.",
    status: "planned"
  },
  {
    title: "Backup, export, and recovery system",
    description: "Key-data exports, health checks, recovery procedures, session management, and production-safe backup and restore workflows.",
    status: "partial"
  }
] as const;
