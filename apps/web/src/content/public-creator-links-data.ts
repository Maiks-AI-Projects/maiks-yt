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
  support: "Support",
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
    title: "Twitch",
    description: "Live streams, chat, and stream alerts on the main MaiksMC Twitch channel.",
    purpose: "social",
    icon: "twitch",
    availability: "available",
    href: "https://www.twitch.tv/maiksmc",
    isPrimary: false,
    sortOrder: 30
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
    title: "Support",
    description: "A support destination can be added after its terms and public wording are approved.",
    purpose: "support",
    icon: "support",
    availability: "unavailable",
    availabilityNote: "Support link not available",
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
    key: "layout-lab",
    title: "Layout Lab",
    description: "Preview landing-page directions while the creator site design settles.",
    purpose: "tool",
    icon: "tool",
    availability: "available",
    href: "/gemini-lab",
    isPrimary: false,
    sortOrder: 140
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
