"use client";

import {
  eventRegistry,
  isProductionEventRoutingRuleEventKind,
  listEventActionCatalogEntries,
  listProviderActionCapabilities,
  listProviderEventCatalogEntries
} from "@maiks-yt/domain/events";
import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { FiGlobe, FiLayers } from "react-icons/fi";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import type { ConnectionsSource } from "./connections.types";
import ProviderIntakeRecentClient from "./provider-intake-recent-client";

type WorkspaceTab = "intake" | "catalogue" | "actions";
type CatalogueMode = "production" | "non-production";

type SourceOption = {
  icon: IconType;
  label: string;
  value: ConnectionsSource;
};

type CatalogueRow = {
  eventName: string;
  key: string;
  label: string;
  mechanism: string;
  safety: string[];
  source: Exclude<ConnectionsSource, "any">;
  trigger: string;
};

const sourceOptions: SourceOption[] = [
  { icon: FiLayers, label: "All sources", value: "any" },
  { icon: SiTwitch, label: "Twitch", value: "twitch" },
  { icon: SiYoutube, label: "YouTube", value: "youtube" },
  { icon: SiDiscord, label: "Discord", value: "discord" },
  { icon: FiGlobe, label: "Website", value: "website" }
];

const sourceLabels: Record<Exclude<ConnectionsSource, "any">, string> = {
  discord: "Discord",
  twitch: "Twitch",
  website: "Website",
  youtube: "YouTube"
};

const productionCatalogueExcludedEventKinds = new Set<string>([
  "website.free-tts-request"
]);

const providerSafety = (
  entry: ReturnType<typeof listProviderEventCatalogEntries>[number]
): string[] => {
  const badges = ["log first"];

  if (entry.safety.moneyShaped) badges.push("money");
  if (entry.safety.moderationShaped) badges.push("moderation");
  if (entry.safety.authOrTokenShaped) badges.push("auth/token");
  if (entry.safety.highVolume) badges.push("high-volume");
  if (entry.safety.internalOnly) badges.push("internal");
  if (!entry.safety.overlayEligibleByDefault) badges.push("overlay off");

  return badges;
};

const registrySafety = (entry: (typeof eventRegistry)[number]): string[] => {
  const badges: string[] = [];

  if (entry.safety.simulatedOnly) badges.push("simulated");
  if (entry.safety.internalOnly) badges.push("internal");
  if (entry.safety.moneyGated) badges.push("money");
  if (entry.safety.providerGated) badges.push("provider gate");
  if (entry.safety.approvalRecommended) badges.push("approval");
  if (entry.safety.overlayEligible) badges.push("overlay eligible");

  return badges.length > 0 ? badges : ["internal default"];
};

const isProductionConnectionsWebsiteEvent = (
  entry: (typeof eventRegistry)[number]
): boolean =>
  (entry.sourcePlatforms as readonly string[]).includes("website")
  && isProductionEventRoutingRuleEventKind(entry.kind)
  && !productionCatalogueExcludedEventKinds.has(entry.kind);

const isWebsiteEvent = (
  entry: (typeof eventRegistry)[number]
): boolean => (entry.sourcePlatforms as readonly string[]).includes("website");

export const buildCatalogueRows = (
  mode: CatalogueMode = process.env.NODE_ENV === "production" ? "production" : "non-production"
): CatalogueRow[] => {
  const providerRows = listProviderEventCatalogEntries().map((entry) => ({
    eventName: entry.providerEventName,
    key: `${entry.platform}:${entry.mechanism}:${entry.providerEventName}`,
    label: entry.label,
    mechanism: entry.mechanism,
    safety: providerSafety(entry),
    source: entry.platform,
    trigger: entry.internalTrigger
  } satisfies CatalogueRow));

  const websiteRows = eventRegistry
    .filter(mode === "production" ? isProductionConnectionsWebsiteEvent : isWebsiteEvent)
    .map((entry) => ({
      eventName: entry.kind,
      key: `website:${entry.kind}`,
      label: entry.label,
      mechanism: "website event",
      safety: registrySafety(entry),
      source: "website",
      trigger: entry.kind
    } satisfies CatalogueRow));

  return [...providerRows, ...websiteRows];
};

const SourceFilters = ({
  source,
  onChange
}: {
  source: ConnectionsSource;
  onChange: (source: ConnectionsSource) => void;
}): React.ReactNode => (
  <div className="connections-source-filters" aria-label="Filter event source">
    {sourceOptions.map((option) => {
      const Icon = option.icon;
      return (
        <button
          aria-pressed={source === option.value}
          className={source === option.value ? "selected" : undefined}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          <Icon aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      );
    })}
  </div>
);

