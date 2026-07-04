import {
  listEventActionCatalogEntries,
  listProviderEventCatalogEntries,
  summarizeProviderEventCatalog
} from "@maiks-yt/domain/events";

import ProviderIntakeRecentClient from "./provider-intake-recent-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connections | Maiks.yt",
  description: "Read-only provider event and action catalog."
};

const platformLabels = {
  discord: "Discord",
  twitch: "Twitch",
  youtube: "YouTube"
};

const safetyBadgesForEvent = (entry: ReturnType<typeof listProviderEventCatalogEntries>[number]): string[] => {
  const badges = ["log first"];

  if (entry.safety.moneyShaped) {
    badges.push("money-shaped");
  }

  if (entry.safety.moderationShaped) {
    badges.push("moderation");
  }

  if (entry.safety.authOrTokenShaped) {
    badges.push("auth/token");
  }

  if (entry.safety.highVolume) {
    badges.push("high-volume");
  }

  if (entry.safety.internalOnly) {
    badges.push("internal default");
  }

  if (!entry.safety.overlayEligibleByDefault) {
    badges.push("overlay off");
  }

  return badges;
};

const safetyBadgesForAction = (entry: ReturnType<typeof listEventActionCatalogEntries>[number]): string[] => {
  const badges = [entry.safety.enabledInCurrentPhase ? "available now" : "future gate"];

  if (entry.safety.publicOutput) {
    badges.push("public output");
  }

  if (entry.safety.requiresApprovalSupport) {
    badges.push("approval");
  }

  if (entry.safety.providerWriteRequired) {
    badges.push("provider write");
  }

  if (entry.safety.moderationGated) {
    badges.push("moderation");
  }

  if (entry.safety.moneyGated) {
    badges.push("money");
  }

  return badges;
};

const ConnectionsPage = (): React.ReactNode => {
  const events = listProviderEventCatalogEntries();
  const actions = listEventActionCatalogEntries();
  const summary = summarizeProviderEventCatalog();

  return (
    <main className="project-admin-page connections-admin-page">
      <header className="project-admin-header">
        <p className="eyebrow">Provider events and actions</p>
        <h1>Connections</h1>
        <p>
          Read-only catalog for incoming Twitch, YouTube, and Discord events plus the actions
          Maiks.yt can eventually connect to them.
        </p>
      </header>

      <section className="provider-integrations-summary-grid" aria-label="Provider event summary">
        <div className="live-helper-kpi">
          <span>Known events</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="live-helper-kpi">
          <span>Twitch</span>
          <strong>{summary.byPlatform.twitch}</strong>
        </div>
        <div className="live-helper-kpi">
          <span>YouTube</span>
          <strong>{summary.byPlatform.youtube}</strong>
        </div>
        <div className="live-helper-kpi">
          <span>Discord</span>
          <strong>{summary.byPlatform.discord}</strong>
        </div>
        <div className="live-helper-kpi">
          <span>Money-shaped</span>
          <strong>{summary.actions.moneyShaped}</strong>
        </div>
        <div className="live-helper-kpi">
          <span>Moderation-shaped</span>
          <strong>{summary.actions.moderationShaped}</strong>
        </div>
      </section>

      <ProviderIntakeRecentClient />

      <section className="project-admin-panel connections-admin-actions">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Available Actions</h2>
            <p>These are possible outcomes. Gated actions are cataloged but not executable here.</p>
          </div>
        </div>
        <div className="connections-action-grid">
          {actions.map((action) => (
            <article className="connections-action-card" key={action.key}>
              <div>
                <h3>{action.label}</h3>
                <code>{action.key}</code>
              </div>
              <p>{action.description}</p>
              <div className="dev-test-console-badges">
                {safetyBadgesForAction(action).map((badge) => (
                  <span className={badge.includes("future") || badge.includes("write") || badge === "money" ? "warning" : undefined} key={badge}>
                    {badge}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="project-admin-panel">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Incoming Events</h2>
            <p>Everything defaults to logging/internal review before routing or public display.</p>
          </div>
        </div>
        <div className="connections-event-table" role="table" aria-label="Provider event catalog">
          <div className="connections-event-row header" role="row">
            <span>Provider</span>
            <span>Event</span>
            <span>Trigger</span>
            <span>Safety</span>
          </div>
          {events.map((event) => (
            <div className="connections-event-row" role="row" key={`${event.platform}:${event.mechanism}:${event.providerEventName}`}>
              <span>{platformLabels[event.platform]}</span>
              <span>
                <strong>{event.label}</strong>
                <code>{event.providerEventName}</code>
                <small>{event.mechanism} / {event.category}</small>
              </span>
              <span>
                <code>{event.internalTrigger}</code>
              </span>
              <span className="dev-test-console-badges">
                {safetyBadgesForEvent(event).map((badge) => (
                  <span className={badge.includes("money") || badge.includes("auth") || badge.includes("moderation") || badge.includes("high") ? "warning" : undefined} key={badge}>
                    {badge}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ConnectionsPage;
