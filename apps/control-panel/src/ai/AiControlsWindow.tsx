import type { ReactNode } from "react";

type AiControlItem = {
  detail: string;
  label: string;
  state: "off" | "shadow" | "blocked";
};

const aiControlItems: readonly AiControlItem[] = [
  {
    detail: "Local planning only. No public messages, overlays, provider chat, or stream audio.",
    label: "Assistant output",
    state: "shadow"
  },
  {
    detail: "Muted until a reviewed voice/TTS phase exists.",
    label: "TTS",
    state: "off"
  },
  {
    detail: "Disabled until the policy, audit, and human-review path is approved.",
    label: "Moderation suggestions",
    state: "blocked"
  },
  {
    detail: "Disabled for paid messages, bits, memberships, donations, and money-adjacent text.",
    label: "Paid-message reading",
    state: "blocked"
  },
  {
    detail: "Disabled. AI cannot send provider messages, change scenes, or moderate users.",
    label: "Autonomous actions",
    state: "blocked"
  }
];

const stateLabels: Record<AiControlItem["state"], string> = {
  blocked: "Blocked",
  off: "Off",
  shadow: "Shadow"
};

export const AiControlsWindow = (): ReactNode => (
  <section className="ai-controls-window" aria-label="AI controls">
    <div className="section-heading">
      <h2>AI Controls</h2>
      <span>Public output disabled</span>
    </div>
    <div className="ai-controls-summary" aria-label="AI safety state">
      <div>
        <strong>Manual-first</strong>
        <span>Owner review required before anything public.</span>
      </div>
      <div>
        <strong>Network quiet</strong>
        <span>No AI provider calls from this panel.</span>
      </div>
      <div>
        <strong>Stream safe</strong>
        <span>No speech, overlay text, chat replies, or moderation decisions.</span>
      </div>
    </div>
    <ol className="ai-controls-list">
      {aiControlItems.map((item) => (
        <li key={item.label}>
          <div>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
          <span className={`ai-state-pill ${item.state}`}>{stateLabels[item.state]}</span>
        </li>
      ))}
    </ol>
  </section>
);
