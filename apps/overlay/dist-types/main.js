import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { defaultTheme } from "@maiks-yt/themes";
import { createRoot } from "react-dom/client";
import "./styles.css";
const App = () => (_jsxs("main", { className: "overlay", children: [_jsxs("div", { className: "top-notification", children: ["Overlay ready: ", defaultTheme.label] }), _jsx("div", { className: "center-notification", children: "Waiting for queued events" })] }));
createRoot(document.querySelector("#root")).render(_jsx(App, {}));
