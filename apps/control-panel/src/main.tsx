import { createEventStormPreset, createNotificationScenario, type EventStormPreset } from "@maiks-yt/testing";
import { validateUrlAccessGate } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const scenario = createNotificationScenario();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const eventStormPresets: Array<{ key: EventStormPreset; label: string }> = [
  { key: "notification-burst", label: "Notification burst" },
  { key: "urgent-center-alert", label: "Urgent center alert" },
  { key: "project-focus-shift", label: "Project focus shift" }
];

type ControlPanelAuthState =
  | {
    status: "checking";
  }
  | {
    status: "allowed";
    displayName: string;
  }
  | {
    status: "blocked";
    message: string;
  };

type AccountSessionResponse = {
  user: {
    name?: string | null;
    email?: string | null;
  };
} | null;

const validateControlPanelAccess = async (): Promise<ControlPanelAuthState> => {
  const gateState = await validateUrlAccessGate({
    apiBaseUrl,
    surface: "control-panel",
    scope: "control:open",
    storageKey: "maiks.yt.control.accessToken"
  });

  if (gateState.status === "checking") {
    return {
      status: "checking"
    };
  }

  if (gateState.status !== "allowed") {
    return {
      status: "blocked",
      message: gateState.message
    };
  }

  if (!gateState.requiresLogin) {
    return {
      status: "allowed",
      displayName: "Token user"
    };
  }

  const sessionResponse = await fetch(`${apiBaseUrl}/account/session`, {
    credentials: "include"
  });

  if (!sessionResponse.ok) {
    return {
      status: "blocked",
      message: "Sign in on the main site before opening the control panel."
    };
  }

  const session = await sessionResponse.json() as AccountSessionResponse;

  if (!session) {
    return {
      status: "blocked",
      message: "Sign in on the main site before opening the control panel."
    };
  }

  return {
    status: "allowed",
    displayName: session.user.name ?? session.user.email ?? "Signed-in user"
  };
};

const App = (): React.ReactNode => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [selectedPreset, setSelectedPreset] = useState<EventStormPreset>("notification-burst");
  const selectedEvents = createEventStormPreset(selectedPreset);

  useEffect(() => {
    void validateControlPanelAccess().then(setAuthState);
  }, []);

  if (authState.status !== "allowed") {
    return (
      <main className="surface">
        <h1>Access Required</h1>
        <p>{authState.status === "checking" ? "Checking control panel access..." : authState.message}</p>
      </main>
    );
  }

  return (
    <main className="surface">
      <h1>Maiks.yt Control Panel</h1>
      <p>Low-distraction control surface scaffold for {authState.displayName}.</p>
      <button type="button">Emergency clean mode</button>
      <section>
        <h2>Simulator</h2>
        <p>{scenario.length} starter event ready. {selectedEvents.length} events loaded from the selected preset.</p>
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
        <ol className="event-preview-list">
          {selectedEvents.map((event, index) => (
            <li key={`${event.type}-${index}`}>
              <strong>{event.type}</strong>
              <span>{JSON.stringify(event.payload)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
