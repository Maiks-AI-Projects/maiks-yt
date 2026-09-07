export type ControlShellSurface = "control" | "chat" | "moderation" | "ai";

export type ControlShellTheme = "default" | "satisfactory";

export type ControlShellSurfaceClassification = {
  surface: ControlShellSurface;
  theme: ControlShellTheme;
};

export type ControlShellDataAttributes = {
  "data-site-surface": ControlShellSurface;
  "data-site-theme": ControlShellTheme;
};

const stripPathnameOnly = (pathname: string): string => {
  const queryIndex = pathname.indexOf("?");
  const hashIndex = pathname.indexOf("#");
  const endIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return endIndex === undefined ? pathname : pathname.slice(0, endIndex);
};

const normalizeRoutePath = (pathname: string): string => stripPathnameOnly(pathname).replace(/\/+$/, "") || "/";

export const classifyControlShellSurface = (pathname: string): ControlShellSurfaceClassification => {
  const routePath = normalizeRoutePath(pathname);

  switch (routePath) {
    case "/chat":
      return {
        surface: "chat",
        theme: "default"
      };
    case "/moderation":
      return {
        surface: "moderation",
        theme: "default"
      };
    case "/ai":
      return {
        surface: "ai",
        theme: "default"
      };
    default:
      return {
        surface: "control",
        theme: "default"
      };
  }
};

export const getControlShellDataAttributes = (pathname: string): ControlShellDataAttributes => {
  const classification = classifyControlShellSurface(pathname);

  return {
    "data-site-surface": classification.surface,
    "data-site-theme": classification.theme
  };
};
