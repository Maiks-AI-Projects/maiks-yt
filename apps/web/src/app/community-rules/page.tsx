export const metadata = {
  title: "Community Rules Draft | Maiks.yt",
  description: "Draft community rules for Maiks.yt dev testing."
};

const CommunityRulesPage = (): React.ReactNode => (
  <main className="content-page">
    <header className="links-header">
      <p className="eyebrow">Community safety</p>
      <h1>Community Rules</h1>
      <p>Draft rules for Maiks.yt chat, overlays, profiles, linked accounts, and website interactions.</p>
    </header>

    <aside className="content-notice" aria-label="Draft status">
      This is a dev-testing draft, not final launch policy. Michael can revise the wording before production.
    </aside>

    <section>
      <h2>Core rules</h2>
      <ul className="content-rule-list">
        <li>Be respectful. No harassment, threats, hate, targeted insults, or encouragement of self-harm.</li>
        <li>Keep the stream usable. No spam, raids, repeated off-topic disruption, impersonation, or attempts to derail live tools.</li>
        <li>Do not abuse identity features. No offensive display names, avatars, malicious account linking, fake claims, or impersonation.</li>
        <li>Do not abuse support or money-adjacent systems. No fake donation claims, chargeback abuse, fraud attempts, or pressure around private support.</li>
        <li>Keep private information private. No doxxing, credential sharing, private messages, or attempts to expose hidden moderation/admin data.</li>
        <li>Follow platform and legal boundaries. Serious threats, stalking, fraud, exploitation, or other severe abuse may be escalated outside the site.</li>
      </ul>
    </section>

    <section>
      <h2>Moderation ladder</h2>
      <p>Moderation starts manual-first. The normal ladder is an internal note, a warning, a strike, a temporary restriction, and only then a ban for severe or repeated abuse.</p>
      <p>Three active strikes should trigger owner review. They should not automatically ban or remove someone without a reviewed decision.</p>
    </section>

    <section>
      <h2>Helper boundaries</h2>
      <p>Helpers and moderators can assist with monitoring, notes, proposed warnings, and granted live tools. Owner-only decisions include permanent bans, long restrictions, serious appeals, role authority, auth, secrets, and money/support decisions.</p>
    </section>

    <section>
      <h2>Review and correction</h2>
      <p>Warnings, strikes, and restrictions should stay reviewable. If an account was hacked, a child used an account, or context was missed, Michael can review and remove or change the action.</p>
    </section>

    <section>
      <h2>Not automated yet</h2>
      <p>This page does not mean automatic bans, provider-side moderation, AI moderation decisions, money enforcement, or police/platform reports are active. Those need separate reviewed implementation work.</p>
    </section>
  </main>
);

export default CommunityRulesPage;
