export type StreamWindowKey = "chat" | "moderation" | "control" | "ai";

export type StreamWindowFamily = "control";

export type StreamWindowAccessRequirement = "control-token" | "moderation-access" | "ai-control";

export type StreamWindowDefinition = {
  family: StreamWindowFamily;
  installedWindow: boolean;
  key: StreamWindowKey;
  label: string;
  requires: StreamWindowAccessRequirement;
  route: `/${string}`;
  tokenPolicy: {
    accessToken: "stored-control-token";
    devAuthToken: "preserve-when-present";
  };
};

export type StreamWindowAccessState = {
  ai: "allowed" | "blocked" | "unknown";
  control: "allowed" | "blocked";
  moderation: "allowed" | "blocked" | "unknown";
};

export const streamWindowRegistry: readonly StreamWindowDefinition[] = [
  {
    family: "control",
    installedWindow: true,
    key: "control",
    label: "Control",
    requires: "control-token",
    route: "/control",
    tokenPolicy: {
      accessToken: "stored-control-token",
      devAuthToken: "preserve-when-present"
    }
  },
  {
    family: "control",
    installedWindow: true,
    key: "chat",
    label: "Chat",
    requires: "control-token",
    route: "/chat",
    tokenPolicy: {
      accessToken: "stored-control-token",
      devAuthToken: "preserve-when-present"
    }
  },
  {
    family: "control",
    installedWindow: true,
    key: "moderation",
    label: "Moderation",
    requires: "moderation-access",
    route: "/moderation",
    tokenPolicy: {
      accessToken: "stored-control-token",
      devAuthToken: "preserve-when-present"
    }
  },
  {
    family: "control",
    installedWindow: true,
    key: "ai",
    label: "AI",
    requires: "ai-control",
    route: "/ai",
    tokenPolicy: {
      accessToken: "stored-control-token",
      devAuthToken: "preserve-when-present"
    }
  }
] as const;

export const normalizeStreamWindowPath = (pathname: string): string => {
  const queryIndex = pathname.indexOf("?");
  const hashIndex = pathname.indexOf("#");
  const endIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const pathOnly = endIndex === undefined ? pathname : pathname.slice(0, endIndex);

  return pathOnly.replace(/\/+$/, "") || "/";
};

export const getStreamWindowKeyForPath = (pathname: string): StreamWindowKey => {
  const routePath = normalizeStreamWindowPath(pathname);
  const match = streamWindowRegistry.find((windowDefinition) => windowDefinition.route === routePath);

  return match?.key ?? "control";
};

const hasRequiredAccess = (
  windowDefinition: StreamWindowDefinition,
  access: StreamWindowAccessState
): boolean => {
  switch (windowDefinition.requires) {
    case "control-token":
      return access.control === "allowed";
    case "moderation-access":
      return access.moderation === "allowed";
    case "ai-control":
      return access.ai === "allowed";
  }
};

export const getAccessibleStreamWindows = ({
  access,
  currentPath
}: {
  access: StreamWindowAccessState;
  currentPath: string;
}): readonly StreamWindowDefinition[] => {
  const currentKey = getStreamWindowKeyForPath(currentPath);

  return streamWindowRegistry.filter((windowDefinition) =>
    windowDefinition.key === currentKey || hasRequiredAccess(windowDefinition, access)
  );
};

export const getStreamWindowLabel = (pathname: string): string => {
  const key = getStreamWindowKeyForPath(pathname);

  return streamWindowRegistry.find((windowDefinition) => windowDefinition.key === key)?.label ?? "Control";
};
