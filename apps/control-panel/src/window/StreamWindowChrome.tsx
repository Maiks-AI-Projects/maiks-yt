import type { ReactNode } from "react";

import { withDevAuthToken } from "../dev-auth-token.js";
import {
  getAccessibleStreamWindows,
  getStreamWindowKeyForPath,
  getStreamWindowLabel,
  type StreamWindowAccessState
} from "./stream-window-registry.service.js";

type StreamWindowChromeProps = {
  access: StreamWindowAccessState;
  children: ReactNode;
  currentPath: string;
  displayName: string;
  leftAction?: ReactNode;
  panelSelector?: ReactNode;
  status?: ReactNode;
};

export const StreamWindowChrome = ({
  access,
  children,
  currentPath,
  displayName,
  leftAction,
  panelSelector,
  status
}: StreamWindowChromeProps): ReactNode => {
  const currentKey = getStreamWindowKeyForPath(currentPath);
  const destinations = getAccessibleStreamWindows({ access, currentPath });

  const navigateToWindow = (route: string): void => {
    if (route === currentPath) return;

    window.location.assign(withDevAuthToken(route));
  };

  return (
    <>
      <header className="stream-window-chrome" aria-label="Stream window controls">
        <div className="stream-window-identity">
          <span className="control-window-mark" aria-hidden="true">M</span>
          <div>
            <strong>{getStreamWindowLabel(currentPath)}</strong>
            <span>{displayName}</span>
          </div>
        </div>
        {leftAction ? <div className="stream-window-action-slot">{leftAction}</div> : null}
        <label className="stream-window-selector">
          <span>Window</span>
          <select
            aria-label="Open stream window"
            value={currentKey}
            onChange={(event) => {
              const route = destinations.find((destination) => destination.key === event.currentTarget.value)?.route;

              if (route) navigateToWindow(route);
            }}
          >
            {destinations.map((destination) => (
              <option key={destination.key} value={destination.key}>{destination.label}</option>
            ))}
          </select>
        </label>
        {panelSelector ? <div className="stream-window-panel-slot">{panelSelector}</div> : null}
        {status ? <div className="stream-window-status-slot">{status}</div> : null}
      </header>
      {children}
    </>
  );
};
