import {
  capabilityStateLabels,
  formatDate,
  stateLabels
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
          <article className={`provider-integration-row ${provider.state}`} key={provider.id}>
            <div className="provider-integration-heading">
              <div>
                <h3>{provider.label}</h3>
                <p>{provider.sdk}</p>
              </div>
              <span className={`provider-integration-state ${provider.state}`}>
                {stateLabels[provider.state]}
              </span>
            </div>

            <div className="provider-env-grid" aria-label={`${provider.label} environment variables`}>
              {provider.env.map((variable) => (
                <div className="provider-env-item" key={variable.name}>
                  <span>{variable.name}</span>
                  <strong>{variable.configured ? "Present" : variable.required ? "Missing" : "Optional"}</strong>
                  <small>{variable.kind}{variable.required ? " required" : " optional"}</small>
                </div>
              ))}
            </div>

            {provider.issues.length > 0 ? (
              <ul className="provider-issue-list" aria-label={`${provider.label} issues`}>
                {provider.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}

            <div className="provider-capability-row" aria-label={`${provider.label} foundation capabilities`}>
              {provider.capabilities.map((capability) => (
                <div className={`provider-capability-card ${capability.state}`} key={capability.key}>
                  <div>
                    <strong>{capability.label}</strong>
                    <span>{capabilityStateLabels[capability.state]}</span>
                  </div>
                  <p>{capability.detail}</p>
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
          <h2>Boundaries</h2>
          <p>Current integration limits.</p>
        </div>
      </div>
      <ul className="live-helper-boundary-list">
        {snapshot.boundaries.map((boundary) => (
          <li key={boundary}>{boundary}</li>
        ))}
      </ul>
    </section>
  </>
);

export default ProviderIntegrationsStatusSection;
