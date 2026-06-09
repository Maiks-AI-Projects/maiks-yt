import { defaultTheme } from "@maiks-yt/themes";
import { createRoot } from "react-dom/client";
import "./styles.css";

const App = (): React.ReactNode => (
  <main className="overlay">
    <div className="top-notification">Overlay ready: {defaultTheme.label}</div>
    <div className="center-notification">Waiting for queued events</div>
  </main>
);

createRoot(document.querySelector("#root")!).render(<App />);
