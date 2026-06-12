import { createNotificationScenario } from "@maiks-yt/testing";
import { validateUrlAccessGate, type UrlAccessGateState } from "@maiks-yt/ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const scenario = createNotificationScenario();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://api-dev.maiks.yt";

const App = (): React.ReactNode => {
  const [gateState, setGateState] = useState<UrlAccessGateState>({ status: "checking" });

  useEffect(() => {
    void validateUrlAccessGate({
      apiBaseUrl,
      surface: "control-panel",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken"
    }).then(setGateState);
  }, []);

  if (gateState.status !== "allowed") {
    return (
      <main className="surface">
        <h1>Access Required</h1>
        <p>{gateState.status === "checking" ? "Checking control panel access..." : gateState.message}</p>
      </main>
    );
  }

  return (
    <main className="surface">
      <h1>Maiks.yt Control Panel</h1>
      <p>Low-distraction control surface scaffold.</p>
      <button type="button">Emergency clean mode</button>
      <section>
        <h2>Simulator</h2>
        <p>{scenario.length} starter event ready.</p>
      </section>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
