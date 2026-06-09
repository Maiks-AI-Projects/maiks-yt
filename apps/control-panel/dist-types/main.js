import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createNotificationScenario } from "@maiks-yt/testing";
import { createRoot } from "react-dom/client";
import "./styles.css";
const scenario = createNotificationScenario();
const App = () => (_jsxs("main", { className: "surface", children: [_jsx("h1", { children: "Maiks.yt Control Panel" }), _jsx("p", { children: "Low-distraction control surface scaffold." }), _jsx("button", { type: "button", children: "Emergency clean mode" }), _jsxs("section", { children: [_jsx("h2", { children: "Simulator" }), _jsxs("p", { children: [scenario.length, " starter event ready."] })] })] }));
createRoot(document.querySelector("#root")).render(_jsx(App, {}));
