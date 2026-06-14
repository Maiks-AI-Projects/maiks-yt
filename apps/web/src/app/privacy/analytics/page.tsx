import { telemetryEventDefinitions } from "@maiks-yt/config";

const dataClassLabels = {
  operational: "Operational health",
  security: "Security",
  "sponsor-aggregate": "Sponsor reporting"
} as const;

const AnalyticsPrivacyPage = (): React.ReactNode => (
  <main className="policy-page">
    <header className="links-header">
      <p className="eyebrow">Privacy</p>
      <h1>Analytics and Necessary Data</h1>
      <p>Maiks.yt is designed to collect only information needed to operate features, protect accounts, and report promised sponsor visibility.</p>
    </header>

    <section>
      <h2>What is not collected</h2>
      <p>There is no cross-site advertising profile, sale of personal data, or general-purpose page-view tracking in the current design.</p>
    </section>

    <section>
      <h2>Allowed telemetry</h2>
      <div className="policy-table-wrap">
        <table className="policy-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Purpose</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(telemetryEventDefinitions).map(([eventName, definition]) => (
              <tr key={eventName}>
                <td><code>{eventName}</code></td>
                <td>{dataClassLabels[definition.dataClass]}</td>
                <td>{definition.retentionDays} days maximum</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Private content</h2>
      <p>Chat message text, private messages, medical information, and sensitive profile data are excluded from this telemetry allowlist.</p>
    </section>
  </main>
);

export default AnalyticsPrivacyPage;
