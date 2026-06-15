export type CreatorLinkPurpose =
  | "account"
  | "accountability"
  | "affiliate"
  | "community"
  | "context"
  | "feed"
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
  | "feed"
  | "social"
  | "stream"
  | "support"
  | "tool";

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
    title: "Twitch",
    description: "The public Twitch channel will be added here after Michael confirms the destination.",
    purpose: "social",
    icon: "social",
    availability: "unavailable",
    availabilityNote: "Link not published yet"
  },
  {
    title: "Community",
    description: "Community access will be linked here when the public invite and policy pages are ready.",
    purpose: "community",
    icon: "community",
    availability: "unavailable",
    availabilityNote: "Invite not published yet"
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
