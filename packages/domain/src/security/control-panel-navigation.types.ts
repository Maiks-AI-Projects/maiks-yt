export const controlPanelPageKeys = [
  "overview",
  "stream",
  "overlays",
  "actions",
  "music",
  "providers"
] as const;

export type ControlPanelPageKey = typeof controlPanelPageKeys[number];

export const controlPanelActionViewCapability = "action-panel:view" as const;
export const controlPanelMusicControlCapability = "music:play-control" as const;
export const controlPanelProviderHealthCapability = "chat:view" as const;
