import type { IconType } from "react-icons";
import {
  FaClockRotateLeft,
  FaCompass,
  FaHeart,
  FaMoneyBillTransfer,
  FaRss,
  FaUser,
  FaUserGroup
} from "react-icons/fa6";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import {
  creatorLinkPurposeLabels,
  publicCreatorLinks,
  type CreatorLinkIcon
} from "../../content/public-creator-links-data";

const creatorLinkIcons = {
  account: FaUser,
  accountability: FaClockRotateLeft,
  affiliate: FaMoneyBillTransfer,
  community: SiDiscord,
  context: FaUserGroup,
  feed: FaRss,
  social: SiTwitch,
  stream: SiYoutube,
  support: FaHeart,
  tool: FaCompass
} satisfies Record<CreatorLinkIcon, IconType>;

const LinksPage = (): React.ReactNode => (
  <main className="links-page">
    <header className="links-header">
      <p className="eyebrow">Creator Hub</p>
      <h1>Maiks.yt Links</h1>
      <p>One owned place for stream links, community access, project updates, and account tools.</p>
    </header>
    <section className="link-list" aria-label="Creator links">
      {publicCreatorLinks.map((link) => {
        const LinkIcon = creatorLinkIcons[link.icon];
        const content = (
          <>
            <span className={`creator-link-icon ${link.purpose}`}>
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
          <a className={`creator-link ${link.isPrimary ? "primary" : ""}`} href={link.href} key={link.title}>
            {content}
          </a>
        ) : (
          <article className="creator-link unavailable" key={link.title}>
            {content}
          </article>
        );
      })}
    </section>
  </main>
);

export default LinksPage;
