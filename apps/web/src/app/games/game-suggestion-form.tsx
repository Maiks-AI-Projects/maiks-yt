"use client";

import { useState } from "react";

type SuggestionResponse =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason: string;
  };

type SuggestionFormState = {
  title: string;
  platformLabel: string;
  storeUrl: string;
  reason: string;
  tags: string;
  suggestedByName: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const defaultForm: SuggestionFormState = {
  title: "",
  platformLabel: "",
  storeUrl: "",
  reason: "",
  tags: "",
  suggestedByName: ""
};

const GameSuggestionForm = (): React.ReactNode => {
  const [form, setForm] = useState<SuggestionFormState>(defaultForm);
  const [message, setMessage] = useState("Suggestions go to review before anything becomes public.");
  const [isBusy, setIsBusy] = useState(false);

  const submitSuggestion = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsBusy(true);
    setMessage("Sending suggestion...");

    try {
      const response = await fetch(`${apiBaseUrl}/games/suggestions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          platformLabel: form.platformLabel.trim() || null,
          storeUrl: form.storeUrl.trim() || null,
          reason: form.reason.trim() || null,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
          suggestedByName: form.suggestedByName.trim() || null
        })
      });
      const payload = await response.json() as SuggestionResponse;

      if (response.ok && payload.ok) {
        setForm(defaultForm);
        setMessage("Suggestion received for review.");
        return;
      }

      setMessage(payload.ok === false && payload.reason === "game_suggestion_invalid_input"
        ? "Check the suggestion fields and try again."
        : `Suggestion failed with ${response.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suggestion failed.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="project-admin-panel game-suggestion-panel">
      <div className="project-admin-panel-heading">
        <h2>Suggest a Game</h2>
        <span aria-live="polite">{message}</span>
      </div>
      <form className="project-admin-form" onSubmit={(event) => void submitSuggestion(event)}>
        <div className="project-admin-form-grid">
          <label>
            Game Title
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
          </label>
          <label>
            Platform
            <input value={form.platformLabel} onChange={(event) => setForm((current) => ({ ...current, platformLabel: event.target.value }))} maxLength={120} />
          </label>
        </div>
        <label>
          Store URL
          <input value={form.storeUrl} onChange={(event) => setForm((current) => ({ ...current, storeUrl: event.target.value }))} maxLength={1024} />
        </label>
        <label>
          Why this could work on stream
          <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={1000} rows={3} />
        </label>
        <div className="project-admin-form-grid">
          <label>
            Tags
            <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} maxLength={320} placeholder="automation, cozy, chaos" />
          </label>
          <label>
            Name
            <input value={form.suggestedByName} onChange={(event) => setForm((current) => ({ ...current, suggestedByName: event.target.value }))} maxLength={191} />
          </label>
        </div>
        <button type="submit" disabled={isBusy}>
          {isBusy ? "Sending..." : "Send Suggestion"}
        </button>
      </form>
    </section>
  );
};

export default GameSuggestionForm;
