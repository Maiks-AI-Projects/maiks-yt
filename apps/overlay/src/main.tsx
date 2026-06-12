import { defaultTheme } from "@maiks-yt/themes";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";

const App = (): React.ReactNode => {
  const [gateState, setGateState] = useState<UrlAccessGateState>({ status: "checking" });

  useEffect(() => {
    void validateUrlAccessGate({
      apiBaseUrl,
      surface: "overlay",
      scope: "overlay:connect",
      storageKey: "maiks.yt.overlay.accessToken"
    }).then(setGateState);
  }, []);

  if (gateState.status !== "allowed") {
    return (
      <main className="overlay access-gate">
        <div className="center-notification">
          {gateState.status === "checking" ? "Checking overlay access" : gateState.message}
        </div>
      </main>
    );
  }

  return (
    <main className="overlay">
      <div className="top-notification">Overlay ready: {defaultTheme.label}</div>
      <div className="center-notification">Waiting for queued events</div>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
