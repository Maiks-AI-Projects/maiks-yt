type OperationsPanelProps = {
  apiBaseUrl: string;
  displayName: string;
  panelMode: string;
};

export const OperationsPanel = ({ apiBaseUrl, displayName, panelMode }: OperationsPanelProps): React.ReactNode => (
  <section className="operations-panel" aria-label="Operations">
    <div className="section-heading">
      <h2>Operations</h2>
      <span>{panelMode}</span>
    </div>
    <div className="operations-grid">
      <article>
        <span>Operator</span>
        <strong>{displayName}</strong>
      </article>
      <article>
        <span>API base</span>
        <strong>{new URL(apiBaseUrl).host}</strong>
      </article>
      <article>
        <span>Surface</span>
        <strong>control-panel</strong>
      </article>
      <article>
        <span>Realtime tools</span>
        <strong>quiet</strong>
      </article>
    </div>
  </section>
);
