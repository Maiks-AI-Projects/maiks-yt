import { createNotificationScenario } from "@maiks-yt/testing";
import { createRoot } from "react-dom/client";
import "./styles.css";

const scenario = createNotificationScenario();

const App = (): React.ReactNode => (
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

createRoot(document.querySelector("#root")!).render(<App />);
