import type {
  CreatorLinkPurpose,
  PublicCreatorLink
} from "@maiks-yt/domain";

export const creatorLinkPurposeLabels = {
  account: "Account",
  accountability: "History",
  affiliate: "Disclosure",
  community: "Community",
  context: "Context",
  feed: "Feed",
  project: "Project",
  social: "Social",
  stream: "Stream",
  support: "Funding",
  tool: "Tool"
} satisfies Record<CreatorLinkPurpose, string>;

export const publicCreatorLinks: readonly PublicCreatorLink[] = [
  {
    key: "current-stream-home",
    title: "Current Stream Home",
    description: "Main public entry point for streams, projects, updates, and account access.",
    purpose: "stream",
    icon: "stream",
    availability: "available",
    href: "/",
    isPrimary: true,
    sortOrder: 10
  },
  {
    key: "projects",
    title: "Projects",
    description: "Public read-only project plans, milestones, and non-monetary work items.",
    purpose: "project",
    icon: "project",
    availability: "available",
    href: "/projects",
    isPrimary: false,
    sortOrder: 20
  },
  {
    key: "twitch",
    title: "MaiksMC on Twitch",
    description: "Minecraft streams and chat on the MaiksMC Twitch channel.",
    purpose: "social",
    icon: "twitch",
    availability: "available",
    href: "https://www.twitch.tv/maiksmc",
    isPrimary: false,
    sortOrder: 30
  },
  {
    key: "maiksplays-twitch",
    title: "MaiksPlays on Twitch",
    description: "Gaming streams beyond Minecraft on the MaiksPlays Twitch channel.",
    purpose: "social",
    icon: "twitch",
    availability: "available",
    href: "https://www.twitch.tv/maiksplays",
    isPrimary: false,
    sortOrder: 35
  },
  {
    key: "maiksmc-youtube",
    title: "MaiksMC YouTube",
    description: "The main YouTube channel for MaiksMC uploads and stream-adjacent videos.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maiksMC",
    isPrimary: false,
    sortOrder: 40
  },
  {
    key: "maiksplays-youtube",
    title: "MaiksPlays on YouTube",
    description: "Gaming videos and upcoming live streams on the MaiksPlays YouTube channel.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@MaiksPlays",
    isPrimary: false,
    sortOrder: 45
  },
  {
    key: "wow-with-maiks",
    title: "WoW with Maiks",
    description: "World of Warcraft videos and related channel experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@wowwithmaiks2218",
    isPrimary: false,
    sortOrder: 50
  },
  {
    key: "maiks-talking",
    title: "Maiks Talking",
    description: "Talking, updates, and creator-side video experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maikstalking9763",
    isPrimary: false,
    sortOrder: 60
  },
  {
    key: "coding-with-maiks",
    title: "Coding with Maiks",
    description: "Coding videos and build-log style experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@codingwithmaiks1339/featured",
    isPrimary: false,
    sortOrder: 70
  },
  {
    key: "discord-community",
    title: "Discord Community",
    description: "Join the community Discord while the full community pages are still being prepared.",
    purpose: "community",
    icon: "discord",
    availability: "available",
    href: "https://discord.gg/ZjaBEppKY8",
    isPrimary: false,
    sortOrder: 80
  },
  {
    key: "support",
    title: "Funding",
    description: "Maiks.yt is planned to launch with its own donation system, so contributions can support the creator and projects directly without relying on Twitch Partner or YouTube monetization. Familiar third-party platforms may be added later for people who prefer services they already know, even when those platforms keep a larger share.",
    purpose: "support",
    icon: "support",
    availability: "unavailable",
    availabilityNote: "Funding launches later",
    isPrimary: false,
    sortOrder: 90
  },
  {
    key: "personal-context",
    title: "Personal Context",
    description: "Creator-provided context about personal circumstances that can affect streams.",
    purpose: "context",
    icon: "context",
    availability: "available",
    href: "/context",
    isPrimary: false,
    sortOrder: 100
  },
  {
    key: "accountability-and-history",
    title: "Accountability and History",
    description: "The public structure for project history, corrections, and archived outcomes.",
    purpose: "accountability",
    icon: "accountability",
    availability: "available",
    href: "/accountability",
    isPrimary: false,
    sortOrder: 110
  },
  {
    key: "affiliate-disclosure",
    title: "Affiliate Disclosure",
    description: "How income links will be identified separately from personal recommendations.",
    purpose: "affiliate",
    icon: "affiliate",
    availability: "available",
    href: "/affiliates",
    isPrimary: false,
    sortOrder: 120
  },
  {
    key: "account",
    title: "Account",
    description: "Sign in, link providers, choose privacy, and manage identities used on stream.",
    purpose: "account",
    icon: "account",
    availability: "available",
    href: "/account",
    isPrimary: false,
    sortOrder: 130
  },
  {
    key: "rss-updates",
    title: "RSS Updates",
    description: "Public project and blog updates in an open feed.",
    purpose: "feed",
    icon: "feed",
    availability: "available",
    href: "/feed.xml",
    isPrimary: false,
    sortOrder: 150
  }
];
