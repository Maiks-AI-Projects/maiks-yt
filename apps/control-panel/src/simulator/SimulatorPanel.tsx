import { createNotificationScenario, createReplaySessionFromPreset, type EventStormPreset } from "@maiks-yt/testing";
import { useState, type ReactNode } from "react";

type ReplayDispatchResult = {
  failed: number;
  queued: number;
  skipped: number;
};

type SimulatorPanelProps = {
  apiBaseUrl: string;
};

const scenario = createNotificationScenario();
const eventStormPresets: Array<{ key: EventStormPreset; label: string }> = [
  { key: "notification-burst", label: "Notification burst" },
  { key: "urgent-center-alert", label: "Urgent center alert" },
  { key: "project-focus-shift", label: "Project focus shift" }
];

const delay = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
};

export const SimulatorPanel = ({ apiBaseUrl }: SimulatorPanelProps): ReactNode => {
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<EventStormPreset>("notification-burst");
  const replaySession = createReplaySessionFromPreset(selectedPreset);

  const postReplayEvent = async (
    token: string,
    entry: ReturnType<typeof createReplaySessionFromPreset>["events"][number]
  ): Promise<"queued" | "skipped" | "failed"> => {
    let endpoint = "";
    let body: Record<string, unknown> | null = null;

    switch (entry.event.type) {
      case "overlay.notification.queued":
        endpoint = "/overlay/notification/test";
        body = {
          accessToken: token,
          afterCenter: "top",
          count: 1,
          route: entry.event.payload.zone === "center" ? "center" : "top"
        };
        break;
      case "overlay.routed-notification.queued":
        endpoint = "/overlay/notification/test";
        body = {
          accessToken: token,
          afterCenter: entry.event.payload.afterCenter,
          count: 1,
          route: entry.event.payload.route
        };
        break;
      case "overlay.top-bar-notification.queued":
        endpoint = "/overlay/top-bar/test";
        body = {
          accessToken: token,
          count: 1
        };
        break;
      default:
        return "skipped";
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return response.ok ? "queued" : "failed";
  };

  const playReplaySession = async (): Promise<ReplayDispatchResult> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      throw new Error("Control token missing.");
    }

    const result: ReplayDispatchResult = {
      failed: 0,
      queued: 0,
      skipped: 0
    };
    let previousOffsetMs = 0;

    for (const entry of replaySession.events) {
      await delay(Math.max(0, entry.offsetMs - previousOffsetMs));
      previousOffsetMs = entry.offsetMs;

      const dispatchResult = await postReplayEvent(token, entry);

      result[dispatchResult] += 1;
    }

    return result;
  };

  const handlePlayReplay = async (): Promise<void> => {
    if (isReplayPlaying) {
      return;
    }

    setIsReplayPlaying(true);
    setReplayStatus(`Playing ${replaySession.title}.`);

    try {
      const result = await playReplaySession();
      setReplayStatus(`Replay done: ${result.queued} queued, ${result.skipped} skipped, ${result.failed} failed.`);
    } catch (error) {
      setReplayStatus(error instanceof Error ? error.message : "Replay failed.");
    } finally {
      setIsReplayPlaying(false);
    }
  };

  return (
    <section className="simulator-panel">
      <div className="section-heading">
        <h2>Simulator</h2>
        <span>{scenario.length} starter event, {replaySession.events.length} replay events</span>
      </div>
      <div className="preset-actions" aria-label="Event storm presets">
        {eventStormPresets.map((preset) => (
          <button
            type="button"
            className={selectedPreset === preset.key ? "selected-action" : undefined}
            key={preset.key}
            onClick={() => setSelectedPreset(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="replay-summary">
        <strong>{replaySession.title}</strong>
        <span>{replaySession.source}</span>
        <span>{replaySession.sanitized ? "Sanitized" : "Raw"}</span>
      </div>
      <div className="status-action-group replay-actions">
        <button type="button" className="status-action" disabled={isReplayPlaying} onClick={() => void handlePlayReplay()}>
          {isReplayPlaying ? "Playing replay" : "Play replay"}
        </button>
        {replayStatus ? <span className="status-note">{replayStatus}</span> : null}
      </div>
      <ol className="event-preview-list">
        {replaySession.events.map((entry, index) => (
          <li key={`${entry.event.type}-${index}`}>
            <strong>{entry.offsetMs}ms - {entry.event.type}</strong>
            <span>{JSON.stringify(entry.event.payload)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
