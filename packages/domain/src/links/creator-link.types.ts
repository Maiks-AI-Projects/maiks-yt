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

export type CreatorLinkAvailability = "available" | "unavailable";

export type CreatorLinkBase = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  isPrimary: boolean;
  sortOrder: number;
};

export type AvailableCreatorLink = CreatorLinkBase & {
  availability: "available";
  href: string;
};

export type UnavailableCreatorLink = CreatorLinkBase & {
  availability: "unavailable";
  availabilityNote: string;
};

export type PublicCreatorLink = AvailableCreatorLink | UnavailableCreatorLink;

export type CreatorLinkSource = CreatorLinkBase & {
  availability: CreatorLinkAvailability;
  href?: string | null;
  availabilityNote?: string | null;
  isPublished: boolean;
};