const EventCatalogue = ({ source }: { source: ConnectionsSource }): React.ReactNode => {
  const rows = useMemo(() => {
    const allRows = buildCatalogueRows();
    return source === "any" ? allRows : allRows.filter((row) => row.source === source);
  }, [source]);

  return (
    <section className="connections-secondary-view" aria-labelledby="connections-catalogue-title">
      <div className="connections-section-heading">
        <div>
          <h2 id="connections-catalogue-title">Event catalogue</h2>
          <p>Known event types and safe default handling for every registered source.</p>
        </div>
        <span>{rows.length} event type{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="connections-table-scroll">
        <table className="connections-data-table connections-catalogue-table">
          <thead>
            <tr><th>Source</th><th>Event</th><th>Mechanism</th><th>Trigger</th><th>Safety</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{sourceLabels[row.source]}</td>
                <td><strong>{row.label}</strong><code>{row.eventName}</code></td>
                <td>{row.mechanism}</td>
                <td><code>{row.trigger}</code></td>
                <td><div className="connections-badges">{row.safety.map((badge) => <span key={badge}>{badge}</span>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ActionReadiness = (): React.ReactNode => {
  const capabilities = listProviderActionCapabilities();
  const actions = listEventActionCatalogEntries();

  return (
    <div className="connections-secondary-stack">
      <section className="connections-secondary-view" aria-labelledby="connections-readiness-title">
        <div className="connections-section-heading">
          <div>
            <h2 id="connections-readiness-title">Provider action readiness</h2>
            <p>Provider writes remain fail-closed when credentials, rights, or event context are missing.</p>
          </div>
        </div>
        <div className="connections-table-scroll">
          <table className="connections-data-table connections-readiness-table">
            <thead><tr><th>Provider</th><th>Action</th><th>Status</th><th>Reason</th></tr></thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={`${capability.platform}:${capability.actionKey}`}>
                  <td>{sourceLabels[capability.platform]}</td>
                  <td><code>{capability.actionKey}</code></td>
                  <td><div className="connections-badges"><span>{capability.status}</span>{capability.requiresLiveContext ? <span>live context</span> : null}</div></td>
                  <td>{capability.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="connections-secondary-view" aria-labelledby="connections-actions-title">
        <div className="connections-section-heading">
          <div>
            <h2 id="connections-actions-title">Available actions</h2>
            <p>Catalogue only. Nothing is executed from this list.</p>
          </div>
        </div>
        <div className="connections-table-scroll">
          <table className="connections-data-table connections-actions-table">
            <thead><tr><th>Action</th><th>Description</th><th>Safety</th></tr></thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.key}>
                  <td><strong>{action.label}</strong><code>{action.key}</code></td>
                  <td>{action.description}</td>
                  <td>
                    <div className="connections-badges">
                      <span>{action.safety.enabledInCurrentPhase ? "available now" : "future gate"}</span>
                      {action.safety.publicOutput ? <span>public output</span> : null}
                      {action.safety.requiresApprovalSupport ? <span>approval</span> : null}
                      {action.safety.providerWriteRequired ? <span>provider write</span> : null}
                      {action.safety.moderationGated ? <span>moderation</span> : null}
                      {action.safety.moneyGated ? <span>money</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const ConnectionsWorkspaceClient = (): React.ReactNode => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("intake");
  const [source, setSource] = useState<ConnectionsSource>("any");

  return (
    <div className="connections-workspace">
      <div className="connections-tabs" role="tablist" aria-label="Connections views">
        <button aria-selected={activeTab === "intake"} onClick={() => setActiveTab("intake")} role="tab" type="button">Observed intake</button>
        <button aria-selected={activeTab === "catalogue"} onClick={() => setActiveTab("catalogue")} role="tab" type="button">Event catalogue</button>
        <button aria-selected={activeTab === "actions"} onClick={() => setActiveTab("actions")} role="tab" type="button">Action readiness</button>
      </div>

      {activeTab !== "actions" ? <SourceFilters source={source} onChange={setSource} /> : null}

      <div className="connections-tab-panel" role="tabpanel">
        {activeTab === "intake" ? <ProviderIntakeRecentClient onSourceChange={setSource} source={source} /> : null}
        {activeTab === "catalogue" ? <EventCatalogue source={source} /> : null}
        {activeTab === "actions" ? <ActionReadiness /> : null}
      </div>
    </div>
  );
};

export default ConnectionsWorkspaceClient;
