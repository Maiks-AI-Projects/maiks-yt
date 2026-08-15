import type { Metadata } from "next";

import styles from "./interactions.module.css";

export const metadata: Metadata = {
  title: "Live interactions",
  description:
    "How chat, website activity, recognition, commands, and future TTS can participate in Maiks.yt streams with clear visibility choices."
};

const participationPaths = [
  {
    status: "Connected foundation",
    title: "Provider chat",
    description:
      "Twitch, YouTube, and Discord chat can reach the private streamer tools. A message is not automatically placed on the OBS overlay."
  },
  {
    status: "Planned",
    title: "Website activity",
    description:
      "Approved account, project, schedule, profile, and community activity may later trigger a restrained stream notification."
  },
  {
    status: "Planned",
    title: "Stream commands",
    description:
      "Short commands can return useful context, links, or stream information in the originating chat without becoming overlay noise."
  },
  {
    status: "Later",
    title: "Limited website TTS",
    description:
      "A future free message may be available once per stream, with review, safety, cooldown, and playback controls. It is not active now."
  }
] as const;

const visibilityPromises = [
  {
    title: "Private can stay private",
    description:
      "Security, privacy, account, and provider-token events belong in private tools and never need an on-stream announcement."
  },
  {
    title: "Appearance stays optional",
    description:
      "Website signup, public name, and profile-image recognition should respect the account's stream-visibility preference."
  },
  {
    title: "Frequency has limits",
    description:
      "Cooldowns, once-per-stream rules, and duplicate suppression keep free interactions from becoming spam."
  },
  {
    title: "Some moments need review",
    description:
      "Text, images, audio, and unusual events may wait for approval before reaching viewers or playing through OBS."
  }
] as const;

const InteractionsPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Website and stream</p>
      <h1>Participation should come with a clear destination.</h1>
      <p>
        Chat, profile recognition, website actions, commands, and future TTS should not all behave
        the same way. People should know when an interaction stays private, reaches the streamer,
        or may appear publicly on stream.
      </p>
    </header>

    <aside className={styles.statusNotice} aria-label="Live interaction system status">
      <p className={styles.sectionLabel}>Current status</p>
      <strong>Provider chat intake exists. Public website interactions are not open yet.</strong>
      <p>
        Twitch, YouTube, and Discord messages can enter the private streamer chat and moderation
        tools. Public website actions, stream commands, profile recognition, and free TTS still need
        their visitor-facing flows and final routing rules.
      </p>
    </aside>

    <section className={styles.paths} aria-labelledby="paths-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Participation paths</p>
          <h2 id="paths-heading">Several ways in, one understandable experience.</h2>
        </div>
        <p>
          Guests should still be able to join ordinary provider chat. An account becomes useful
          when someone wants identity, recognition, visibility choices, or website-specific actions.
        </p>
      </header>

      <ol className={styles.pathList}>
        {participationPaths.map((path, index) => (
          <li key={path.title}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.pathIdentity}>
              <span>{path.status}</span>
              <h3>{path.title}</h3>
            </div>
            <p>{path.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.visibility} aria-labelledby="visibility-heading">
      <header className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionLabel}>Visibility and safety</p>
          <h2 id="visibility-heading">Not every event belongs on screen.</h2>
        </div>
        <p>
          Stream visibility is a separate decision from whether an event exists. The system should
          receive useful activity while still respecting privacy, moderation, and the pace of the
          live show.
        </p>
      </header>

      <ul className={styles.promiseList}>
        {visibilityPromises.map((promise, index) => (
          <li key={promise.title}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <strong>{promise.title}</strong>
            <p>{promise.description}</p>
          </li>
        ))}
      </ul>
    </section>

    <section className={styles.choice} aria-labelledby="choice-heading">
      <div>
        <p className={styles.sectionLabel}>Your choice</p>
        <h2 id="choice-heading">Joining the community should add control, not pressure.</h2>
      </div>
      <div className={styles.choiceContent}>
        <p>
          Watching and ordinary chat should not require a Maiks.yt account. Signing in can later
          connect identities, remember preferences, enable eligible website actions, and let someone
          choose whether public profile activity may be recognized on stream.
        </p>
        <p>
          Community rules still apply regardless of where an interaction starts. Moderation can
          keep a person or message out of stream presentation even when the originating provider
          continues to carry it.
        </p>
        <div className={styles.relatedLinks}>
          <a href="/community-rules">Read the community rules &rarr;</a>
          <a href="/account">Manage account visibility &rarr;</a>
          <a href="/context">Browse stream context &rarr;</a>
        </div>
      </div>
    </section>
  </main>
);

export default InteractionsPage;
