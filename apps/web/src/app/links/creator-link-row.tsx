import type { CreatorLinkIcon, PublicCreatorLink } from "@maiks-yt/domain";
import type { IconType } from "react-icons";
import { FiArrowRight, FiArrowUpRight } from "react-icons/fi";
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

import { creatorLinkPurposeLabels } from "../../content/public-creator-links-data";
import styles from "./links.module.css";

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

const isExternalHref = (href: string): boolean => /^https?:\/\//.test(href);

export const CreatorLinkRow = ({
  link
}: {
  link: PublicCreatorLink;
}): React.ReactNode => {
  const LinkIcon = creatorLinkIcons[link.icon];
  const content = (
    <>
      <span className={styles.linkIcon} data-icon={link.icon}>
        <LinkIcon aria-hidden="true" />
      </span>
      <span className={styles.linkIdentity}>
        <span>{creatorLinkPurposeLabels[link.purpose]}</span>
        <strong>{link.title}</strong>
      </span>
      <span className={styles.linkDescription}>{link.description}</span>
      <span className={styles.linkAction}>
        {link.availability === "available" ? (
          isExternalHref(link.href) ? (
            <>
              <span>Open</span>
              <FiArrowUpRight aria-hidden="true" />
            </>
          ) : (
            <>
              <span>Visit</span>
              <FiArrowRight aria-hidden="true" />
            </>
          )
        ) : (
          link.availabilityNote
        )}
      </span>
    </>
  );

  if (link.availability === "unavailable") {
    return (
      <article className={styles.linkRow} data-unavailable="true">
        {content}
      </article>
    );
  }

  const external = isExternalHref(link.href);

  return (
    <a
      className={styles.linkRow}
      data-primary={link.isPrimary ? "true" : undefined}
      href={link.href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {content}
    </a>
  );
};
