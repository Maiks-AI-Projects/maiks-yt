export type CreatorLinkPurpose =
  | "account"
  | "accountability"
  | "affiliate"
  | "community"
  | "context"
  | "feed"
  | "project"
  | "social"
  | "stream"
  | "support"
  | "tool";

export type CreatorLinkIcon =
  | "account"
  | "accountability"
  | "affiliate"
  | "community"
  | "context"
  | "discord"
  | "feed"
  | "project"
  | "social"
  | "stream"
  | "support"
  | "twitch"
  | "tool"
  | "youtube";

type CreatorLinkBase = {
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  isPrimary?: boolean;
};

export type AvailableCreatorLink = CreatorLinkBase & {
  availability: "available";
  href: string;
};

export type UnavailableCreatorLink = CreatorLinkBase & {
  availability: "unavailable";
  availabilityNote: string;
};

export type CreatorLink = AvailableCreatorLink | UnavailableCreatorLink;

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

export const publicCreatorLinks: readonly CreatorLink[] = [
  {
    title: "Current Stream Home",
    description: "Main public entry point for streams, projects, updates, and account access.",
    purpose: "stream",
    icon: "stream",
    availability: "available",
    href: "/",
    isPrimary: true
  },
  {
    title: "Projects",
    description: "Public read-only project plans, milestones, and non-monetary work items.",
    purpose: "project",
    icon: "project",
    availability: "available",
    href: "/projects"
  },
  {
    title: "Twitch",
    description: "Live streams, chat, and stream alerts on the main MaiksMC Twitch channel.",
    purpose: "social",
    icon: "twitch",
    availability: "available",
    href: "https://www.twitch.tv/maiksmc"
  },
  {
    title: "MaiksMC YouTube",
    description: "The main YouTube channel for MaiksMC uploads and stream-adjacent videos.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maiksMC"
  },
  {
    title: "WoW with Maiks",
    description: "World of Warcraft videos and related channel experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@wowwithmaiks2218"
  },
  {
    title: "Maiks Talking",
    description: "Talking, updates, and creator-side video experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maikstalking9763"
  },
  {
    title: "Coding with Maiks",
    description: "Coding videos and build-log style experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@codingwithmaiks1339/featured"
  },
  {
    title: "Discord Community",
    description: "Join the community Discord while the full community pages are still being prepared.",
    purpose: "community",
    icon: "discord",
    availability: "available",
    href: "https://discord.gg/ZjaBEppKY8"
  },
  {
    title: "Support",
    description: "A support destination can be added after its terms and public wording are approved.",
    purpose: "support",
    icon: "support",
    availability: "unavailable",
    availabilityNote: "Support link not available"
  },
  {
    title: "Personal Context",
    description: "Creator-provided context about personal circumstances that can affect streams.",
    purpose: "context",
    icon: "context",
    availability: "available",
    href: "/context"
  },
  {
    title: "Accountability and History",
    description: "The public structure for project history, corrections, and archived outcomes.",
    purpose: "accountability",
    icon: "accountability",
    availability: "available",
    href: "/accountability"
  },
  {
    title: "Affiliate Disclosure",
    description: "How income links will be identified separately from personal recommendations.",
    purpose: "affiliate",
    icon: "affiliate",
    availability: "available",
    href: "/affiliates"
  },
  {
    title: "Account",
    description: "Sign in, link providers, choose privacy, and manage identities used on stream.",
    purpose: "account",
    icon: "account",
    availability: "available",
    href: "/account"
  },
  {
    title: "Layout Lab",
    description: "Preview landing-page directions while the creator site design settles.",
    purpose: "tool",
    icon: "tool",
    availability: "available",
    href: "/gemini-lab"
  },
  {
    title: "RSS Updates",
    description: "Public project and blog updates in an open feed.",
    purpose: "feed",
    icon: "feed",
    availability: "available",
    href: "/feed.xml"
  }
];
