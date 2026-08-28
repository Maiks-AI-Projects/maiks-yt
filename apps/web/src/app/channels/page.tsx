import type { AvailableCreatorLink, PublicCreatorLink } from "@maiks-yt/domain";
import type { Metadata } from "next";

import { getCreatorLinks } from "../links/creator-links-data";
import styles from "./channels.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Channels and interests",
  description:
    "Michael's current Twitch and YouTube destinations plus the interests that may shape future Maiks.yt channels."
};

const interestGroups = [
  {
    label: "Games",
    title: "Worlds worth returning to",
    interests: ["Minecraft", "Satisfactory", "World of Warcraft", "Future games"],
    description:
      "Long-running games, community builds, factory projects, and new releases can share the platform without becoming one indistinguishable feed."
  },
  {
    label: "Build and learn",
    title: "Making things in public",
    interests: ["Programming", "AI", "Micro electronics", "3D printing"],
    description:
      "Code, experiments, small electronics, and workshop projects belong together as practical build logs and streams."
  },
  {
    label: "Life and conversation",
    title: "The work around the stream",
    interests: ["Talking", "Outdoors", "Tech", "Odd jobs"],
    description:
      "Updates, Q&A, personal context, reviews, trips, and one-off work need a calmer home than a game-specific channel."
  }
] as const;

const getPlatformLabel = (link: PublicCreatorLink): string => {
  if (link.icon === "twitch") {
    return "Twitch";
  }

  if (link.icon === "youtube") {
    return "YouTube";
  }

  return "Channel";
};

const isPublishedChannel = (link: PublicCreatorLink): link is AvailableCreatorLink =>
  link.availability === "available"
  && link.href.startsWith("http")
  && (link.icon === "twitch" || link.icon === "youtube");

const ChannelsPage = async (): Promise<React.ReactNode> => {
  const linkResult = await getCreatorLinks();
  const publishedChannels = linkResult.status === "loaded"
    ? linkResult.links.filter(isPublishedChannel)
    : [];

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Channels and interests</p>
        <h1>Different interests deserve clear doors.</h1>
        <p>
          Minecraft viewers should not have to follow every programming experiment, and people
          here for conversation may not want every game notification. Maiks.yt keeps one shared
          home while allowing each topic to grow its own audience and identity.
        </p>
      </header>

      <aside className={styles.statusNotice} aria-label="Channel system status">
        <p className={styles.sectionLabel}>Current status</p>
        <strong>The real destinations are listed. Topic routing is still being built.</strong>
        <p>
          Twitch and YouTube links below come from the live creator-link records. Dedicated topic
          pages, channel-aware schedules, themes, and automatic destination routing are not active
          on the public site yet. <a href="/plays">Read why MaiksPlays exists &rarr;</a>
        </p>
      </aside>

      <section className={styles.destinations} aria-labelledby="destinations-heading">
        <header className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>Published destinations</p>
            <h2 id="destinations-heading">Where the channels live now.</h2>
          </div>
          <p>
            These links use the same live records as the creator-links page. A missing provider or
            failed data request does not produce a made-up replacement.
          </p>
        </header>

        {linkResult.status === "error" ? (
          <div className={styles.emptyState} aria-live="polite">
            <strong>Channel destinations are temporarily unavailable.</strong>
            <p>The live creator-link service could not be reached. Please try again shortly.</p>
          </div>
        ) : publishedChannels.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No Twitch or YouTube destinations are currently published.</strong>
          </div>
        ) : (
          <ol className={styles.channelList}>
            {publishedChannels.map((channel, index) => (
              <li key={channel.key}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.channelIdentity}>
                  <span>{getPlatformLabel(channel)}</span>
                  <h3>{channel.title}</h3>
                </div>
                <p>{channel.description}</p>
                <a href={channel.href} rel="noreferrer" target="_blank">
                  Open channel &rarr;
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.interests} aria-labelledby="interests-heading">
        <header className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>Content directions</p>
            <h2 id="interests-heading">One person, several lanes.</h2>
          </div>
          <p>
            These are working groups, not a promise that every interest gets a separate channel.
            They help decide what belongs together as the schedule and channel structure develops.
          </p>
        </header>

        <div className={styles.interestList}>
          {interestGroups.map((group, index) => (
            <article key={group.label}>
              <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p className={styles.groupLabel}>{group.label}</p>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
              </div>
              <ul aria-label={`${group.label} interests`}>
                {group.interests.map((interest) => <li key={interest}>{interest}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

    </main>
  );
};

export default ChannelsPage;
