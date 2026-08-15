import Image from "next/image";
import Link from "next/link";

import {
  entitlementMocks,
  gamingIdentityMocks,
  linkedIdentityMocks,
  profileBadgeMocks,
  recognitionMocks
} from "./profile-mock-data";
import styles from "./profiles.module.css";

type MichaelProfileMockProps = {
  view: "private" | "public";
};

export const MichaelProfileMock = ({ view }: MichaelProfileMockProps): React.ReactNode => {
  if (view === "private") {
    return (
      <main className={styles.privatePage}>
        <section className={styles.privateProfile} aria-labelledby="private-profile-heading">
          <h1 id="private-profile-heading">Michael</h1>
          <p>This account is set to private</p>
        </section>
      </main>
    );
  }

  return (
  <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.mockNotice} role="note" aria-label="Design mock status">
        <strong>Public profile mock</strong>
        <span>
          This page uses static presentation data. It is not connected to Michael&apos;s account or provider records.
        </span>
      </div>

      <div className={styles.profileLead}>
        <div className={styles.portraitFrame}>
          <Image
            alt="Michael outdoors"
            className={styles.portrait}
            fill
            priority
            sizes="(max-width: 800px) 320px, 330px"
            src="/images/profiles/michael-profile-portrait.png"
          />
        </div>
        <div className={styles.profileCopy}>
          <p className={styles.eyebrow}>Public profile preview</p>
          <h1>Michael</h1>
          <p className={styles.lead}>
            I am building my way back to streaming. Maiks.yt is where the streams, projects, community, and work behind
            that return can live together.
          </p>
          <dl className={styles.profileFacts}>
            <div>
              <dt>Profile state</dt>
              <dd>Public mock</dd>
            </div>
            <div>
              <dt>Display identity</dt>
              <dd>MaiksMC</dd>
            </div>
            <div>
              <dt>Recognition</dt>
              <dd>Mock features shown</dd>
            </div>
          </dl>
        </div>
      </div>
    </header>

    <section className={styles.aboutSection} aria-labelledby="profile-about-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Profile introduction</p>
        <h2 id="profile-about-heading">One identity across different interests</h2>
      </div>
      <div className={styles.aboutBody}>
        <p>
          My interests move between games, technology, software, streaming, and practical projects. This profile mock
          explores how one public identity can connect those interests without exposing every linked account.
        </p>
        <p>
          The finished profile should let each person decide what is public, which name or image represents them, and
          whether any community or support activity belongs on their page.
        </p>
        <nav className={styles.linkRow} aria-label="Michael profile links">
          <Link href="/about">About Michael</Link>
          <Link href="/projects">Current projects</Link>
          <Link href="/schedule">Stream schedule</Link>
        </nav>
      </div>
    </section>

    <section className={styles.identitySection} aria-labelledby="linked-identities-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Linked social identities</p>
        <h2 id="linked-identities-heading">Connected does not have to mean public</h2>
      </div>
      <ul className={styles.identityList}>
        {linkedIdentityMocks.map((identity) => (
          <li className={styles.identityRow} key={identity.provider}>
            <div>
              <strong>{identity.provider}</strong>
              <span>{identity.accountLabel}</span>
            </div>
            <div>
              <span>{identity.purpose}</span>
              <small>{identity.audience}</small>
            </div>
            <div>
              <span>{identity.verification}</span>
              <small>{identity.publicState}</small>
              <small>{identity.loginState}</small>
            </div>
            <div className={styles.capabilityList} aria-label={`${identity.provider} capability examples`}>
              {identity.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
            </div>
          </li>
        ))}
      </ul>
    </section>

    <section className={styles.gamingSection} aria-labelledby="gaming-identities-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Gaming identities</p>
        <h2 id="gaming-identities-heading">Verified names for games and overlays</h2>
      </div>
      <div>
        <aside className={styles.selectedIdentity} aria-label="Selected display identity mock">
          <span>Selected display identity</span>
          <strong>MaiksMC</strong>
          <p>Example Minecraft identity selected for profile and overlay use after verification.</p>
        </aside>
        <ul className={styles.gamingList}>
          {gamingIdentityMocks.map((identity) => (
            <li className={styles.gamingRow} key={identity.platform}>
              <strong>{identity.platform}</strong>
              <span>{identity.identity}</span>
              <span>{identity.capabilities}</span>
              <div>
                <small>{identity.verification}</small>
                <small>{identity.visibility}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className={styles.recognitionSection} aria-labelledby="recognition-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Recognition preview</p>
        <h2 id="recognition-heading">Credit without forced visibility</h2>
      </div>
      <div>
        <ul className={styles.badgeList} aria-label="Example profile badges">
          {profileBadgeMocks.map((badge) => (
            <li key={badge.label}>
              <strong>{badge.label}</strong>
              <span>{badge.reason}</span>
            </li>
          ))}
        </ul>
        <ul className={styles.recognitionList}>
          {recognitionMocks.map((recognition) => (
            <li className={styles.recognitionRow} key={`${recognition.source}-${recognition.title}`}>
              <div>
                <small>{recognition.source}</small>
                <strong>{recognition.title}</strong>
              </div>
              <span>{recognition.description}</span>
              <span>{recognition.displayRule}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className={styles.perksSection} aria-labelledby="profile-perks-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Ranks, perks, and claims</p>
        <h2 id="profile-perks-heading">Benefits keep their source and boundaries</h2>
      </div>
      <ul className={styles.entitlementList}>
        {entitlementMocks.map((entitlement) => (
          <li className={styles.entitlementRow} key={entitlement.feature}>
            <strong>{entitlement.feature}</strong>
            <span>{entitlement.mockState}</span>
            <small>{entitlement.boundary}</small>
          </li>
        ))}
      </ul>
    </section>

    <section className={styles.privacySection} aria-labelledby="profile-privacy-heading">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionLabel}>Intended privacy defaults</p>
        <h2 id="profile-privacy-heading">The person controls the profile</h2>
      </div>
      <div>
        <ul className={styles.privacyList}>
          <li className={styles.privacyRow}>
            <strong>Profile</strong>
            <span>Private until the owner deliberately publishes it.</span>
          </li>
          <li className={styles.privacyRow}>
            <strong>Linked identities</strong>
            <span>Hidden individually unless the owner chooses to show them.</span>
          </li>
          <li className={styles.privacyRow}>
            <strong>Game names</strong>
            <span>Shown only after provider verification or a reviewed fallback process.</span>
          </li>
          <li className={styles.privacyRow}>
            <strong>Recognition history</strong>
            <span>Opt-in by category and event, removable, with exact financial values hidden by default.</span>
          </li>
          <li className={styles.privacyRow}>
            <strong>Moderation</strong>
            <span>Offensive names, avatars, or impersonation can be hidden and reviewed without deleting the account.</span>
          </li>
        </ul>
      </div>
    </section>

      <section className={styles.publicBoundary} aria-labelledby="public-profile-boundary-heading">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionLabel}>Public boundary</p>
          <h2 id="public-profile-boundary-heading">Private account controls stop here</h2>
        </div>
        <div className={styles.aboutBody}>
          <p>
            Login permissions, provider sync, unlinking, audience routing, hidden recognition, and moderation review are
            deliberately absent from this public view.
          </p>
          <Link className={styles.progressLink} href="/progress#profiles-and-recognition">
            Follow the profile system progress
          </Link>
          <Link className={styles.searchLink} href="/profiles">
            Return to profile search
          </Link>
        </div>
      </section>
  </main>
  );
};
