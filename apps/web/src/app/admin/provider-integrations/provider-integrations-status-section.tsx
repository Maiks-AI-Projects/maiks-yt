import {
  capabilityStateLabels,
  formatDate,
  readinessLabels
} from "./provider-integrations-status.service";
import type { ProviderIntegrationsStatusResponse } from "./provider-integrations-status.types";

type ProviderIntegrationsStatusSnapshot = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;

type ProviderIntegrationsStatusSectionProps = {
  snapshot: ProviderIntegrationsStatusSnapshot;
};

const ProviderIntegrationsStatusSection = ({
  snapshot
}: ProviderIntegrationsStatusSectionProps): React.ReactNode => (
  <>
    <section className="project-admin-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Provider Status</h2>
          <p>Generated {formatDate(snapshot.generatedAt)}</p>
        </div>
      </div>

      <div className="provider-integrations-list">
        {snapshot.providers.map((provider) => (
          <article className={`provider-integration-row ${provider.readiness}`} key={provider.id}>
            <div className="provider-integration-heading">
              <div>
                <h3>{provider.label}</h3>
                <p>{provider.runtime.accountSummary ?? "No account or channel selected"}</p>
              </div>
              <span className={`provider-integration-state ${provider.readiness}`}>
                {readinessLabels[provider.readiness]}
              </span>
            </div>

            {provider.guidance ? <p className="provider-issue-list">{provider.guidance}</p> : null}

            <div className="provider-capability-row" aria-label={`${provider.label} foundation capabilities`}>
              {provider.capabilities.map((capability) => (
                <div className={`provider-capability-card ${capability.state}`} key={capability.key}>
                  <div>
                    <strong>{capability.label}</strong>
                    <span>{capabilityStateLabels[capability.state]}</span>
                  </div>
                  <p>{provider.runtime.state.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="project-admin-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Runtime</h2>
          <p>Current connection decisions.</p>
        </div>
      </div>
      <ul className="provider-boundary-list">
        {snapshot.providers.map((provider) => (
          <li key={provider.id}>{provider.label}: {provider.runtime.state.replace("_", " ")}</li>
        ))}
      </ul>
    </section>
  </>
);

export default ProviderIntegrationsStatusSection;
