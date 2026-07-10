type AiControlItem = {
  label: string;
  state: "disabled" | "planned";
  detail: string;
};

const aiControlItems: readonly AiControlItem[] = [
  {
    label: "Public stream reading",
    state: "disabled",
    detail: "AI will not read provider chat, website events, or private account data aloud until a reviewed opt-in and routing policy exists."
  },
  {
    label: "TTS responses",
    state: "disabled",
    detail: "Voice and TTS playback remain off. Future free/promotional TTS needs approval, cooldowns, and stream-safe controls."
  },
  {
    label: "Moderation suggestions",
    state: "planned",
    detail: "AI can later suggest actions for a human to review, but it must not hide, warn, timeout, or ban automatically."
  },
  {
    label: "Stream assistant",
    state: "planned",
    detail: "Future assistant behavior should stay private to the control surface until Michael explicitly sends output public."
  }
];

export const AiControlsPanel = (): React.ReactNode => (
  <section className="operations-panel" aria-label="AI settings and controls">
    <div className="section-heading">
      <h2>AI Settings</h2>
      <span>Manual-first</span>
    </div>
    <div className="operations-grid">
      {aiControlItems.map((item) => (
        <article key={item.label}>
          <span>{item.state === "disabled" ? "Disabled" : "Planned"}</span>
          <strong>{item.label}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
    <div className="status-action-group">
      <button type="button" className="status-action" disabled title="Requires an approved AI provider and prompt-safety plan.">
        Enable public AI
      </button>
      <button type="button" className="status-action" disabled title="Requires an approved TTS safety and cooldown design.">
        Enable TTS
      </button>
      <button type="button" className="status-action" disabled title="Requires a reviewed human-in-the-loop moderation model.">
        Enable AI moderation suggestions
      </button>
    </div>
    <p className="status-note">
      No AI provider is connected here. This panel is intentionally inert so testing can see the intended controls before any public AI behavior exists.
    </p>
  </section>
);
