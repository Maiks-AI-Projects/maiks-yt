import { notFound } from "next/navigation";

import styles from "../gemini-lab.module.css";
import { getLabTheme, labThemes, type LabTheme } from "../lab-data";

type LabPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const generateStaticParams = (): Array<{ slug: string }> => labThemes.map((theme) => ({ slug: theme.slug }));

const commonLinks = labThemes.map((theme) => ({
  href: `/gemini-lab/${theme.slug}`,
  label: theme.slug
}));

const renderLanding = (theme: LabTheme): React.ReactNode => (
  <>
    <section className={styles.hero}>
      <div>
        <h1>{theme.title}</h1>
        <p>{theme.subtitle}</p>
        <div className={styles.buttonRow}>
          <a className={styles.button} href="/gemini-lab/projects">View Goals</a>
          <a className={`${styles.button} ${styles.secondaryButton}`} href="/gemini-lab/schedule">Schedule</a>
        </div>
      </div>
      <aside className={styles.panel}>
        <h2>Live Stream Snapshot</h2>
        <div className={styles.timeline}>
          <div className={styles.timelineItem}><strong>Current goal</strong><br />AI server parts list</div>
          <div className={styles.timelineItem}><strong>Next stream</strong><br />Friday, 20:00 Europe/Amsterdam</div>
          <div className={styles.timelineItem}><strong>Community action</strong><br />Vote on the next build milestone</div>
        </div>
      </aside>
    </section>
    <section className={styles.grid}>
      <article className={styles.stat}><strong>72%</strong><span>goal funded</span></article>
      <article className={styles.stat}><strong>14</strong><span>verified community IGNs</span></article>
      <article className={styles.stat}><strong>3</strong><span>active project milestones</span></article>
    </section>
  </>
);

const renderProjects = (): React.ReactNode => (
  <section className={styles.grid}>
    <article className={styles.panel}>
      <h2>AI Server Build</h2>
      <p className={styles.muted}>Nested parts, price tracking, votes, and transparent overflow handling.</p>
      <div className={styles.notice}>Mutually exclusive with the prebuilt workstation option.</div>
    </article>
    <article className={styles.panel}>
      <h2>Stream Overlay V2</h2>
      <p className={styles.muted}>Non-money project with milestones for overlay layouts, chat merge, and sponsor telemetry.</p>
    </article>
    <article className={styles.panel}>
      <h2>Monthly Tools</h2>
      <p className={styles.muted}>Ongoing subscriptions and running costs with public withdrawal summaries.</p>
    </article>
  </section>
);

const renderProfile = (): React.ReactNode => (
  <section className={styles.grid}>
    <article className={styles.panel}>
      <h2>Maiks</h2>
      <p className={styles.muted}>Public profile preview with linked channels and optional badges.</p>
      <table className={styles.table}>
        <tbody>
          <tr><th>Display name</th><td>FactoryMaiks</td></tr>
          <tr><th>Verified IGN</th><td>Satisfactory, Minecraft</td></tr>
          <tr><th>Public gifts</th><td>Enabled</td></tr>
        </tbody>
      </table>
    </article>
    <article className={styles.panel}>
      <h2>Linked Accounts</h2>
      <p className={styles.muted}>Google login enabled, Twitch channel links separated by audience.</p>
    </article>
  </section>
);

const renderSchedule = (): React.ReactNode => (
  <section className={styles.panel}>
    <h2>Upcoming Streams</h2>
    <div className={styles.timeline}>
      <div className={styles.timelineItem}><strong>Friday 20:00</strong><br />Satisfactory factory rebuild</div>
      <div className={styles.timelineItem}><strong>Sunday 14:00</strong><br />Minecraft community planning</div>
      <div className={styles.timelineItem}><strong>Flexible</strong><br />Coding stream if health and energy allow it</div>
    </div>
    <div className={styles.notice}>Cancellation messaging should be direct, kind, and easy to syndicate to socials.</div>
  </section>
);

const renderLinks = (): React.ReactNode => (
  <section className={styles.grid}>
    {["YouTube", "Twitch", "Discord", "RSS Feed", "Projects", "Affiliate Links"].map((label) => (
      <a className={styles.panel} href="/gemini-lab" key={label}>
        <h2>{label}</h2>
        <p className={styles.muted}>Mock link target for layout testing.</p>
      </a>
    ))}
  </section>
);

const renderAffiliate = (): React.ReactNode => (
  <section className={styles.panel}>
    <h2>Affiliate Links Are Income Sources</h2>
    <p className={styles.muted}>
      This page should make it clear when links may generate income and avoid presenting every linked product as a personal recommendation.
    </p>
    <table className={styles.table}>
      <thead><tr><th>Store</th><th>Use</th><th>Disclosure</th></tr></thead>
      <tbody>
        <tr><td>Amazon</td><td>Wishlist and project items</td><td>Affiliate relationship possible</td></tr>
        <tr><td>Dutch tech store</td><td>PC parts price tracking</td><td>Income source if affiliate link is used</td></tr>
      </tbody>
    </table>
  </section>
);

const renderTransparency = (): React.ReactNode => (
  <section className={styles.panel}>
    <h2>Public Money Trail</h2>
    <p className={styles.muted}>Mock ledger display for withdrawals, archived projects, spending summaries, and anonymous deleted-user donations.</p>
    <table className={styles.table}>
      <thead><tr><th>Date</th><th>Action</th><th>Amount</th><th>Project</th></tr></thead>
      <tbody>
        <tr><td>2026-06-10</td><td>Donation</td><td>EUR 25.00</td><td>AI Server Build</td></tr>
        <tr><td>2026-06-11</td><td>Withdrawal</td><td>EUR 119.00</td><td>Overlay hosting year one</td></tr>
        <tr><td>2026-06-12</td><td>Anonymous donation</td><td>EUR 10.00</td><td>Community tools</td></tr>
      </tbody>
    </table>
  </section>
);

const renderPageBody = (theme: LabTheme): React.ReactNode => {
  switch (theme.kind) {
    case "landing":
      return renderLanding(theme);
    case "projects":
      return renderProjects();
    case "profile":
      return renderProfile();
    case "schedule":
      return renderSchedule();
    case "links":
      return renderLinks();
    case "affiliate":
      return renderAffiliate();
    case "transparency":
      return renderTransparency();
  }
};

const GeminiLabSlugPage = async ({ params }: LabPageProps): Promise<React.ReactNode> => {
  const { slug } = await params;
  const theme = getLabTheme(slug);

  if (!theme) {
    notFound();
  }

  return (
    <main
      className={`${styles.shell} ${styles[`theme-${theme.slug}`] || ""}`}
      style={{
        "--lab-bg": theme.tokens.background,
        "--lab-fg": theme.tokens.foreground,
        "--lab-muted": theme.tokens.muted,
        "--lab-panel": theme.tokens.panel,
        "--lab-accent": theme.tokens.accent,
        "--lab-danger": theme.tokens.danger,
        "--lab-warning": theme.tokens.warning,
        "--lab-success": theme.tokens.success
      } as React.CSSProperties}
    >
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <a className={styles.pill} href="/gemini-lab">Gemini Layout Lab</a>
          <div className={styles.navLinks}>
            {commonLinks.map((link) => (
              <a className={styles.pill} href={link.href} key={link.href}>{link.label}</a>
            ))}
          </div>
        </nav>
        {renderPageBody(theme)}
      </div>
    </main>
  );
};

export default GeminiLabSlugPage;
