import type {
  CreatorLinkIcon,
  PublicCreatorLink
} from "@maiks-yt/domain";
import type { IconType } from "react-icons";
import {
  FaClockRotateLeft,
  FaCompass,
  FaHeart,
  FaListCheck,
  FaMoneyBillTransfer,
  FaRss,
  FaUser,
  FaUserGroup
} from "react-icons/fa6";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import {
  creatorLinkPurposeLabels,
  publicCreatorLinks
} from "../../content/public-creator-links-data";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type CreatorLinkListApiResponse =
  | {
    ok: true;
    links: readonly PublicCreatorLink[];
  }
  | {
    ok: false;
    reason: string;
  };

type CreatorLinksLoadResult = {
  status: "loaded" | "fallback";
  links: readonly PublicCreatorLink[];
};

const creatorLinkIcons = {
  account: FaUser,
  accountability: FaClockRotateLeft,
  affiliate: FaMoneyBillTransfer,
  community: SiDiscord,
  context: FaUserGroup,
  discord: SiDiscord,
  feed: FaRss,
  project: FaListCheck,
  social: SiTwitch,
  stream: SiYoutube,
  support: FaHeart,
  twitch: SiTwitch,
  tool: FaCompass,
  youtube: SiYoutube
} satisfies Record<CreatorLinkIcon, IconType>;

export const dynamic = "force-dynamic";

const getCreatorLinks = async (): Promise<CreatorLinksLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/links`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "fallback",
        links: publicCreatorLinks
      };
    }

    const payload = await response.json() as CreatorLinkListApiResponse;

    if (!payload.ok) {
      return {
        status: "fallback",
        links: publicCreatorLinks
      };
    }

    return {
      status: "loaded",
      links: payload.links
    };
  } catch {
    return {
      status: "fallback",
      links: publicCreatorLinks
    };
  }
};

const CreatorLinkCard = ({ link }: { link: PublicCreatorLink }): React.ReactNode => {
  const LinkIcon = creatorLinkIcons[link.icon];
  const content = (
    <>
      <span className={`creator-link-icon ${link.purpose} ${link.icon}`}>
        <LinkIcon aria-hidden="true" />
      </span>
      <span className="creator-link-copy">
        <span className="creator-link-kicker">{creatorLinkPurposeLabels[link.purpose]}</span>
        <strong>{link.title}</strong>
        <span>{link.description}</span>
        {link.availability === "unavailable" ? (
          <span className="creator-link-status">{link.availabilityNote}</span>
        ) : null}
      </span>
    </>
  );

  return link.availability === "available" ? (
    <a className={`creator-link ${link.isPrimary ? "primary" : ""}`} href={link.href} key={link.key}>
      {content}
    </a>
  ) : (
    <article className="creator-link unavailable" key={link.key}>
      {content}
    </article>
  );
};

const LinksPage = async (): Promise<React.ReactNode> => {
  const result = await getCreatorLinks();

  return (
    <main className="links-page">
      <header className="links-header">
        <p className="eyebrow">Creator Hub</p>
        <h1>Maiks.yt Links</h1>
        <p>One owned place for stream links, community access, project updates, and account tools.</p>
      </header>
      {result.status === "fallback" ? (
        <section className="links-load-state" aria-live="polite">
          <h2>Live link data is temporarily unavailable</h2>
          <p>The last reviewed public links are shown instead.</p>
        </section>
      ) : null}
      <section className="link-list" aria-label="Creator links">
        {result.links.map((link) => (
          <CreatorLinkCard link={link} key={link.key} />
        ))}
      </section>
    </main>
  );
};

export default LinksPage;
