"use client";

import { useState } from "react";

import styles from "./games.module.css";

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
    } catch {
      setMessage("The suggestion could not be sent. Try again after the service recovers.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className={styles.suggestion} aria-labelledby="suggest-game-title">
      <div className={styles.suggestionHeading}>
        <div>
          <p className={styles.eyebrow}>Community suggestions</p>
          <h2 id="suggest-game-title">Suggest a game</h2>
          <p>Suggestions enter a private review queue. Submitting one does not publish it.</p>
        </div>
        <p className={styles.formMessage} aria-live="polite">{message}</p>
      </div>
      <form className={styles.form} onSubmit={(event) => void submitSuggestion(event)}>
        <div className={styles.formGrid}>
          <label>
            Game title
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
          </label>
          <label>
            Platform <span>Optional</span>
            <input value={form.platformLabel} onChange={(event) => setForm((current) => ({ ...current, platformLabel: event.target.value }))} maxLength={120} />
          </label>
        </div>
        <label>
          Store URL <span>Optional</span>
          <input value={form.storeUrl} onChange={(event) => setForm((current) => ({ ...current, storeUrl: event.target.value }))} maxLength={1024} />
        </label>
        <label>
          Why this could work on stream <span>Optional</span>
          <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={1000} rows={3} />
        </label>
        <div className={styles.formGrid}>
          <label>
            Tags <span>Optional, separated by commas</span>
            <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} maxLength={320} placeholder="automation, cozy, chaos" />
          </label>
          <label>
            Your public name <span>Optional</span>
            <input value={form.suggestedByName} onChange={(event) => setForm((current) => ({ ...current, suggestedByName: event.target.value }))} maxLength={191} />
          </label>
        </div>
        <button type="submit" disabled={isBusy}>
          {isBusy ? "Sending..." : "Send suggestion"}
        </button>
      </form>
    </section>
  );
};

export default GameSuggestionForm;
