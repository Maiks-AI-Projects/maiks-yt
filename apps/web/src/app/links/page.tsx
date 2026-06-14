import type { IconType } from "react-icons";
import { FaCompass, FaRss, FaUser } from "react-icons/fa6";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

type CreatorLinkPurpose =
  | "stream"
  | "community"
  | "project"
  | "account"
  | "feed"
  | "tool";

type CreatorLink = {
  title: string;
  description: string;
  href: string;
  purpose: CreatorLinkPurpose;
  Icon: IconType;
  isPrimary?: boolean;
};

const creatorLinks: readonly CreatorLink[] = [
  {
    title: "Current Stream Home",
    description: "Main public entry point for streams, projects, updates, and account access.",
    href: "/",
    purpose: "stream",
    Icon: SiYoutube,
    isPrimary: true
  },
  {
    title: "Twitch Link Slot",
    description: "Reserved for the Twitch channel that matches the active game or hobby.",
    href: "/links#twitch",
    purpose: "stream",
    Icon: SiTwitch
  },
  {
    title: "Community Link Slot",
    description: "Reserved for Discord and community invite links once the public policy pages are ready.",
    href: "/links#community",
    purpose: "community",
    Icon: SiDiscord
  },
  {
    title: "Account",
    description: "Sign in, link providers, choose privacy, and manage identities used on stream.",
    href: "/account",
    purpose: "account",
    Icon: FaUser
  },
  {
    title: "Layout Lab",
    description: "Preview landing-page directions while the creator site design settles.",
    href: "/gemini-lab",
    purpose: "tool",
    Icon: FaCompass
  },
  {
    title: "RSS Updates",
    description: "Public project and blog updates in an open feed.",
    href: "/feed.xml",
    purpose: "feed",
    Icon: FaRss
  }
];

const purposeLabels = {
  account: "Account",
  community: "Community",
  feed: "Feed",
  project: "Project",
  stream: "Stream",
  tool: "Tool"
} satisfies Record<CreatorLinkPurpose, string>;

const LinksPage = (): React.ReactNode => (
  <main className="links-page">
    <header className="links-header">
      <p className="eyebrow">Creator Hub</p>
      <h1>Maiks.yt Links</h1>
      <p>One owned place for stream links, community access, project updates, and account tools.</p>
    </header>
    <section className="link-list" aria-label="Creator links">
      {creatorLinks.map((link) => {
        const LinkIcon = link.Icon;

        return (
          <a className={`creator-link ${link.isPrimary ? "primary" : ""}`} href={link.href} key={link.title}>
            <span className={`creator-link-icon ${link.purpose}`}>
              <LinkIcon aria-hidden="true" />
            </span>
            <span className="creator-link-copy">
              <span className="creator-link-kicker">{purposeLabels[link.purpose]}</span>
              <strong>{link.title}</strong>
              <span>{link.description}</span>
            </span>
          </a>
        );
      })}
    </section>
  </main>
);

export default LinksPage;
